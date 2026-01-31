import { Router } from 'express';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import {
  getGmailClient,
  listLabels,
  createLabel,
  deleteLabel,
  modifyMessage,
} from '../services/gmail.service.js';
import { execute, queryOne } from '../db/index.js';

const router = Router();

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: {
  query: { accountId?: string };
  session: { activeAccountId?: string | null; accountIds?: string[] };
}): string | null {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
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

    // Szűrjük ki a rendszer címkéket és formázzuk az eredményt
    const userLabels = labels.filter(
      (l) =>
        l.type === 'user' ||
        // Néhány hasznos rendszer címke
        ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'IMPORTANT'].includes(l.id),
    );

    res.json({ labels: userLabels });
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
  if (!name) {
    res.status(400).json({ error: 'Címke neve kötelező' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const label = await createLabel(gmail, { name, backgroundColor, textColor });

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

  if (!labelIds || !Array.isArray(labelIds) || labelIds.length === 0) {
    res.status(400).json({ error: 'labelIds tömb kötelező' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, { addLabels: labelIds });

    // Frissítsük az adatbázisban is
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ?',
      [emailId],
    );

    if (email) {
      const currentLabels: string[] = email.labels ? JSON.parse(email.labels) : [];
      const newLabels = [...new Set([...currentLabels, ...labelIds])];
      execute('UPDATE emails SET labels = ? WHERE id = ?', [JSON.stringify(newLabels), emailId]);
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

  if (!labelIds || !Array.isArray(labelIds) || labelIds.length === 0) {
    res.status(400).json({ error: 'labelIds tömb kötelező' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, { removeLabels: labelIds });

    // Frissítsük az adatbázisban is
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ?',
      [emailId],
    );

    if (email) {
      const currentLabels: string[] = email.labels ? JSON.parse(email.labels) : [];
      const newLabels = currentLabels.filter((l) => !labelIds.includes(l));
      execute('UPDATE emails SET labels = ? WHERE id = ?', [JSON.stringify(newLabels), emailId]);
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

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await modifyMessage(gmail, emailId, {
      addLabels: addLabelIds || [],
      removeLabels: removeLabelIds || [],
    });

    // Frissítsük az adatbázisban is
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ?',
      [emailId],
    );

    if (email) {
      let currentLabels: string[] = email.labels ? JSON.parse(email.labels) : [];

      // Eltávolítás
      if (removeLabelIds && removeLabelIds.length > 0) {
        currentLabels = currentLabels.filter((l) => !removeLabelIds.includes(l));
      }

      // Hozzáadás
      if (addLabelIds && addLabelIds.length > 0) {
        currentLabels = [...new Set([...currentLabels, ...addLabelIds])];
      }

      execute('UPDATE emails SET labels = ? WHERE id = ?', [JSON.stringify(currentLabels), emailId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Email áthelyezés hiba:', error);
    res.status(500).json({ error: 'Email áthelyezése sikertelen' });
  }
});

export default router;
