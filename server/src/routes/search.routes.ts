import { Router } from 'express';
import { searchEmails, searchEmailsAllAccounts } from '../services/search.service.js';
import { getAllAccounts } from '../services/auth.service.js';
import logger from '../utils/logger.js';

const router = Router();

const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 500;
const CROSS_ACCOUNT_LIMIT = 50;

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: {
  query: { accountId?: string };
  session: { activeAccountId?: string | null; accountIds?: string[] };
}): string | null {
  const accountIds = req.session.accountIds || [];
  const fallbackAccountId = accountIds[0] || null;
  const accountId = (req.query.accountId as string) || req.session.activeAccountId || fallbackAccountId;
  if (!accountId) return null;

  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// FTS query sanitization - speciális karakterek és operátorok eltávolítása
function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\w\sáéíóöőúüű@.\-]/gi, ' ')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MAX_QUERY_LENGTH);
}

// Keresés — opcionális cross-account mód: ?allAccounts=true
router.get('/', async (req, res) => {
  const allAccounts = req.query.allAccounts === 'true';
  const rawQuery = req.query.q as string;
  logger.info('Search request', {
    allAccounts,
    hasQuery: Boolean(rawQuery),
    queryLength: rawQuery?.length || 0,
    activeAccountId: req.session.activeAccountId || null,
    sessionAccountCount: (req.session.accountIds || []).length,
    requestedAccountId: (req.query.accountId as string) || null,
  });

  // Cross-account keresés
  if (allAccounts) {
    const sessionAccountIds: string[] = req.session.accountIds || [];
    if (sessionAccountIds.length === 0) {
      res.status(400).json({ error: 'Nincs elérhető fiók a session-ben' });
      return;
    }

    if (!rawQuery) {
      res.status(400).json({ error: 'Keresési kifejezés kötelező (q paraméter)' });
      return;
    }

    const query = sanitizeFtsQuery(rawQuery);
    if (!query) {
      res.status(400).json({ error: 'Érvénytelen keresési kifejezés' });
      return;
    }

    // Build account info map for email/color enrichment
    const accounts = await getAllAccounts();
    const accountMap = new Map<string, { email: string; color: string | null }>();
    for (const acc of accounts) {
      if (sessionAccountIds.includes(acc.id)) {
        accountMap.set(acc.id, { email: acc.email, color: acc.color || null });
      }
    }

    const authorizedIds = sessionAccountIds.filter((id) => accountMap.has(id));

    const results = await searchEmailsAllAccounts({
      accountIds: authorizedIds,
      accountMap,
      query,
      limit: Math.min(
        parseInt(req.query.limit as string, 10) || CROSS_ACCOUNT_LIMIT,
        CROSS_ACCOUNT_LIMIT,
      ),
    });

    res.json(results);
    return;
  }

  // Single-account keresés (meglévő logika)
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  if (!rawQuery) {
    res.status(400).json({ error: 'Keresési kifejezés kötelező (q paraméter)' });
    return;
  }

  const query = sanitizeFtsQuery(rawQuery);
  if (!query) {
    res.status(400).json({ error: 'Érvénytelen keresési kifejezés' });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);

  const results = await searchEmails({ accountId, query, page, limit });
  res.json(results);
});

export default router;
