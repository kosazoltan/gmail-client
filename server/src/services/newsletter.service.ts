import { queryAll, queryOne, execute } from '../db/index.js';

// Hírlevél detektálási minták
const NEWSLETTER_PATTERNS = {
  // Email cím minták
  emailPatterns: [
    /noreply@/i,
    /no-reply@/i,
    /newsletter@/i,
    /news@/i,
    /digest@/i,
    /updates@/i,
    /notifications@/i,
    /mailer@/i,
    /marketing@/i,
    /info@/i,
    /hello@/i,
  ],

  // Ismert hírlevél domain-ek
  knownDomains: [
    'substack.com',
    'mailchimp.com',
    'sendgrid.net',
    'mailgun.org',
    'constantcontact.com',
    'sendinblue.com',
    'klaviyo.com',
    'buttondown.email',
    'convertkit.com',
    'revue.email',
    'ghost.io',
    'beehiiv.com',
    'medium.com',
  ],

  // Tárgy minták
  subjectPatterns: [
    /newsletter/i,
    /digest/i,
    /weekly/i,
    /daily/i,
    /monthly/i,
    /issue\s*#?\d+/i,
    /edition/i,
    /update/i,
    /recap/i,
    /roundup/i,
  ],
};

export interface NewsletterSender {
  id: string;
  account_id: string;
  sender_email: string;
  sender_name: string | null;
  is_newsletter: number;
  is_muted: number;
  email_count: number;
  last_email_at: number | null;
}

// Ellenőrzi, hogy egy email hírlevél-e
export function isNewsletterEmail(
  fromEmail: string,
  fromName: string | null,
  subject: string | null,
): boolean {
  if (!fromEmail) return false;

  const emailLower = fromEmail.toLowerCase();
  const domain = emailLower.split('@')[1] || '';

  // Ismert hírlevél domain
  if (NEWSLETTER_PATTERNS.knownDomains.some((d) => domain.includes(d))) {
    return true;
  }

  // Email cím minta
  if (NEWSLETTER_PATTERNS.emailPatterns.some((p) => p.test(emailLower))) {
    return true;
  }

  // Tárgy minta
  if (subject && NEWSLETTER_PATTERNS.subjectPatterns.some((p) => p.test(subject))) {
    return true;
  }

  return false;
}

// Hírlevél küldők szinkronizálása az adatbázisból
export function syncNewsletterSenders(accountId: string): number {
  // Összesítjük az emaileket küldő szerint
  const senders = queryAll<{
    from_email: string;
    from_name: string | null;
    email_count: number;
    last_email_at: number;
    sample_subject: string | null;
  }>(
    `SELECT
       from_email,
       from_name,
       COUNT(*) as email_count,
       MAX(date) as last_email_at,
       (SELECT subject FROM emails e2 WHERE e2.from_email = emails.from_email AND e2.account_id = ? ORDER BY date DESC LIMIT 1) as sample_subject
     FROM emails
     WHERE account_id = ? AND from_email IS NOT NULL
     GROUP BY from_email
     HAVING email_count >= 3
     ORDER BY email_count DESC`,
    [accountId, accountId],
  );

  let detectedCount = 0;

  for (const sender of senders) {
    const isNewsletter = isNewsletterEmail(
      sender.from_email,
      sender.from_name,
      sender.sample_subject,
    );

    if (isNewsletter) {
      // Ellenőrizzük, hogy már létezik-e
      const existing = queryOne(
        'SELECT id FROM newsletter_senders WHERE account_id = ? AND sender_email = ?',
        [accountId, sender.from_email],
      );

      if (existing) {
        // Frissítjük a statisztikákat
        execute(
          `UPDATE newsletter_senders
           SET email_count = ?, last_email_at = ?, sender_name = COALESCE(?, sender_name)
           WHERE account_id = ? AND sender_email = ?`,
          [sender.email_count, sender.last_email_at, sender.from_name, accountId, sender.from_email],
        );
      } else {
        // Új hírlevél küldő
        const id = crypto.randomUUID();
        execute(
          `INSERT INTO newsletter_senders (id, account_id, sender_email, sender_name, is_newsletter, is_muted, email_count, last_email_at)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?)`,
          [id, accountId, sender.from_email, sender.from_name, sender.email_count, sender.last_email_at],
        );
        detectedCount++;
      }
    }
  }

  return detectedCount;
}

// Hírlevél küldők lekérése
export function getNewsletterSenders(accountId: string): NewsletterSender[] {
  return queryAll<NewsletterSender>(
    `SELECT * FROM newsletter_senders
     WHERE account_id = ? AND is_newsletter = 1
     ORDER BY email_count DESC`,
    [accountId],
  );
}

// Küldő némítása/feloldása
export function toggleMuteSender(accountId: string, senderId: string, muted: boolean): boolean {
  const sender = queryOne(
    'SELECT id FROM newsletter_senders WHERE id = ? AND account_id = ?',
    [senderId, accountId],
  );

  if (!sender) return false;

  execute('UPDATE newsletter_senders SET is_muted = ? WHERE id = ?', [muted ? 1 : 0, senderId]);
  return true;
}

// Küldő eltávolítása a hírlevél listából
export function removeSenderFromNewsletters(accountId: string, senderId: string): boolean {
  const sender = queryOne(
    'SELECT id FROM newsletter_senders WHERE id = ? AND account_id = ?',
    [senderId, accountId],
  );

  if (!sender) return false;

  execute('UPDATE newsletter_senders SET is_newsletter = 0 WHERE id = ?', [senderId]);
  return true;
}

// Hírlevél emailek lekérése
export function getNewsletterEmails(
  accountId: string,
  options: {
    page?: number;
    limit?: number;
    senderId?: string;
    includeMuted?: boolean;
  } = {},
) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  let whereClause = 'e.account_id = ? AND ns.is_newsletter = 1';
  const params: (string | number)[] = [accountId];

  if (!options.includeMuted) {
    whereClause += ' AND ns.is_muted = 0';
  }

  if (options.senderId) {
    whereClause += ' AND ns.id = ?';
    params.push(options.senderId);
  }

  const emails = queryAll(
    `SELECT e.*, ns.sender_name as newsletter_name, ns.is_muted
     FROM emails e
     JOIN newsletter_senders ns ON e.from_email = ns.sender_email AND e.account_id = ns.account_id
     WHERE ${whereClause}
     ORDER BY e.date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const totalResult = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM emails e
     JOIN newsletter_senders ns ON e.from_email = ns.sender_email AND e.account_id = ns.account_id
     WHERE ${whereClause}`,
    params,
  );

  const total = totalResult?.count || 0;

  return {
    emails,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
