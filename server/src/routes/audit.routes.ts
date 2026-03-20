import { Router } from 'express';
import { getRecentAuditEvents } from '../services/audit-log.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 50;

  const events = await getRecentAuditEvents(accountId, limit);
  return res.json({ events });
});

export default router;
