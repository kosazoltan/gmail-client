import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import { getGmailClient, sendEmail } from '../services/gmail.service.js';

const router = Router();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function validateEmailAddresses(addresses: string): string[] {
  const invalid: string[] = [];
  const emails = addresses.split(',').map(e => e.trim()).filter(e => e);
  for (const email of emails) {
    if (!isValidEmail(email)) {
      invalid.push(email);
    }
  }
  return invalid;
}

interface ScheduledEmailRow {
  id: string;
  account_id: string;
  to_addresses: string;
  cc_addresses: string | null;
  subject: string | null;
  body: string | null;
  scheduled_at: number;
  status: string;
  created_at: number;
}

// Get all scheduled emails
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const emails = queryAll<ScheduledEmailRow>(
      `SELECT * FROM scheduled_emails
       WHERE account_id = ? AND status = 'pending'
       ORDER BY scheduled_at ASC`,
      [accountId],
    );

    res.json({
      scheduledEmails: emails.map((e) => ({
        id: e.id,
        to: e.to_addresses,
        cc: e.cc_addresses,
        subject: e.subject,
        body: e.body,
        scheduledAt: e.scheduled_at,
        status: e.status,
        createdAt: e.created_at,
      })),
    });
  } catch (error) {
    console.error('Scheduled emails fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni az ütemezett emaileket' });
  }
});

// Schedule a new email
router.post('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { to, cc, subject, body, scheduledAt } = req.body;

    if (!to || !scheduledAt) {
      return res.status(400).json({ error: 'A címzett és az ütemezési idő megadása kötelező' });
    }

    // BUG #6 Fix: Validate email addresses
    const invalidEmails = validateEmailAddresses(to);
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: `Érvénytelen email cím(ek): ${invalidEmails.join(', ')}`
      });
    }
    if (cc) {
      const invalidCc = validateEmailAddresses(cc);
      if (invalidCc.length > 0) {
        return res.status(400).json({
          error: `Érvénytelen CC email cím(ek): ${invalidCc.join(', ')}`
        });
      }
    }

    // Validate scheduledAt timestamp
    const scheduledTimestamp = parseInt(scheduledAt, 10);
    const now = Date.now();
    const maxScheduleTime = now + 365 * 24 * 60 * 60 * 1000; // Max 1 year

    if (isNaN(scheduledTimestamp) || scheduledTimestamp <= now) {
      return res.status(400).json({ error: 'Érvénytelen időpont - jövőbeli időpontot adj meg' });
    }
    if (scheduledTimestamp > maxScheduleTime) {
      return res.status(400).json({ error: 'Túl távoli időpont - maximum 1 évre ütemezhető' });
    }

    const id = uuid();
    const createdAt = Date.now();

    execute(
      `INSERT INTO scheduled_emails (id, account_id, to_addresses, cc_addresses, subject, body, scheduled_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, accountId, to, cc || null, subject || null, body || null, scheduledTimestamp, createdAt],
    );

    res.json({
      id,
      to,
      cc,
      subject,
      body,
      scheduledAt: scheduledTimestamp,
      status: 'pending',
      createdAt,
    });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: 'Nem sikerült ütemezni az emailt' });
  }
});

// Update scheduled email
router.put('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { to, cc, subject, body, scheduledAt } = req.body;

    const existing = queryOne<ScheduledEmailRow>(
      'SELECT * FROM scheduled_emails WHERE id = ? AND account_id = ? AND status = ?',
      [id, accountId, 'pending'],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Ütemezett email nem található' });
    }

    // Validate if scheduledAt is provided
    if (scheduledAt) {
      const scheduledTimestamp = parseInt(scheduledAt, 10);
      const now = Date.now();
      if (isNaN(scheduledTimestamp) || scheduledTimestamp <= now) {
        return res.status(400).json({ error: 'Érvénytelen időpont' });
      }
    }

    execute(
      `UPDATE scheduled_emails
       SET to_addresses = ?, cc_addresses = ?, subject = ?, body = ?, scheduled_at = ?
       WHERE id = ? AND account_id = ?`,
      [
        to || existing.to_addresses,
        cc !== undefined ? cc : existing.cc_addresses,
        subject !== undefined ? subject : existing.subject,
        body !== undefined ? body : existing.body,
        scheduledAt ? parseInt(scheduledAt, 10) : existing.scheduled_at,
        id,
        accountId,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update scheduled email error:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni az ütemezett emailt' });
  }
});

// Cancel/delete scheduled email
router.delete('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM scheduled_emails WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Ütemezett email nem található' });
    }

    execute('DELETE FROM scheduled_emails WHERE id = ? AND account_id = ?', [id, accountId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete scheduled email error:', error);
    res.status(500).json({ error: 'Nem sikerült törölni az ütemezett emailt' });
  }
});

// Send now (convert scheduled to immediate send)
router.post('/:id/send-now', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const scheduled = queryOne<ScheduledEmailRow>(
      'SELECT * FROM scheduled_emails WHERE id = ? AND account_id = ? AND status = ?',
      [id, accountId, 'pending'],
    );

    if (!scheduled) {
      return res.status(404).json({ error: 'Ütemezett email nem található' });
    }

    // BUG #11 Fix: Proper auth error handling for send-now
    let oauth2Client;
    try {
      const authResult = getOAuth2ClientForAccount(accountId);
      oauth2Client = authResult.oauth2Client;
    } catch (authError) {
      console.error('Auth error in send-now:', authError);
      return res.status(401).json({ error: 'Hitelesítési hiba - jelentkezz be újra' });
    }

    // Mark as processing first to prevent race conditions
    execute(
      "UPDATE scheduled_emails SET status = 'processing' WHERE id = ?",
      [id],
    );

    const gmail = getGmailClient(oauth2Client);

    await sendEmail(gmail, {
      to: scheduled.to_addresses,
      subject: scheduled.subject || '',
      body: scheduled.body || '',
      cc: scheduled.cc_addresses || undefined,
    });

    // Mark as sent only after successful send
    execute(
      "UPDATE scheduled_emails SET status = 'sent' WHERE id = ?",
      [id],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Send now error:', error);
    res.status(500).json({ error: 'Nem sikerült elküldeni az emailt' });
  }
});

// Process scheduled emails that are due - called periodically
// FIX: Use unique instance ID to prevent race conditions across multiple server instances
export async function processScheduledEmails(): Promise<number> {
  try {
    const now = Date.now();
    const instanceId = uuid(); // Unique ID for this processing run

    // Atomically claim emails with unique instance ID
    // This ensures only this instance processes these specific emails
    execute(
      "UPDATE scheduled_emails SET status = 'processing', processing_instance = ? WHERE scheduled_at <= ? AND status = 'pending'",
      [instanceId, now],
    );

    // Get only the emails claimed by THIS instance
    const dueEmails = queryAll<ScheduledEmailRow>(
      "SELECT * FROM scheduled_emails WHERE status = 'processing' AND processing_instance = ?",
      [instanceId],
    );

    let sentCount = 0;

    for (const email of dueEmails) {
      try {
        // BUG #11 Fix: Wrap OAuth client retrieval in try-catch
        let oauth2Client;
        try {
          const authResult = getOAuth2ClientForAccount(email.account_id);
          oauth2Client = authResult.oauth2Client;
        } catch (authError) {
          console.error(`Auth error for scheduled email ${email.id}:`, authError);
          execute(
            "UPDATE scheduled_emails SET status = 'failed' WHERE id = ?",
            [email.id],
          );
          continue;
        }

        const gmail = getGmailClient(oauth2Client);

        await sendEmail(gmail, {
          to: email.to_addresses,
          subject: email.subject || '',
          body: email.body || '',
          cc: email.cc_addresses || undefined,
        });

        // Mark as sent only after successful send
        execute(
          "UPDATE scheduled_emails SET status = 'sent' WHERE id = ?",
          [email.id],
        );

        sentCount++;
        console.log(`Scheduled email ${email.id} sent successfully.`);
      } catch (error) {
        console.error(`Failed to send scheduled email ${email.id}:`, error);
        // Mark as failed
        execute(
          "UPDATE scheduled_emails SET status = 'failed' WHERE id = ?",
          [email.id],
        );
      }
    }

    if (sentCount > 0) {
      console.log(`${sentCount} scheduled email(s) sent.`);
    }

    return sentCount;
  } catch (error) {
    console.error('Process scheduled emails error:', error);
    return 0;
  }
}

export default router;
