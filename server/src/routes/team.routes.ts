import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

const TEAM_API_URL = process.env.TEAM_DASHBOARD_API || 'http://127.0.0.1:3460/api/dashboard';

// Proxy a lokális AI Team Dashboard API-hoz
router.get('/dashboard', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(TEAM_API_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Team API HTTP ${response.status}`);
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Team Dashboard API timeout');
      return res.status(503).json({ error: 'AI Team Dashboard API nem elérhető (időtúllépés)' });
    }

    logger.warn('Team Dashboard API not available:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'AI Team Dashboard API nem elérhető' });
  }
});

export default router;
