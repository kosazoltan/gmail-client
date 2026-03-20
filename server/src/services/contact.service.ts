import { v4 as uuid } from 'uuid';
import { execute, queryAll, queryOne } from '../db/index.js';

export interface Contact {
  id: string;
  email: string;
  name: string | null;
  frequency: number;
  last_used_at: number;
  first_seen_at: number;
  source: string;
  created_at: number;
  updated_at: number;
  account_id: string;
}

interface ParsedAddress {
  email: string;
  name: string | null;
}

export function parseEmailAddresses(addressString: string): ParsedAddress[] {
  const results: ParsedAddress[] = [];
  const parts = addressString
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      results.push({
        name: match[1].trim().replace(/^["']|["']$/g, ''),
        email: match[2].trim().toLowerCase(),
      });
      continue;
    }

    if (part.includes('@')) {
      results.push({ email: part.toLowerCase(), name: null });
    }
  }

  return results;
}

export async function upsertContact(
  accountId: string,
  email: string,
  name?: string | null,
  source = 'email',
): Promise<Contact> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const normalizedName = name?.trim() ? name.trim() : null;

  const existing = await queryOne<Contact>(
    'SELECT * FROM contacts WHERE account_id = ? AND email = ?',
    [accountId, normalizedEmail],
  );

  if (existing) {
    const nextName = normalizedName || existing.name;
    await execute(
      `UPDATE contacts
       SET frequency = frequency + 1,
           last_used_at = ?,
           name = ?,
           updated_at = ?
       WHERE id = ?`,
      [now, nextName, now, existing.id],
    );

    return {
      ...existing,
      frequency: existing.frequency + 1,
      last_used_at: now,
      name: nextName,
      updated_at: now,
    };
  }

  const id = uuid();
  await execute(
    `INSERT INTO contacts (id, account_id, email, name, frequency, last_used_at, first_seen_at, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [id, accountId, normalizedEmail, normalizedName, now, now, source, now, now],
  );

  return {
    id,
    account_id: accountId,
    email: normalizedEmail,
    name: normalizedName,
    frequency: 1,
    last_used_at: now,
    first_seen_at: now,
    source,
    created_at: now,
    updated_at: now,
  };
}

export async function getContacts(
  accountId: string,
  query?: string,
  limit = 20,
): Promise<Contact[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  if (!query?.trim()) {
    return queryAll<Contact>(
      `SELECT * FROM contacts
       WHERE account_id = ?
       ORDER BY frequency DESC, last_used_at DESC
       LIMIT ?`,
      [accountId, safeLimit],
    );
  }

  const q = `%${query.trim().toLowerCase()}%`;
  return queryAll<Contact>(
    `SELECT * FROM contacts
     WHERE account_id = ? AND (LOWER(email) LIKE ? OR LOWER(COALESCE(name, '')) LIKE ?)
     ORDER BY frequency DESC, last_used_at DESC
     LIMIT ?`,
    [accountId, q, q, safeLimit],
  );
}

export async function getFrequentContacts(accountId: string, limit = 20): Promise<Contact[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  return queryAll<Contact>(
    `SELECT * FROM contacts
     WHERE account_id = ?
     ORDER BY frequency DESC, last_used_at DESC
     LIMIT ?`,
    [accountId, safeLimit],
  );
}

export async function searchContacts(
  accountId: string,
  query: string,
  limit = 20,
): Promise<Contact[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const q = `${query.trim().toLowerCase()}%`;
  return queryAll<Contact>(
    `SELECT * FROM contacts
     WHERE account_id = ?
       AND (LOWER(email) LIKE ? OR LOWER(COALESCE(name, '')) LIKE ?)
     ORDER BY frequency DESC, last_used_at DESC
     LIMIT ?`,
    [accountId, q, q, safeLimit],
  );
}

export async function addContact(
  accountId: string,
  email: string,
  name?: string | null,
): Promise<Contact> {
  return upsertContact(accountId, email, name, 'manual');
}

export async function deleteContact(accountId: string, contactId: string): Promise<boolean> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM contacts WHERE account_id = ? AND id = ?',
    [accountId, contactId],
  );
  if (!existing) return false;
  await execute('DELETE FROM contacts WHERE account_id = ? AND id = ?', [accountId, contactId]);
  return true;
}
