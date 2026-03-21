/**
 * Egyszeri séma létrehozás Neonon: `cd server && npx tsx src/scripts/init-neon-schema.ts`
 */
import 'dotenv/config';
import { initializeDatabase, closeDatabase } from '../db/index.js';

(async () => {
  try {
    await initializeDatabase();
    console.log('[init-neon-schema] Kész — táblák létrehozva / migrációk lefutottak.');
  } finally {
    await closeDatabase();
  }
})().catch((e) => {
  console.error('[init-neon-schema] Hiba:', e);
  process.exitCode = 1;
});
