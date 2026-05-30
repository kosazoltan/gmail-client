import { Router } from 'express';
import { sendErrorReport } from '../lib/error-mailer.js';
import logger from '../utils/logger.js';
import { isBotUserAgent } from '../utils/bot-user-agent.js';

const router = Router();

function validateString(val: unknown, max: number): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, max);
}

router.post('/', async (req, res) => {
  try {
    const ua = req.get('user-agent') || '';
    if (isBotUserAgent(ua)) {
      logger.debug(`[error-report] skipped bot UA: ${ua.slice(0, 200)}`);
      res.status(204).end();
      return;
    }

    // Stale chunk noise: lazyWithRetry auto-reloads once. If a client still POSTs
    // this signature it is almost always a crawler that slipped past UA detection
    // or a long-tail cache. Drop without mailing.
    const bodyMessage = typeof req.body?.message === 'string' ? req.body.message : '';
    if (
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk [\d]+ failed/i.test(
        bodyMessage,
      )
    ) {
      logger.debug(`[error-report] dropped stale-chunk report: ${bodyMessage.slice(0, 200)}`);
      res.status(204).end();
      return;
    }

    const requestId = req.headers['x-request-id'] as string | undefined;
    await sendErrorReport({
      errorType: validateString(req.body.errorType, 50) || 'unknown',
      message: validateString(req.body.message, 500) || 'Unknown error',
      stack: validateString(req.body.stack, 10000),
      url: validateString(req.body.url, 500),
      requestMethod: validateString(req.body.requestMethod, 10),
      requestBody: validateString(req.body.requestBody, 2000),
      userId: validateString(req.body.userId, 100),
      userEmail: validateString(req.body.userEmail, 200),
      browser: validateString(req.body.browser, 300),
      requestId,
      breadcrumbs: Array.isArray(req.body.breadcrumbs)
        ? req.body.breadcrumbs.slice(0, 50)
        : undefined,
      commitSha: validateString(req.body.commitSha, 40),
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error report handler failed:', err);
    res.status(500).json({ ok: false });
  }
});

export default router;
