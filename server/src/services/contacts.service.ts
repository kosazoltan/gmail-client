import logger from '../utils/logger.js';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, execute } from '../db/index.js';
import iconv from 'iconv-lite';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  frequency: number;
  last_used_at: number;
  account_id: string;
}

// Kontakt hozzáadása vagy frissítése (egyetlen atomi UPSERT — nincs SELECT+INSERT verseny, kevesebb round-trip)
export async function upsertContact(
  accountId: string,
  email: string,
  name?: string | null,
): Promise<Contact> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('upsertContact: érvénytelen email');
  }

  const id = uuid();
  const now = Date.now();
  const nameVal = name?.trim() ? name.trim() : null;

  const row = await queryOne<Contact>(
    `INSERT INTO contacts (id, email, name, frequency, last_used_at, account_id)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT (email, account_id) DO UPDATE SET
       frequency = contacts.frequency + 1,
       last_used_at = EXCLUDED.last_used_at,
       name = CASE
         WHEN EXCLUDED.name IS NOT NULL AND TRIM(EXCLUDED.name) <> ''
              AND (contacts.name IS NULL OR TRIM(COALESCE(contacts.name, '')) = '')
         THEN EXCLUDED.name
         ELSE contacts.name
       END
     RETURNING *`,
    [id, normalizedEmail, nameVal, now, accountId],
  );

  if (!row) {
    throw new Error('upsertContact: RETURNING üres sor');
  }
  return row;
}

// Kontaktok keresése autocomplete-hez
export async function searchContacts(
  accountId: string,
  query: string,
  limit = 10,
): Promise<Contact[]> {
  const searchQuery = `%${query.toLowerCase()}%`;

  return await queryAll<Contact>(
    `SELECT * FROM contacts
     WHERE account_id = ? AND (LOWER(email) LIKE ? OR LOWER(name) LIKE ?)
     ORDER BY frequency DESC, last_used_at DESC
     LIMIT ?`,
    [accountId, searchQuery, searchQuery, limit],
  );
}

// Összes kontakt lekérése (gyakoriság szerinti sorrendben)
export async function getAllContacts(accountId: string): Promise<Contact[]> {
  return await queryAll<Contact>(
    'SELECT * FROM contacts WHERE account_id = ? ORDER BY frequency DESC, last_used_at DESC',
    [accountId],
  );
}

// Email címek kinyerése egy email-ből
/** Szinkron / route handler: hiba esetén log, nem dob (ne omoljon össze a kérés) */
export async function safeUpsertContact(
  accountId: string,
  email: string,
  displayName?: string | null,
): Promise<void> {
  try {
    await upsertContact(accountId, email, displayName);
  } catch (err) {
    // Szinkron / tömeges feldolgozásnál ne dobjuk el az egész tranzakciót (timeout, Neon hálózat, stb.)
    logger.debug(`Contact upsert skipped (${email}):`, err);
  }
}

export async function extractContactsFromEmail(
  accountId: string,
  fromEmail: string | null,
  fromName: string | null,
  toEmail: string | null,
  ccEmail: string | null,
): Promise<void> {
  if (fromEmail) {
    await safeUpsertContact(accountId, fromEmail, fromName);
  }

  if (toEmail) {
    const toAddresses = parseEmailAddresses(toEmail);
    for (const addr of toAddresses) {
      await safeUpsertContact(accountId, addr.email, addr.name);
    }
  }

  if (ccEmail) {
    const ccAddresses = parseEmailAddresses(ccEmail);
    for (const addr of ccAddresses) {
      await safeUpsertContact(accountId, addr.email, addr.name);
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
        email: match[2].trim(),
      });
    } else if (trimmed.includes('@')) {
      // Csak email cím
      results.push({
        name: null,
        email: trimmed,
      });
    }
  }

  return results;
}

// Kontakt törlése
export async function deleteContact(accountId: string, contactId: string): Promise<boolean> {
  const existing = await queryOne<Contact>(
    'SELECT * FROM contacts WHERE id = ? AND account_id = ?',
    [contactId, accountId],
  );

  if (!existing) return false;

  await execute('DELETE FROM contacts WHERE id = ?', [contactId]);
  return true;
}

// Kontakt frissítése (név módosítása)
export async function updateContactName(
  accountId: string,
  contactId: string,
  name: string,
): Promise<Contact | null> {
  const existing = await queryOne<Contact>(
    'SELECT * FROM contacts WHERE id = ? AND account_id = ?',
    [contactId, accountId],
  );

  if (!existing) return null;

  await execute('UPDATE contacts SET name = ? WHERE id = ?', [name, contactId]);
  return { ...existing, name };
}

// Ellenőrzés, hogy van-e már kontakt kinyerve ehhez a fiókhoz
export async function hasExtractedContacts(accountId: string): Promise<boolean> {
  const result = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM contacts WHERE account_id = ?',
    [accountId],
  );
  return Number(result?.count ?? 0) > 0;
}

// Meglévő emailekből kontaktok kinyerése (egyszeri migráció)
export async function extractContactsFromExistingEmails(accountId: string): Promise<number> {
  interface EmailRow {
    from_email: string | null;
    from_name: string | null;
    to_email: string | null;
    cc_email: string | null;
  }

  const emails = await queryAll<EmailRow>(
    'SELECT from_email, from_name, to_email, cc_email FROM emails WHERE account_id = ?',
    [accountId],
  );

  let count = 0;
  for (const email of emails) {
    if (email.from_email) {
      await safeUpsertContact(accountId, email.from_email, email.from_name);
      count++;
    }
    if (email.to_email) {
      const toAddresses = parseEmailAddresses(email.to_email);
      count += toAddresses.length;
      for (const addr of toAddresses) {
        await safeUpsertContact(accountId, addr.email, addr.name);
      }
    }
    if (email.cc_email) {
      const ccAddresses = parseEmailAddresses(email.cc_email);
      count += ccAddresses.length;
      for (const addr of ccAddresses) {
        await safeUpsertContact(accountId, addr.email, addr.name);
      }
    }
  }

  return count;
}

// Utolsó kontakt kinyerés idejének tárolása (memóriában)
const lastExtractionTime = new Map<string, number>();

// Automatikus kontakt kinyerés (naponta egyszer vagy ha még nem történt meg)
export function autoExtractContactsIfNeeded(accountId: string): void {
  const now = Date.now();
  const lastExtraction = lastExtractionTime.get(accountId);
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Restart után lastExtraction undefined → mindig fut egyszer
  // Utána: naponta egyszer, VAGY ha kevés kontakt van (< 50)
  if (!lastExtraction || now - lastExtraction > oneDayMs) {
    // Check contact count async — if few contacts, always rebuild
    hasExtractedContacts(accountId)
      .then(async (hasContacts) => {
        const countResult = await queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM contacts WHERE account_id = ?',
          [accountId],
        );
        const count = Number(countResult?.count ?? 0);
        // Rebuild if no contacts, few contacts (< 50), or daily refresh
        if (
          !hasContacts ||
          count < 50 ||
          !lastExtraction ||
          now - (lastExtraction ?? 0) > oneDayMs
        ) {
          logger.info(`Kontaktok automatikus kinyerése (jelenlegi: ${count}): ${accountId}`);
          lastExtractionTime.set(accountId, now);
          extractContactsFromExistingEmails(accountId)
            .then((extracted) =>
              logger.info(
                `${extracted} email címből kontaktok kinyerve (összesen: ${count + extracted}).`,
              ),
            )
            .catch((err) => logger.error(`Kontakt kinyerés hiba (${accountId}):`, err));
        } else {
          lastExtractionTime.set(accountId, now);
        }
      })
      .catch((err) => logger.error(`Kontakt check hiba (${accountId}):`, err));
  }
}

// Mojibake javítása - UTF-8 bájtok latin1-ként értelmezve, majd újra UTF-8-ként
// Pl: "KÃ¡sza" -> "Kásza", "IldikÃ³" -> "Ildikó"
function fixMojibake(text: string): string {
  if (!text) return text;

  // Ellenőrizzük, hogy tartalmaz-e mojibake mintákat
  // Tipikus minták: Ã¡ (á), Ã© (é), Ã­ (í), Ã³ (ó), Ã¶ (ö), Å' (ő), Ãº (ú), Ã¼ (ü), Å± (ű)
  const mojibakePattern = /Ã[¡©­³¶º¼]|Å[±']/;
  if (!mojibakePattern.test(text)) {
    return text; // Nincs mojibake, visszaadjuk az eredetit
  }

  try {
    // A szöveg UTF-8 bájtjai latin1-ként lettek értelmezve
    // Visszaalakítjuk: latin1 -> bytes -> UTF-8
    const bytes = iconv.encode(text, 'latin1');
    const fixed = iconv.decode(bytes, 'utf-8');

    // Ellenőrizzük, hogy a javítás sikeres volt-e (nem tartalmaz replacement karaktert)
    if (!fixed.includes('\uFFFD') && fixed.length > 0) {
      return fixed;
    }
  } catch {
    // Ha hiba történt, visszaadjuk az eredetit
  }

  return text;
}

// Összes kontakt nevének javítása (mojibake fix)
export async function fixContactNamesEncoding(accountId: string): Promise<number> {
  const contacts = await queryAll<Contact>(
    'SELECT * FROM contacts WHERE account_id = ? AND name IS NOT NULL',
    [accountId],
  );

  let fixedCount = 0;

  for (const contact of contacts) {
    if (!contact.name) continue;

    const fixedName = fixMojibake(contact.name);

    if (fixedName !== contact.name) {
      await execute('UPDATE contacts SET name = ? WHERE id = ?', [fixedName, contact.id]);
      logger.info(`Kontakt név javítva: "${contact.name}" -> "${fixedName}"`);
      fixedCount++;
    }
  }

  return fixedCount;
}

// Összes sender_group nevének javítása (mojibake fix)
export async function fixSenderGroupNamesEncoding(accountId: string): Promise<number> {
  interface SenderGroup {
    id: string;
    name: string | null;
  }

  const groups = await queryAll<SenderGroup>(
    'SELECT id, name FROM sender_groups WHERE account_id = ? AND name IS NOT NULL',
    [accountId],
  );

  let fixedCount = 0;

  for (const group of groups) {
    if (!group.name) continue;

    const fixedName = fixMojibake(group.name);

    if (fixedName !== group.name) {
      await execute('UPDATE sender_groups SET name = ? WHERE id = ?', [fixedName, group.id]);
      logger.info(`Sender group név javítva: "${group.name}" -> "${fixedName}"`);
      fixedCount++;
    }
  }

  return fixedCount;
}

// Összes email from_name javítása (mojibake fix)
export async function fixEmailNamesEncoding(accountId: string): Promise<number> {
  interface EmailName {
    id: string;
    from_name: string | null;
  }

  const emails = await queryAll<EmailName>(
    'SELECT id, from_name FROM emails WHERE account_id = ? AND from_name IS NOT NULL',
    [accountId],
  );

  let fixedCount = 0;

  for (const email of emails) {
    if (!email.from_name) continue;

    const fixedName = fixMojibake(email.from_name);

    if (fixedName !== email.from_name) {
      await execute('UPDATE emails SET from_name = ? WHERE id = ?', [fixedName, email.id]);
      fixedCount++;
    }
  }

  return fixedCount;
}

// Minden név javítása egyszerre
export async function fixAllNamesEncoding(accountId: string): Promise<{
  contacts: number;
  senderGroups: number;
  emails: number;
}> {
  logger.info(`Karakterkódolás javítása a(z) ${accountId} fiókhoz...`);

  const contactsFixed = await fixContactNamesEncoding(accountId);
  const senderGroupsFixed = await fixSenderGroupNamesEncoding(accountId);
  const emailsFixed = await fixEmailNamesEncoding(accountId);

  logger.info(
    `Javítva: ${contactsFixed} kontakt, ${senderGroupsFixed} feladó csoport, ${emailsFixed} email`,
  );

  return {
    contacts: contactsFixed,
    senderGroups: senderGroupsFixed,
    emails: emailsFixed,
  };
}
