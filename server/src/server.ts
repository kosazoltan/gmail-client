/**
 * Server entry point — startup orchestration, DB init, graceful shutdown.
 * Express app: ./app.ts | Background jobs: ./cron.ts
 */
import 'dotenv/config';
import { initSentry, captureException } from './utils/sentry.js';
initSentry(); // Must initialize before other imports load
import type { Server } from 'http';
import logger from './utils/logger.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { createApp } from './app.js';
import { startBackgroundJobs, stopBackgroundJobs } from './cron.js';
import { stopAllBackgroundSyncs } from './services/sync.service.js';
import { getSessionStore } from './middleware/session.js';
import { ensureErrorLogTable } from './db/error-log.js';
import { ensureAuditLogTable } from './services/audit-log.service.js';
import {
  ensureRuntimeWatchdogTable,
  seedRuntimeWatchdogIfNeeded,
} from './services/runtime-watchdog.service.js';
import { assertProductionEnvironment } from './config/production-env.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const STARTUP_DB_RETRIES = 5;
const STARTUP_DB_RETRY_DELAY_MS = 5000;

let httpServer: Server | null = null;

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeDatabaseWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= STARTUP_DB_RETRIES; attempt++) {
    try {
      await initializeDatabase();
      if (attempt > 1) {
        logger.info(`Database initialization succeeded on retry ${attempt}/${STARTUP_DB_RETRIES}`);
      }
      return;
    } catch (error) {
      logger.error(
        `Database initialization failed (attempt ${attempt}/${STARTUP_DB_RETRIES})`,
        error,
      );
      if (attempt === STARTUP_DB_RETRIES) throw error;
      await wait(STARTUP_DB_RETRY_DELAY_MS * attempt);
    }
  }
}

async function start(): Promise<void> {
  assertProductionEnvironment();

  // Database initialization FIRST (session store needs it)
  await initializeDatabaseWithRetry();
  await ensureErrorLogTable();
  await ensureAuditLogTable();
  await ensureRuntimeWatchdogTable();
  await seedRuntimeWatchdogIfNeeded();

  // Create Express app
  const app = createApp();
  const frontendUrl = process.env.FRONTEND_URL;

  // Start HTTP server
  httpServer = app.listen(PORT, () => {
    logger.info(`Gmail client server running on port ${PORT}`);
    const usage = process.memoryUsage();
    logger.info(
      `Startup memory: heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB rss=${Math.round(usage.rss / 1024 / 1024)}MB`,
    );
  });

  httpServer.on('error', (err) => {
    logger.error('HTTP Server error:', err);
  });

  // Start background jobs
  await startBackgroundJobs(frontendUrl);
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} signal received. Shutting down gracefully...`);

  stopAllBackgroundSyncs();
  stopBackgroundJobs();

  const store = getSessionStore();
  if (store) store.stopCleanup();

  await closeDatabase();

  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed. Exiting.');
      process.exit(0);
    });
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

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promiseInfo: String(promise) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception (NOT exiting - attempting recovery):', error);
  logger.error('Exception stack:', error.stack);
});

start().catch((err) => {
  logger.error('Server startup error', err);
  process.exit(1);
});
