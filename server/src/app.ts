/**
 * Express application factory — middleware, routes, health check.
 * Separated from server.ts for testability and clarity.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createSessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { deleteProtection } from './middleware/delete-protection.js';
import { queryOne } from './db/index.js';
import logger from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import emailsRoutes from './routes/emails.routes.js';
import accountsRoutes from './routes/accounts.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import searchRoutes from './routes/search.routes.js';
import viewsRoutes from './routes/views.routes.js';
import attachmentsRoutes from './routes/attachments.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import databaseRoutes from './routes/database.routes.js';
import savedSearchesRoutes from './routes/saved-searches.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import snoozeRoutes from './routes/snooze.routes.js';
import remindersRoutes from './routes/reminders.routes.js';
import newslettersRoutes from './routes/newsletters.routes.js';
import labelsRoutes from './routes/labels.routes.js';
import pushRoutes from './routes/push.routes.js';
import pinnedRoutes from './routes/pinned.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import scheduledRoutes from './routes/scheduled.routes.js';
import vipRoutes from './routes/vip.routes.js';
import translateRoutes from './routes/translate.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import marketRoutes from './routes/market.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import smartFeaturesRoutes from './routes/smart-features.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import smartFoldersRoutes from './routes/smart-folders.routes.js';
import aiChatRoutes from './routes/ai-chat.routes.js';
import detectedTasksRoutes from './routes/detected-tasks.routes.js';
import sseRoutes from './routes/sse.routes.js';
import briefRoutes from './routes/brief.routes.js';
import invoiceAutomationRoutes from './routes/invoice-automation.routes.js';
import errorReportRoutes from './routes/error-report.routes.js';
import staticAuditRoutes from './routes/static-audit.routes.js';
import quotaRoutes from './routes/quota.routes.js';
import inboxRulesRoutes from './routes/inbox-rules.routes.js';
import auditRoutes from './routes/audit.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import { buildAllowedOrigins, isOriginAllowed } from './utils/cors-config.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { securityHeaders } from './middleware/security-headers.js';
import { getWatchdogHealthFailure } from './services/runtime-watchdog.service.js';
import { logAuditEvent } from './services/audit-log.service.js';
import { setupSwagger } from './utils/swagger.js';

const WATCHDOG_AUDIT_INTERVAL_MS = 300_000;
let lastWatchdogAuditAt = 0;

async function auditWatchdogFailureOnce(detail: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  if (now - lastWatchdogAuditAt < WATCHDOG_AUDIT_INTERVAL_MS) return;
  lastWatchdogAuditAt = now;
  try {
    await logAuditEvent({
      eventType: 'system_watchdog_overdue',
      details: detail,
    });
  } catch (e) {
    logger.error('[ZMAIL][WATCHDOG][AUDIT] audit_log írás sikertelen', e);
  }
}

export function createApp(): express.Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );

  // CORS
  const allowedOrigins = buildAllowedOrigins();
  logger.info(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: "${origin}". Allowed: ${allowedOrigins.join(', ')}`);
          callback(new Error(`Not allowed by CORS: origin "${origin}" not in allowed list`));
        }
      },
      credentials: true,
      maxAge: 86400,
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
    }),
  );

  // Core middleware
  app.use(requestIdMiddleware);
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(createSessionMiddleware());
  app.use(deleteProtection);
  app.use(securityHeaders);

  // Rate limiters
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, message: 'Túl sok auth kérés, próbáld újra 15 perc múlva.' },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 429, message: 'API rate limit elérve.' },
  });

  // Routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/emails', emailsRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/views', viewsRoutes);
  app.use('/api/attachments', attachmentsRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/database', databaseRoutes);
  app.use('/api/searches', savedSearchesRoutes);
  app.use('/api/templates', templatesRoutes);
  app.use('/api/snooze', snoozeRoutes);
  app.use('/api/reminders', remindersRoutes);
  app.use('/api/newsletters', newslettersRoutes);
  app.use('/api/labels', labelsRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/pinned', pinnedRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/scheduled', scheduledRoutes);
  app.use('/api/vip', vipRoutes);
  app.use('/api/translate', translateRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/smart', smartFeaturesRoutes);
  app.use('/api/intelligence', intelligenceRoutes);
  app.use('/api/smart-folders', smartFoldersRoutes);
  app.use('/api/ai', aiChatRoutes);
  app.use('/api/detected-tasks', detectedTasksRoutes);
  app.use('/api/sse', sseRoutes);
  app.use('/api/brief', briefRoutes);
  app.use('/api/invoice-automation', invoiceAutomationRoutes);
  app.use('/api/error-report', errorReportRoutes);
  app.use('/api/static-audit', staticAuditRoutes);
  app.use('/api/quota', quotaRoutes);
  app.use('/api/inbox-rules', inboxRulesRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // Swagger API docs (before health check, after routes)
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      await queryOne('SELECT 1 AS ok');
      const wd = await getWatchdogHealthFailure();
      if (wd) {
        logger.error('[ZMAIL][WATCHDOG][FAIL_CLOSED]', wd);
        await auditWatchdogFailureOnce({ code: wd.code, ...wd.detail });
        res.status(503).json({
          status: 'error',
          code: wd.code,
          error: wd.message,
          database: 'connected',
          timestamp: Date.now(),
        });
        return;
      }
      res.json({ status: 'ok', database: 'connected', timestamp: Date.now() });
    } catch (err) {
      logger.error('[ZMAIL][HEALTH][HEALTH_DATABASE_UNAVAILABLE]', err);
      res.status(503).json({
        status: 'error',
        code: 'HEALTH_DATABASE_UNAVAILABLE',
        error: 'Adatbázis nem elérhető — health check sikertelen.',
        database: 'unavailable',
        timestamp: Date.now(),
      });
    }
  });

  // Error handler — must be last
  app.use(errorHandler);

  return app;
}
