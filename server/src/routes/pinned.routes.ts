import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';

const router = Router();

// Rögzített emailek listázása
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók' });
    }

    const pinnedEmails = queryAll<{ email_id: string; pinned_at: number }>(
      'SELECT email_id, pinned_at FROM pinned_emails WHERE account_id = ? ORDER BY pinned_at DESC',
      [accountId],
    );

    return res.json({ pinnedEmailIds: pinnedEmails.map(p => p.email_id) });
  } catch (error) {
    console.error('Pinned emails list error:', error);
    return res.status(500).json({ error: 'Nem sikerült lekérni a rögzített emaileket' });
  }
});

// Email rögzítése (pin)
router.post('/:emailId', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók' });
    }

    const { emailId } = req.params;

    // Ellenőrizzük, hogy az email létezik és ehhez a fiókhoz tartozik
    const email = queryOne<{ id: string }>(
      'SELECT id FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (!email) {
      return res.status(404).json({ error: 'Email nem található' });
    }

    // Ellenőrizzük, hogy már rögzítve van-e
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM pinned_emails WHERE email_id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (existing) {
      return res.json({ success: true, message: 'Email már rögzítve van' });
    }

    const id = uuidv4();
    const now = Date.now();

    execute(
      'INSERT INTO pinned_emails (id, email_id, account_id, pinned_at) VALUES (?, ?, ?, ?)',
      [id, emailId, accountId, now],
    );

    return res.json({ success: true, pinnedAt: now });
  } catch (error) {
    console.error('Pin email error:', error);
    return res.status(500).json({ error: 'Nem sikerült rögzíteni az emailt' });
  }
});

// Email rögzítés feloldása (unpin)
router.delete('/:emailId', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók' });
    }

    const { emailId } = req.params;

    execute(
      'DELETE FROM pinned_emails WHERE email_id = ? AND account_id = ?',
      [emailId, accountId],
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Unpin email error:', error);
    return res.status(500).json({ error: 'Nem sikerült feloldani a rögzítést' });
  }
});

// Pin toggle (kényelmesebb endpoint)
router.post('/:emailId/toggle', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók' });
    }

    const { emailId } = req.params;

    // Ellenőrizzük, hogy az email létezik
    const email = queryOne<{ id: string }>(
      'SELECT id FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (!email) {
      return res.status(404).json({ error: 'Email nem található' });
    }

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM pinned_emails WHERE email_id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (existing) {
      // Unpin
      execute('DELETE FROM pinned_emails WHERE id = ? AND account_id = ?', [existing.id, accountId]);
      return res.json({ isPinned: false });
    } else {
      // Pin
      const id = uuidv4();
      const now = Date.now();
      execute(
        'INSERT INTO pinned_emails (id, email_id, account_id, pinned_at) VALUES (?, ?, ?, ?)',
        [id, emailId, accountId, now],
      );
      return res.json({ isPinned: true, pinnedAt: now });
    }
  } catch (error) {
    console.error('Toggle pin error:', error);
    return res.status(500).json({ error: 'Nem sikerült módosítani a rögzítést' });
  }
});

export default router;
