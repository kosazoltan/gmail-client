/**
 * Egyszeri migráció: emails.to_email, emails.cc_email, emails.from_name mezőkben
 * maradt RFC 2047 encoded-word (=?charset?B|Q?...?=) dekódolása.
 *
 * Dupla dekódolás elkerülése: csak akkor futtatjuk a decodeRFC2047-et, ha a mezőben
 * van érvényes encoded-word minta; stabilizálás max. 5 passzal (ritka többrétegű kódolás).
 *
 * Futtatás: `cd server` + `.env` — `DATABASE_URL` (Render ugyanígy):
 *   cd server && npx tsx src/scripts/migrate-decode-rfc2047-email-fields.ts
 *
 * Száraz futás (nincs UPDATE):
 *   MIGRATE_DRY_RUN=1 npx tsx src/scripts/migrate-decode-rfc2047-email-fields.ts
 */
import 'dotenv/config';
import { queryAll, execute, getPool } from '../db/index.js';
import { decodeRFC2047 } from '../utils/mime-headers.js';

const ENCODED_WORD_RE = /=\?[^\s?]+\?[BbQq]\?[^?]*\?=/;

function containsEncodedWord(s: string | null | undefined): boolean {
  if (s == null || s === '') return false;
  return ENCODED_WORD_RE.test(s);
}

/** Csak akkor módosít, ha van mit dekódolni; max `maxPasses` kör (maradék encoded-word). */
function decodeFieldSafely(value: string | null, maxPasses = 5): string | null {
  if (value == null) return null;
  let cur = value;
  for (let p = 0; p < maxPasses; p++) {
    if (!containsEncodedWord(cur)) break;
    const next = decodeRFC2047(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

interface EmailRow {
  id: string;
  to_email: string | null;
  cc_email: string | null;
  from_name: string | null;
}

async function main() {
  const dryRun =
    process.env.MIGRATE_DRY_RUN === '1' ||
    process.env.MIGRATE_DRY_RUN === 'true' ||
    process.env.MIGRATE_DRY_RUN === 'yes';

  console.log(`[migrate-rfc2047] Indulás${dryRun ? ' (DRY RUN — nincs írás)' : ''}…`);

  const candidates = await queryAll<EmailRow>(
    `SELECT id, to_email, cc_email, from_name FROM emails
     WHERE to_email LIKE '%=?%' OR cc_email LIKE '%=?%' OR from_name LIKE '%=?%'`,
  );

  let examined = 0;
  let wouldUpdate = 0;
  let updated = 0;

  for (const row of candidates) {
    examined++;
    const newTo = decodeFieldSafely(row.to_email);
    const newCc = decodeFieldSafely(row.cc_email);
    const newFromName = decodeFieldSafely(row.from_name);

    const changed =
      newTo !== row.to_email || newCc !== row.cc_email || newFromName !== row.from_name;

    if (!changed) continue;

    wouldUpdate++;

    if (dryRun) {
      console.log(
        `[dry-run] ${row.id} | to_email: ${row.to_email !== newTo ? 'CHANGE' : '—'} | cc_email: ${row.cc_email !== newCc ? 'CHANGE' : '—'} | from_name: ${row.from_name !== newFromName ? 'CHANGE' : '—'}`,
      );
      continue;
    }

    await execute(`UPDATE emails SET to_email = ?, cc_email = ?, from_name = ? WHERE id = ?`, [
      newTo,
      newCc,
      newFromName,
      row.id,
    ]);
    updated++;
  }

  console.log(
    `[migrate-rfc2047] Kész. Jelölt sorok (LIKE '%=?%'): ${candidates.length}, vizsgált: ${examined}, változott: ${wouldUpdate}${dryRun ? '' : `, UPDATE: ${updated}`}`,
  );

  await getPool().end();
}

main().catch((err) => {
  console.error('[migrate-rfc2047] Hiba:', err);
  process.exitCode = 1;
  getPool()
    .end()
    .catch(() => {});
});
