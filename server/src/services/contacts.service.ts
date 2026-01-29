import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, execute } from '../db/index.js';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  frequency: number;
  last_used_at: number;
  account_id: string;
}

// Kontakt hozzáadása vagy frissítése
export function upsertContact(accountId: string, email: string, name?: string | null): Contact {
  const normalizedEmail = email.toLowerCase().trim();

  // Ellenőrizzük, hogy létezik-e már
  const existing = queryOne<Contact>(
    'SELECT * FROM contacts WHERE email = ? AND account_id = ?',
    [normalizedEmail, accountId]
  );

  if (existing) {
    // Frissítjük a gyakoriságot és az utolsó használat idejét
    // Ha van új név és az régi üres, frissítjük
    const newName = name && !existing.name ? name : existing.name;
    execute(
      'UPDATE contacts SET frequency = frequency + 1, last_used_at = ?, name = ? WHERE id = ?',
      [Date.now(), newName, existing.id]
    );
    return { ...existing, frequency: existing.frequency + 1, last_used_at: Date.now(), name: newName };
  }

  // Új kontakt létrehozása
  const id = uuid();
  const now = Date.now();
  execute(
    'INSERT INTO contacts (id, email, name, frequency, last_used_at, account_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, normalizedEmail, name || null, 1, now, accountId]
  );

  return { id, email: normalizedEmail, name: name || null, frequency: 1, last_used_at: now, account_id: accountId };
}

// Kontaktok keresése autocomplete-hez
export function searchContacts(accountId: string, query: string, limit = 10): Contact[] {
  const searchQuery = `%${query.toLowerCase()}%`;

  return queryAll<Contact>(
    `SELECT * FROM contacts
     WHERE account_id = ? AND (LOWER(email) LIKE ? OR LOWER(name) LIKE ?)
     ORDER BY frequency DESC, last_used_at DESC
     LIMIT ?`,
    [accountId, searchQuery, searchQuery, limit]
  );
}

// Összes kontakt lekérése (gyakoriság szerinti sorrendben)
export function getAllContacts(accountId: string): Contact[] {
  return queryAll<Contact>(
    'SELECT * FROM contacts WHERE account_id = ? ORDER BY frequency DESC, last_used_at DESC',
    [accountId]
  );
}

// Email címek kinyerése egy email-ből
export function extractContactsFromEmail(
  accountId: string,
  fromEmail: string | null,
  fromName: string | null,
  toEmail: string | null,
  ccEmail: string | null
): void {
  // From cím feldolgozása
  if (fromEmail) {
    upsertContact(accountId, fromEmail, fromName);
  }

  // To címek feldolgozása (lehet több is, vesszővel elválasztva)
  if (toEmail) {
    const toAddresses = parseEmailAddresses(toEmail);
    for (const addr of toAddresses) {
      upsertContact(accountId, addr.email, addr.name);
    }
  }

  // CC címek feldolgozása
  if (ccEmail) {
    const ccAddresses = parseEmailAddresses(ccEmail);
    for (const addr of ccAddresses) {
      upsertContact(accountId, addr.email, addr.name);
    }
  }
}

// Email cím lista feldolgozása (pl. "John Doe <john@example.com>, jane@example.com")
function parseEmailAddresses(addressString: string): Array<{ email: string; name: string | null }> {
  const results: Array<{ email: string; name: string | null }> = [];

  // Vesszővel elválasztott címek
  const parts = addressString.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // "Name <email>" formátum
    const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      results.push({
        name: match[1].trim().replace(/^["']|["']$/g, ''), // Idézőjelek eltávolítása
        email: match[2].trim()
      });
    } else if (trimmed.includes('@')) {
      // Csak email cím
      results.push({
        name: null,
        email: trimmed
      });
    }
  }

  return results;
}

// Kontakt törlése
export function deleteContact(accountId: string, contactId: string): boolean {
  const existing = queryOne<Contact>(
    'SELECT * FROM contacts WHERE id = ? AND account_id = ?',
    [contactId, accountId]
  );

  if (!existing) return false;

  execute('DELETE FROM contacts WHERE id = ?', [contactId]);
  return true;
}

// Kontakt frissítése (név módosítása)
export function updateContactName(accountId: string, contactId: string, name: string): Contact | null {
  const existing = queryOne<Contact>(
    'SELECT * FROM contacts WHERE id = ? AND account_id = ?',
    [contactId, accountId]
  );

  if (!existing) return null;

  execute('UPDATE contacts SET name = ? WHERE id = ?', [name, contactId]);
  return { ...existing, name };
}

// Ellenőrzés, hogy van-e már kontakt kinyerve ehhez a fiókhoz
export function hasExtractedContacts(accountId: string): boolean {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM contacts WHERE account_id = ?',
    [accountId]
  );
  return (result?.count || 0) > 0;
}

// Meglévő emailekből kontaktok kinyerése (egyszeri migráció)
export function extractContactsFromExistingEmails(accountId: string): number {
  interface EmailRow {
    from_email: string | null;
    from_name: string | null;
    to_email: string | null;
    cc_email: string | null;
  }

  const emails = queryAll<EmailRow>(
    'SELECT from_email, from_name, to_email, cc_email FROM emails WHERE account_id = ?',
    [accountId]
  );

  let count = 0;
  for (const email of emails) {
    if (email.from_email) {
      upsertContact(accountId, email.from_email, email.from_name);
      count++;
    }
    if (email.to_email) {
      const toAddresses = parseEmailAddresses(email.to_email);
      count += toAddresses.length;
      for (const addr of toAddresses) {
        upsertContact(accountId, addr.email, addr.name);
      }
    }
    if (email.cc_email) {
      const ccAddresses = parseEmailAddresses(email.cc_email);
      count += ccAddresses.length;
      for (const addr of ccAddresses) {
        upsertContact(accountId, addr.email, addr.name);
      }
    }
  }

  return count;
}

// Automatikus kontakt kinyerés (csak ha még nem történt meg)
export function autoExtractContactsIfNeeded(accountId: string): void {
  if (!hasExtractedContacts(accountId)) {
    console.log(`Kontaktok automatikus kinyerése: ${accountId}`);
    const count = extractContactsFromExistingEmails(accountId);
    console.log(`${count} email címből kontaktok kinyerve.`);
  }
}
