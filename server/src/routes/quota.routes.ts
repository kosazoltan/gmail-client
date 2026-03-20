import { Router } from 'express';
import { getQuotaUsage } from '../middleware/rate-limiter.js';

const router = Router();

router.get('/', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }
  return res.json({ quota: getQuotaUsage(accountId) });
});

export default router;
