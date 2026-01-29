import { Router } from 'express';
import { searchEmails } from '../services/search.service.js';

const router = Router();

const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 500;

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: { query: { accountId?: string }; session: { activeAccountId?: string | null; accountIds?: string[] } }): string | null {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) return null;

  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// FTS query sanitization - speciális karakterek eltávolítása
function sanitizeFtsQuery(query: string): string {
  // FTS5 speciális karakterek escape-elése: " * - OR AND NOT ( )
  // Egyszerű megoldás: csak alfanumerikus és szóközök maradnak
  return query
    .replace(/[^\w\sáéíóöőúüű@.\-]/gi, ' ')
    .trim()
    .substring(0, MAX_QUERY_LENGTH);
}

// Keresés
router.get('/', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const rawQuery = req.query.q as string;
  if (!rawQuery) {
    res.status(400).json({ error: 'Keresési kifejezés kötelező (q paraméter)' });
    return;
  }

  const query = sanitizeFtsQuery(rawQuery);
  if (!query) {
    res.status(400).json({ error: 'Érvénytelen keresési kifejezés' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);

  const results = searchEmails({ accountId, query, page, limit });
  res.json(results);
});

export default router;
