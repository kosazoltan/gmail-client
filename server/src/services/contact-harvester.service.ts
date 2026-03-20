import { queryAll } from '../db/index.js';
import { parseEmailAddresses, upsertContact } from './contact.service.js';

interface EmailRow {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  cc_email: string | null;
  date: number | null;
}

async function harvestAddressList(accountId: string, addresses: string | null): Promise<number> {
  if (!addresses) return 0;
  const parsed = parseEmailAddresses(addresses);
  for (const item of parsed) {
    await upsertContact(accountId, item.email, item.name, 'email');
  }
  return parsed.length;
}

export async function harvestContactsFromEmailRows(
  accountId: string,
  emails: EmailRow[],
): Promise<number> {
  let processed = 0;

  for (const email of emails) {
    if (email.from_email) {
      await upsertContact(accountId, email.from_email, email.from_name, 'email');
      processed += 1;
    }

    processed += await harvestAddressList(accountId, email.to_email);
    processed += await harvestAddressList(accountId, email.cc_email);
  }

  return processed;
}

export async function harvestContactsForAccount(accountId: string): Promise<number> {
  const emails = await queryAll<EmailRow>(
    `SELECT id, from_email, from_name, to_email, cc_email, date
     FROM emails
     WHERE account_id = ?
     ORDER BY date DESC`,
    [accountId],
  );

  return harvestContactsFromEmailRows(accountId, emails);
}

export async function harvestContactsForNewEmails(
  accountId: string,
  emailIds: string[],
): Promise<number> {
  if (!emailIds.length) return 0;

  const placeholders = emailIds.map(() => '?').join(',');
  const emails = await queryAll<EmailRow>(
    `SELECT id, from_email, from_name, to_email, cc_email, date
     FROM emails
     WHERE account_id = ? AND id IN (${placeholders})`,
    [accountId, ...emailIds],
  );

  return harvestContactsFromEmailRows(accountId, emails);
}
