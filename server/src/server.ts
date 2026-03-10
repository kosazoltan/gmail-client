import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createSessionMiddleware, getSessionStore } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { deleteProtection } from './middleware/delete-protection.js';
import { initializeDatabase, closeDatabase, queryOne, execute } from './db/index.js';
import type { Server } from 'http';
import { startBackgroundSync, stopAllBackgroundSyncs } from './services/sync.service.js';
import { getAllAccounts } from './services/auth.service.js';
import { v4 as uuidv4 } from 'uuid';
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
import snoozeRoutes, { processExpiredSnoozes } from './routes/snooze.routes.js';
import remindersRoutes from './routes/reminders.routes.js';
import newslettersRoutes from './routes/newsletters.routes.js';
import labelsRoutes from './routes/labels.routes.js';
import pushRoutes from './routes/push.routes.js';
import pinnedRoutes from './routes/pinned.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import scheduledRoutes, { processScheduledEmails } from './routes/scheduled.routes.js';
import vipRoutes from './routes/vip.routes.js';
import translateRoutes from './routes/translate.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import marketRoutes from './routes/market.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import { processScheduledWorkflows } from './services/workflow.service.js';
import smartFeaturesRoutes from './routes/smart-features.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import smartFoldersRoutes from './routes/smart-folders.routes.js';
import aiChatRoutes from './routes/ai-chat.routes.js';
import detectedTasksRoutes from './routes/detected-tasks.routes.js';
import sseRoutes from './routes/sse.routes.js';
import briefRoutes, { generateAISummary } from './routes/brief.routes.js';
import { detectUnansweredEmails, processExpiredSnoozedTasks } from './services/task-detection.service.js';
import { buildAllowedOrigins } from './utils/cors-config.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

// Track intervals and server handle for graceful shutdown
let snoozeInterval: NodeJS.Timeout | null = null;
let scheduledInterval: NodeJS.Timeout | null = null;
let workflowInterval: NodeJS.Timeout | null = null;
let taskDetectionInterval: NodeJS.Timeout | null = null;
let dailyBriefInterval: NodeJS.Timeout | null = null;
let httpServer: Server | null = null;

/**
 * Lekéri az utolsó detekció idejét az adatbázisból.
 * Szerver restart után NE fusson le feleslegesen a 180 napos scan.
 */
async function getLastDetectionRun(): Promise<number> {
  const result = await queryOne<{ max_created: number }>('SELECT MAX(created_at) as max_created FROM detected_tasks');
  return result?.max_created || 0;
}

// Szerver indítás
async function start() {
  // Adatbázis inicializálás ELŐSZÖR (session store-nak szüksége van rá)
  await initializeDatabase();

  const app = express();
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    logger.warn('FRONTEND_URL environment variable is not set. Using default.');
  }

  // Security headers - lazább beállítások a mobil böngésző kompatibilitásért
  app.use(
    helmet({
      contentSecurityPolicy: false, // A Vite build már kezeli a CSP-t
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false, // Mobil böngészők kompatibilitás
      crossOriginResourcePolicy: false,
    }),
  );

  // CORS - több frontend origin támogatása (H1: shared config)
  const allowedOrigins = buildAllowedOrigins();

  // Log allowed origins at startup for debugging
  logger.info(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman)
        if (!origin) return callback(null, true);

        // Normalize origin for comparison (trim whitespace)
        const normalizedOrigin = origin.trim();

        if (allowedOrigins.includes(normalizedOrigin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: "${origin}" (normalized: "${normalizedOrigin}"). Allowed: ${allowedOrigins.join(', ')}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      maxAge: 86400, // Preflight cache: 24 óra
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
    }),
  );

  // Trust proxy (Cloudflare mögött)
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' })); // Limit request body size (was 10mb — OOM risk on 512MB Render)

  // Session middleware (SQLite store - adatbázis már inicializálva)
  app.use(createSessionMiddleware());

  // Delete protection middleware — logs and blocks dangerous deletions
  app.use(deleteProtection);

  // Routes
  app.use('/api/auth', authRoutes);
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

  // Health check
  app.get('/api/health', async (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Error handler
  app.use(errorHandler);

  // Háttér szinkronizálás indítása — 30s késleltetéssel, hogy a szerver előbb stabilan elinduljon
  const existingAccounts = await getAllAccounts();
  setTimeout(async () => {
    for (const account of existingAccounts) {
      try {
        logger.info(`Starting background sync for account: ${account.email}`);
        await startBackgroundSync(account.id);
      } catch (err) {
        logger.error(`Failed to start background sync for ${account.email}`, err);
      }
    }
    logger.info(`Background sync scheduled for ${existingAccounts.length} accounts (delayed 30s)`);
  }, 30000);

  // Lejárt szundik feldolgozása percenként
  // Clear any previous interval to prevent accumulation
  if (snoozeInterval) clearInterval(snoozeInterval);
  snoozeInterval = setInterval(async () => {
    try {
      await processExpiredSnoozes();
    } catch (error) {
      logger.error('Error processing expired snoozes:', error);
    }
  }, 60000);

  // Ütemezett emailek feldolgozása percenként
  if (scheduledInterval) clearInterval(scheduledInterval);
  scheduledInterval = setInterval(async () => {
    try {
      await processScheduledEmails();
    } catch (error) {
      logger.error('Error processing scheduled emails:', error);
    }
  }, 60000);

  // Ütemezett workflow-k feldolgozása percenként
  if (workflowInterval) clearInterval(workflowInterval);
  workflowInterval = setInterval(async () => {
    try {
      await processScheduledWorkflows();
    } catch (error) {
      logger.error('Error processing scheduled workflows:', error);
    }
  }, 60000);

  // Task detection — naponta 1×, 5 percenként ellenőrzi hogy eljött-e az idő
  // Ha van már detected_task az adatbázisban → 30 napos scan, egyébként 180 napos (6 hónap)
  if (taskDetectionInterval) clearInterval(taskDetectionInterval);
  taskDetectionInterval = setInterval(async () => {
    const now = Date.now();
    const lastRun = await getLastDetectionRun();
    if (now - lastRun > 24 * 60 * 60 * 1000) {
      const isFirstRun = lastRun === 0;
      const daysBack = isFirstRun ? 180 : 30;
      const accounts = await getAllAccounts();
      for (const account of accounts) {
        try {
          await detectUnansweredEmails(account.id, daysBack);
        } catch (err) {
          logger.error(`Task detection failed for ${account.email}:`, err);
        }
      }
      // Snoozed taskok feloldása
      try {
        await processExpiredSnoozedTasks();
      } catch (err) {
        logger.error('Snoozed task processing failed:', err);
      }
      logger.info(`Task detection completed for ${accounts.length} accounts (${daysBack} days back)`);
    }
  }, 300000); // 5 percenként check

  // Daily brief auto-generation — 8:00 Budapest timezone, check every 5 minutes
  if (dailyBriefInterval) clearInterval(dailyBriefInterval);
  let lastBriefDate = await (async () => {
    try {
      const row = await queryOne<{ date: string }>('SELECT date FROM daily_briefs ORDER BY generated_at DESC LIMIT 1');
      return row?.date || '';
    } catch { return ''; }
  })();
  dailyBriefInterval = setInterval(async () => {
    // Calculate Budapest time (CET/CEST)
    const now = new Date();
    const budapestTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
    const hour = budapestTime.getHours();
    const todayStr = budapestTime.toISOString().slice(0, 10);

    // Generate at 8:00, only once per day
    if (hour >= 8 && lastBriefDate !== todayStr) {
      lastBriefDate = todayStr;
      const accounts = await getAllAccounts();
      for (const account of accounts) {
        try {
          const result = await generateAISummary(account.id);
          await execute(
            `INSERT INTO daily_briefs (id, account_id, date, summary, highlights, action_items_count, urgent_count, total_emails, generated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(account_id, date) DO UPDATE SET
               summary = excluded.summary, highlights = excluded.highlights,
               action_items_count = excluded.action_items_count, urgent_count = excluded.urgent_count,
               total_emails = excluded.total_emails, generated_at = excluded.generated_at`,
            [uuidv4(), account.id, todayStr, result.summary, JSON.stringify(result.highlights), result.actionItemsCount, result.urgentCount, result.totalEmails, Date.now()],
          );
          logger.info(`Daily brief generated for ${account.email}`);
        } catch (err) {
          logger.error(`Daily brief failed for ${account.email}:`, err);
        }
      }
    }
  }, 300000); // Check every 5 minutes

  // Első futtatás 60s késleltetéssel — ne terhelje a startup-ot
  setTimeout(async () => {
    try {
      await processExpiredSnoozes();
    } catch (err) {
      logger.error('Initial snooze processing failed:', err);
    }
    try {
      await processScheduledEmails();
    } catch (err) {
      logger.error('Initial scheduled processing failed:', err);
    }
  }, 60000);

  // Memory monitoring — log usage every 5 minutes, force GC if over 350MB
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    if (heapMB > 300) {
      logger.warn(`High memory usage: heap=${heapMB}MB rss=${rssMB}MB`);
      if (global.gc) {
        global.gc();
        logger.info('Manual GC triggered');
      }
    }
  }, 300000);

  httpServer = app.listen(PORT, () => {
    logger.info(`Gmail client server running on port ${PORT}`);
    logger.info(`${existingAccounts.length} accounts loaded`);
    const usage = process.memoryUsage();
    logger.info(`Startup memory: heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB rss=${Math.round(usage.rss / 1024 / 1024)}MB`);
  });
}

// Graceful shutdown - adatbázis mentése kilépés előtt
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received. Shutting down gracefully...`);

  // Stop all background syncs
  stopAllBackgroundSyncs();

  // Clear periodic intervals
  if (snoozeInterval) {
    clearInterval(snoozeInterval);
    snoozeInterval = null;
  }
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
  }
  if (workflowInterval) {
    clearInterval(workflowInterval);
    workflowInterval = null;
  }
  if (taskDetectionInterval) {
    clearInterval(taskDetectionInterval);
    taskDetectionInterval = null;
  }
  if (dailyBriefInterval) {
    clearInterval(dailyBriefInterval);
    dailyBriefInterval = null;
  }

  // Stop session store cleanup
  const store = getSessionStore();
  if (store) {
    store.stopCleanup();
  }

  // Close database pool
  await closeDatabase();

  // Close HTTP server to stop accepting new connections, then exit
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed. Exiting.');
      process.exit(0);
    });
    // Force exit after 10 seconds if connections don't close
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout.');
      process.exit(0);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers - catch unhandled errors to prevent silent failures
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promiseInfo: String(promise) });
  // Do NOT exit - log for alerting but continue running
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - shutting down:', error);
  // Graceful shutdown on uncaught exceptions - close database first
  closeDatabase();
  process.exit(1);
});

start().catch((err) => {
  logger.error('Server startup error', err);
  process.exit(1);
});
