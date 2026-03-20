import { Router } from 'express';
import { getAnalytics } from '../services/analytics.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

  try {
    const data = await getAnalytics(accountId);
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Nem sikerült lekérni az analytics adatokat' });
  }
});

export default router;
