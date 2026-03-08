import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import {
  getSmartFolders,
  getSmartFolderById,
  getSmartFolderEmails,
  createSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  seedDefaultSmartFolders,
} from '../services/smart-folders.service.js';
import type { SmartFolderRule } from '../services/smart-folders.service.js';

const router = Router();

// Anthropic client (lazy init)
let aiClient: Anthropic | null = null;

function getAIClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!aiClient) {
    aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return aiClient;
}

// Valid fields and operators for rule validation
const VALID_FIELDS = ['from', 'to', 'subject', 'labels', 'has_attachments', 'is_read', 'date_age_days'] as const;
const VALID_OPERATORS = ['contains', 'equals', 'not_contains', 'greater_than', 'less_than'] as const;

function isValidField(f: string): f is SmartFolderRule['field'] {
  return (VALID_FIELDS as readonly string[]).includes(f);
}

function isValidOperator(o: string): o is SmartFolderRule['operator'] {
  return (VALID_OPERATORS as readonly string[]).includes(o);
}

// Fallback: simple keyword-based rule generation (no AI needed)
function generateFallbackRules(description: string): { name: string; rules: SmartFolderRule[] } {
  const words = description
    .toLowerCase()
    .replace(/[^\wáéíóöőúüű\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  // Remove common Hungarian stop words
  const stopWords = new Set(['egy', 'ami', 'azt', 'nem', 'van', 'meg', 'csak', 'hogy', 'kapcsolatos', 'levelek', 'leveleim', 'emailek', 'mappát', 'mappa']);
  const keywords = words.filter(w => !stopWords.has(w));

  if (keywords.length === 0) {
    return {
      name: description.slice(0, 50),
      rules: [{ field: 'subject', operator: 'contains', value: description.slice(0, 50) }],
    };
  }

  // Generate rules: check subject and from for each keyword
  const rules: SmartFolderRule[] = keywords.slice(0, 3).map(kw => ({
    field: 'subject' as const,
    operator: 'contains' as const,
    value: kw,
  }));

  return {
    name: description.slice(0, 50),
    rules,
  };
}

// POST /api/smart-folders/generate — AI-based smart folder rule generation
router.post('/generate', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { description } = req.body as { description?: string };

    if (!description || typeof description !== 'string' || description.trim().length < 3) {
      return res.status(400).json({ error: 'Adj meg egy leírást (legalább 3 karakter)' });
    }

    const trimmed = description.trim().slice(0, 500); // Max 500 char input
    const client = getAIClient();

    if (!client) {
      // Fallback: keyword-based generation
      logger.info('AI Smart Folder generate: no API key, using fallback');
      const result = generateFallbackRules(trimmed);
      return res.json({
        success: true,
        folder: {
          name: result.name,
          description: trimmed,
          rules: result.rules,
        },
        method: 'fallback',
      });
    }

    // AI-based generation
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Generálj email szűrési szabályokat a következő leírás alapján: "${trimmed}"

Adj vissza CSAK egy JSON objektumot, semmi mást:
{
  "name": "Rövid mappa név (max 40 karakter)",
  "icon": "egyetlen emoji ami illik a témához",
  "rules": [
    { "field": "...", "operator": "...", "value": "..." }
  ]
}

Elérhető field értékek: from, to, subject, labels, has_attachments, is_read, date_age_days
Elérhető operator értékek: contains, equals, not_contains, greater_than, less_than

Szabályok:
- 1-5 szabály legyen
- A "value" mindig string (has_attachments: "1" vagy "0", is_read: "1" vagy "0", date_age_days: szám stringként)
- A leírás alapján válaszd ki a leglogikusabb mezőket és operátorokat
- Magyar és angol kulcsszavakat is kezelj`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('AI nem adott szöveges választ');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as { name?: string; icon?: string; rules?: Array<{ field: string; operator: string; value: string }> };

    if (!parsed.rules || !Array.isArray(parsed.rules) || parsed.rules.length === 0) {
      throw new Error('AI nem generált szabályokat');
    }

    // Validate and sanitize rules
    const validRules: SmartFolderRule[] = parsed.rules
      .filter(r => r && typeof r.field === 'string' && typeof r.operator === 'string' && typeof r.value === 'string')
      .filter(r => isValidField(r.field) && isValidOperator(r.operator))
      .map(r => ({
        field: r.field as SmartFolderRule['field'],
        operator: r.operator as SmartFolderRule['operator'],
        value: String(r.value || '').slice(0, 200),
      }));

    if (validRules.length === 0) {
      // Fallback if AI returned invalid rules
      const fallback = generateFallbackRules(trimmed);
      return res.json({
        success: true,
        folder: {
          name: (parsed.name || fallback.name).replace(/[<>"']/g, '').trim().slice(0, 40),
          icon: parsed.icon || '📁',
          description: trimmed,
          rules: fallback.rules,
        },
        method: 'fallback',
      });
    }

    res.json({
      success: true,
      folder: {
        name: (parsed.name || trimmed).replace(/[<>"']/g, '').trim().slice(0, 40),
        icon: parsed.icon || '📁',
        description: trimmed,
        rules: validRules,
      },
      method: 'ai',
    });
  } catch (err) {
    logger.error('AI Smart Folder generate error:', err);

    // On any error, try fallback
    try {
      const description = (req.body?.description as string)?.trim() || '';
      if (description.length >= 3) {
        const fallback = generateFallbackRules(description);
        return res.json({
          success: true,
          folder: {
            name: fallback.name.replace(/[<>"']/g, '').trim().slice(0, 40),
            description,
            rules: fallback.rules,
          },
          method: 'fallback',
        });
      }
    } catch {
      // ignore fallback error
    }

    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/smart-folders — list all smart folders (with email counts)
router.get('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    // Seed defaults if first time
    seedDefaultSmartFolders(accountId);

    const folders = await getSmartFolders(accountId);
    res.json({ success: true, folders });
  } catch (err) {
    logger.error('Get smart folders error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/smart-folders/:id/emails — get emails in a smart folder
router.get('/:id/emails', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const folder = await getSmartFolderById(id);
    if (!folder || folder.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder not found' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { emails, total } = await getSmartFolderEmails(id, page, limit);

    // Map to frontend format
    const mappedEmails = emails.map(e => {
      let parsedLabels: string[] = [];
      try {
        parsedLabels = e.labels ? JSON.parse(e.labels) : [];
      } catch {
        parsedLabels = [];
      }
      return {
        id: e.id,
        subject: e.subject,
        from: e.from_email,
        fromName: e.from_name,
        to: e.to_email,
        snippet: e.snippet,
        date: e.date,
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        labels: parsedLabels,
        hasAttachments: e.has_attachments === 1,
        threadId: e.thread_id,
      };
    });

    res.json({
      success: true,
      emails: mappedEmails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('Get smart folder emails error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/smart-folders — create new smart folder
router.post('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { name, rules, icon } = req.body as { name: string; rules: SmartFolderRule[]; icon?: string };

    if (!name || !rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ error: 'Név és legalább egy szabály szükséges' });
    }

    const folder = await createSmartFolder(accountId, name, rules, icon);
    res.status(201).json({ success: true, folder });
  } catch (err) {
    logger.error('Create smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/smart-folders/:id — update smart folder
router.put('/:id', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;
    const updates = req.body as { name?: string; icon?: string; rules?: SmartFolderRule[]; sortOrder?: number };

    // Ownership check
    const existing = await getSmartFolderById(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    const folder = await updateSmartFolder(id, updates);
    if (!folder) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    res.json({ success: true, folder });
  } catch (err) {
    logger.error('Update smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/smart-folders/:id — delete smart folder
router.delete('/:id', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const existing = await getSmartFolderById(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    const success = await deleteSmartFolder(id);

    if (!success) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
