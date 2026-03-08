import logger from '../utils/logger.js';
import { Router } from 'express';
import {
  downloadAttachment,
  listAttachments,
  AttachmentFilter,
  getAttachmentOwner,
} from '../services/attachment.service.js';
import { parseDocument, isAnalyzable } from '../services/document-parser.service.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: {
  session: { activeAccountId?: string | null; accountIds?: string[] };
}): string | null {
  const accountId = req.session.activeAccountId;
  if (!accountId) return null;

  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// Engedélyezett melléklet típusok
const ALLOWED_TYPES = ['image', 'document', 'pdf', 'archive', 'other'];

// Összes melléklet listázása szűréssel és rendezéssel
router.get('/', async (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve vagy nincs jogosultság' });
    }

    // Típus validáció
    const type = req.query.type as string | undefined;
    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Érvénytelen melléklet típus' });
    }

    const filter: AttachmentFilter = {
      accountId,
      type,
      search: req.query.search as string | undefined,
      sort: (req.query.sort as 'date' | 'size' | 'name') || 'date',
      order: (req.query.order as 'asc' | 'desc') || 'desc',
      page: Math.max(1, parseInt(req.query.page as string, 10) || 1),
      limit: Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), 100),
    };

    const result = await listAttachments(filter);
    res.json(result);
  } catch (error) {
    logger.error('Melléklet listázás hiba:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a mellékleteket' });
  }
});

// Melléklet letöltés
router.get('/:id/download', async (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve vagy nincs jogosultság' });
    }

    // Ellenőrizzük, hogy a melléklet a felhasználó fiókjához tartozik-e
    const attachmentOwner = await getAttachmentOwner(req.params.id);
    if (!attachmentOwner || attachmentOwner !== accountId) {
      return res.status(403).json({ error: 'Nincs jogosultság ehhez a melléklethez' });
    }

    const result = await downloadAttachment(req.params.id);

    // Preview-hoz inline használata (ne indítson letöltést)
    // A böngésző így megpróbálja megjeleníteni a fájlt ahelyett, hogy letöltené
    res.setHeader('Content-Type', result.mimeType);
    // RFC 5987 compliant encoding for filenames with special characters
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    res.setHeader('Content-Length', result.data.length);
    res.send(result.data);
  } catch (error: unknown) {
    logger.error('Melléklet letöltés hiba:', error);
    // Ha a hiba tartalmazza, hogy nem található, akkor 404, egyébként 500
    const isNotFound = error instanceof Error && error.message.includes('not found');
    res.status(isNotFound ? 404 : 500).json({
      error: isNotFound ? 'Melléklet nem található' : 'Melléklet letöltése sikertelen',
    });
  }
});

// AI elemzés - melléklet szövegkinyerés + Anthropic Haiku elemzés
router.post('/:id/analyze', async (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve vagy nincs jogosultság' });
    }

    // Jogosultság ellenőrzés
    const attachmentOwner = await getAttachmentOwner(req.params.id);
    if (!attachmentOwner || attachmentOwner !== accountId) {
      return res.status(403).json({ error: 'Nincs jogosultság ehhez a melléklethez' });
    }

    // Melléklet letöltés
    const result = await downloadAttachment(req.params.id);

    // Ellenőrzés: elemezhető-e
    if (!isAnalyzable(result.mimeType, result.filename)) {
      return res.status(400).json({
        error: `Ez a fájltípus nem elemezhető (${result.mimeType})`,
      });
    }

    // Szöveg kinyerés
    const parsed = await parseDocument(result.data, result.mimeType, result.filename);

    if (!parsed.text || parsed.text.length < 10) {
      return res.status(400).json({
        error: 'A dokumentumból nem sikerült érdemi szöveget kinyerni',
      });
    }

    // Anthropic API ellenőrzés
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY nincs konfigurálva' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Szöveg limitálás (max ~8000 karakter az AI-nak)
    const truncatedText = parsed.text.length > 8000
      ? parsed.text.substring(0, 8000) + '\n\n[...a dokumentum többi része levágva...]'
      : parsed.text;

    // Fájlnév sanitizálás (prompt injection védelem)
    const safeFilename = result.filename
      .replace(/[^\w.\-_() áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, '_')
      .substring(0, 100);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251015',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Elemezd az alábbi dokumentumot. Válaszolj KIZÁRÓLAG érvényes JSON formátumban, semmilyen más szöveget ne adj hozzá.

A JSON struktúra:
{
  "summary": "Összefoglalás magyarul, maximum 200 szó",
  "keyPoints": ["Kulcspont 1", "Kulcspont 2", "..."],
  "documentType": "A dokumentum típusa (pl. számla, szerződés, jelentés, levél, jegyzőkönyv, ajánlat, stb.)"
}

Fájlnév: ${safeFilename}
MIME típus: ${result.mimeType}

Dokumentum szövege:
---
${truncatedText}
---`,
        },
      ],
    });

    // Válasz feldolgozás
    const aiText = response.content.length > 0 && response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    if (!aiText) {
      return res.status(500).json({ error: 'Az AI nem adott vissza szöveges választ' });
    }

    let analysis: { summary: string; keyPoints: string[]; documentType: string };
    try {
      // Próbáljuk JSON-ként parse-olni (markdown code block is lehet)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Nem található JSON a válaszban');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      logger.error('AI válasz parse hiba:', aiText);
      return res.status(500).json({ error: 'Az AI elemzés eredménye nem feldolgozható' });
    }

    res.json({
      summary: analysis.summary || '',
      keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [],
      documentType: analysis.documentType || 'ismeretlen',
      pageCount: parsed.pageCount || null,
    });
  } catch (error: unknown) {
    logger.error('Melléklet AI elemzés hiba:', error);
    const message = error instanceof Error ? error.message : 'Melléklet elemzése sikertelen';
    res.status(500).json({ error: message });
  }
});

export default router;
