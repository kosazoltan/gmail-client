import { Router } from 'express';
import { downloadAttachment, listAttachments, AttachmentFilter, getAttachmentOwner } from '../services/attachment.service.js';

const router = Router();

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: { session: { activeAccountId?: string | null; accountIds?: string[] } }): string | null {
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
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
    };

    const result = await listAttachments(filter);
    res.json(result);
  } catch (error) {
    console.error('Melléklet listázás hiba:', error);
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
    const attachmentOwner = getAttachmentOwner(req.params.id);
    if (!attachmentOwner || attachmentOwner !== accountId) {
      return res.status(403).json({ error: 'Nincs jogosultság ehhez a melléklethez' });
    }

    const result = await downloadAttachment(req.params.id);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Content-Length', result.data.length);
    res.send(result.data);
  } catch (error) {
    console.error('Melléklet letöltés hiba:', error);
    res.status(404).json({ error: 'Melléklet nem található' });
  }
});

export default router;
