import { Router, Request } from 'express';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import {
  getGmailClient,
  listLabels,
  createLabel,
  deleteLabel,
  modifyMessage,
} from '../services/gmail.service.js';
import { execute, queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Helper: labelIds tömb validálása
function isValidLabelIds(labelIds: unknown): labelIds is string[] {
  return (
    Array.isArray(labelIds) &&
    labelIds.length > 0 &&
    labelIds.every((id) => typeof id === 'string' && id.length > 0)
  );
}

// Helper: emailId validálása (Gmail message ID-k tartalmazhatnak _ és - karaktereket is)
function isValidEmailId(emailId: string): boolean {
  return (
    typeof emailId === 'string' &&
    emailId.length > 0 &&
    emailId.length <= 100 &&
    /^[a-zA-Z0-9_-]+$/.test(emailId)
  );
}

// Helper: JSON biztonságos parse
function safeParseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    const parsed = JSON.parse(labelsJson);
    return Array.isArray(parsed) ? parsed.filter((l): l is string => typeof l === 'string') : [];
  } catch (err) {
    logger.warn('Labels JSON parse failed in safeParseLabels', { labels: labelsJson, error: err });
    return [];
  }
}

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: Request): string | null {
  const accountId =
    (req.query.accountId as string | undefined) || req.session.activeAccountId || null;
  if (!accountId) return null;

  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// Összes címke listázása
router.get('/', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const labels = await listLabels(gmail);

    // Szűrjük ki a nem hasznos címkéket (CATEGORY_*, CHAT, stb)
    const EXCLUDED_PREFIXES = ['CATEGORY_', 'CHAT', 'FORUMS', 'UPDATES', 'PROMOTIONS', 'SOCIAL'];
    const filteredLabels = labels.filter(
      (l) => !EXCLUDED_PREFIXES.some((prefix) => l.id.startsWith(prefix)),
    );

    res.json({ labels: filteredLabels });
  } catch (error) {
    console.error('Címkék listázás hiba:', error);
    res.status(500).json({ error: 'Címkék lekérése sikertelen' });
  }
});

// Új címke létrehozása
router.post('/', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { name, backgroundColor, textColor } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Címke neve kötelező' });
    return;
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 100) {
    res.status(400).json({ error: 'Címke neve 1-100 karakter között kell legyen' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const label = await createLabel(gmail, { name: trimmedName, backgroundColor, textColor });

    res.json({ label });
  } catch (error) {
    console.error('Címke létrehozás hiba:', error);
    res.status(500).json({ error: 'Címke létrehozása sikertelen' });
  }
});

// Címke törlése
router.delete('/:labelId', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { labelId } = req.params;

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    await deleteLabel(gmail, labelId);

    res.json({ success: true });
  } catch (error) {
    console.error('Címke törlés hiba:', error);
    res.status(500).json({ error: 'Címke törlése sikertelen' });
  }
});

// Címke hozzáadása egy emailhez
router.post('/email/:emailId/add', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { emailId } = req.params;
  const { labelIds } = req.body;

  if (!isValidEmailId(emailId)) {
    res.status(400).json({ error: 'Érvénytelen emailId' });
    return;
  }

  if (!isValidLabelIds(labelIds)) {
    res.status(400).json({ error: 'labelIds kötelező és string tömb kell legyen' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, { addLabels: labelIds });

    // Frissítsük az adatbázisban is (account_id validációval)
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (email) {
      const currentLabels = safeParseLabels(email.labels);
      const newLabels = [...new Set([...currentLabels, ...labelIds])];
      execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [JSON.stringify(newLabels), emailId, accountId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Címke hozzáadás hiba:', error);
    res.status(500).json({ error: 'Címke hozzáadása sikertelen' });
  }
});

// Címke eltávolítása egy emailről
router.post('/email/:emailId/remove', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { emailId } = req.params;
  const { labelIds } = req.body;

  if (!isValidEmailId(emailId)) {
    res.status(400).json({ error: 'Érvénytelen emailId' });
    return;
  }

  if (!isValidLabelIds(labelIds)) {
    res.status(400).json({ error: 'labelIds kötelező és string tömb kell legyen' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, { removeLabels: labelIds });

    // Frissítsük az adatbázisban is (account_id validációval)
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (email) {
      const currentLabels = safeParseLabels(email.labels);
      const newLabels = currentLabels.filter((l) => !labelIds.includes(l));
      execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [JSON.stringify(newLabels), emailId, accountId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Címke eltávolítás hiba:', error);
    res.status(500).json({ error: 'Címke eltávolítása sikertelen' });
  }
});

// Email áthelyezése (régi címkék eltávolítása, új hozzáadása)
router.post('/email/:emailId/move', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { emailId } = req.params;
  const { addLabelIds, removeLabelIds } = req.body;

  if (!isValidEmailId(emailId)) {
    res.status(400).json({ error: 'Érvénytelen emailId' });
    return;
  }

  // Validáljuk a labelIds tömböket ha megadták
  const validAddLabelIds = isValidLabelIds(addLabelIds) ? addLabelIds : [];
  const validRemoveLabelIds = isValidLabelIds(removeLabelIds) ? removeLabelIds : [];

  if (validAddLabelIds.length === 0 && validRemoveLabelIds.length === 0) {
    res.status(400).json({ error: 'Legalább egy addLabelIds vagy removeLabelIds kötelező' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, {
      addLabels: validAddLabelIds,
      removeLabels: validRemoveLabelIds,
    });

    // Frissítsük az adatbázisban is (account_id validációval)
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (email) {
      let currentLabels = safeParseLabels(email.labels);

      // Eltávolítás
      if (validRemoveLabelIds.length > 0) {
        currentLabels = currentLabels.filter((l) => !validRemoveLabelIds.includes(l));
      }

      // Hozzáadás
      if (validAddLabelIds.length > 0) {
        currentLabels = [...new Set([...currentLabels, ...validAddLabelIds])];
      }

      execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [JSON.stringify(currentLabels), emailId, accountId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Email áthelyezés hiba:', error);
    res.status(500).json({ error: 'Email áthelyezése sikertelen' });
  }
});

export default router;
