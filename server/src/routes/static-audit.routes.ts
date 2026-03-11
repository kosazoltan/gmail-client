import { Router } from 'express';
import { runStaticAudit } from '../lib/static-audit.js';
import logger from '../utils/logger.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const results = await runStaticAudit();
    const allPass = results.every((r) => r.status !== 'fail');
    res.status(allPass ? 200 : 500).json({ ok: allPass, checks: results });
  } catch (err) {
    logger.error('Static audit failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
