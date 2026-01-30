import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

interface SnoozedEmail {
  id: string;
  email_id: string;
  account_id: string;
  snooze_until: number;
  created_at: number;
}

// Szundizott levelek listázása
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const snoozed = queryAll<SnoozedEmail & {
      subject: string | null;
      from_email: string | null;
      from_name: string | null;
    }>(
      `SELECT s.*, e.subject, e.from_email, e.from_name
       FROM snoozed_emails s
       JOIN emails e ON s.email_id = e.id
       WHERE s.account_id = ?
       ORDER BY s.snooze_until ASC`,
      [accountId],
    );

    res.json({
      snoozed: snoozed.map((s) => ({
        id: s.id,
        emailId: s.email_id,
        snoozeUntil: s.snooze_until,
        createdAt: s.created_at,
        emailSubject: s.subject,
        emailFrom: s.from_email,
        emailFromName: s.from_name,
      })),
    });
  } catch (error) {
    console.error('Szundizott levelek lekérése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a szundizott leveleket' });
  }
});

// Email szundizása
router.post('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { emailId, snoozeUntil } = req.body;

    if (!emailId || !snoozeUntil) {
      return res.status(400).json({ error: 'Az email ID és a szundi idő megadása kötelező' });
    }

    // Validáljuk a snoozeUntil timestamp-et
    const snoozeTimestamp = parseInt(snoozeUntil);
    if (isNaN(snoozeTimestamp) || snoozeTimestamp <= Date.now()) {
      return res.status(400).json({ error: 'Érvénytelen szundi időpont - jövőbeli időpontot adj meg' });
    }

    // Ellenőrizzük, hogy létezik-e az email
    const email = queryOne<{ id: string }>(
      'SELECT id FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (!email) {
      return res.status(404).json({ error: 'Email nem található' });
    }

    // Ellenőrizzük, hogy már szundizva van-e
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM snoozed_emails WHERE email_id = ?',
      [emailId],
    );

    if (existing) {
      // Frissítsük a meglévő szundit
      execute(
        'UPDATE snoozed_emails SET snooze_until = ? WHERE id = ?',
        [snoozeTimestamp, existing.id],
      );

      res.json({
        id: existing.id,
        emailId,
        snoozeUntil: snoozeTimestamp,
        updated: true,
      });
    } else {
      // Új szundi létrehozása
      const id = uuid();
      const now = Date.now();

      execute(
        `INSERT INTO snoozed_emails (id, email_id, account_id, snooze_until, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, emailId, accountId, snoozeTimestamp, now],
      );

      res.json({
        id,
        emailId,
        snoozeUntil: snoozeTimestamp,
        createdAt: now,
      });
    }
  } catch (error) {
    console.error('Email szundizása hiba:', error);
    res.status(500).json({ error: 'Nem sikerült szundizni az emailt' });
  }
});

// Szundi törlése (email visszahozása)
router.delete('/:emailId', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { emailId } = req.params;

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM snoozed_emails WHERE email_id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Szundizott email nem található' });
    }

    execute('DELETE FROM snoozed_emails WHERE id = ?', [existing.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Szundi törlése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a szundit' });
  }
});

// Ellenőrzi és törli a lejárt szundikat - ezt a szerver induláskor és periodikusan hívja
export function processExpiredSnoozes() {
  try {
    const now = Date.now();
    const expired = queryAll<{ id: string; email_id: string }>(
      'SELECT id, email_id FROM snoozed_emails WHERE snooze_until <= ?',
      [now],
    );

    for (const snooze of expired) {
      execute('DELETE FROM snoozed_emails WHERE id = ?', [snooze.id]);
    }

    if (expired.length > 0) {
      console.log(`${expired.length} lejárt szundi törölve.`);
    }

    return expired.length;
  } catch (error) {
    console.error('Lejárt szundik feldolgozása hiba:', error);
    return 0;
  }
}

export default router;
