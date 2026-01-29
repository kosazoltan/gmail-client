import { Router } from 'express';
import { searchEmails } from '../services/search.service.js';

const router = Router();

// Keresés
router.get('/', (req, res) => {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók' });
    return;
  }

  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'Keresési kifejezés kötelező (q paraméter)' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const results = searchEmails({ accountId, query, page, limit });
  res.json(results);
});

export default router;
