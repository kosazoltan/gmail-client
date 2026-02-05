import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createSessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { initializeDatabase, stopAutoSave, startAutoSave } from './db/index.js';
import { startBackgroundSync } from './services/sync.service.js';
import { getAllAccounts } from './services/auth.service.js';
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

const PORT = parseInt(process.env.PORT || '5000', 10);

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

  // CORS - csak a megadott frontend URL-ről engedélyezett
  app.use(
    cors({
      origin: frontendUrl || 'http://localhost:5173',
      credentials: true,
      maxAge: 86400, // Preflight cache: 24 óra
    }),
  );

  // Trust proxy (Cloudflare mögött)
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' })); // Limit request body size

  // Session middleware (SQLite store - adatbázis már inicializálva)
  app.use(createSessionMiddleware());

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

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Error handler
  app.use(errorHandler);

  // Háttér szinkronizálás indítása minden meglévő fiókhoz
  const existingAccounts = getAllAccounts();
  for (const account of existingAccounts) {
    try {
      logger.info(`Starting background sync for account: ${account.email}`);
      startBackgroundSync(account.id);
    } catch (err) {
      logger.error(`Failed to start background sync for ${account.email}`, err);
    }
  }

  // Lejárt szundik feldolgozása percenként
  // FIX: Add try-catch to prevent interval from breaking on errors
  setInterval(async () => {
    try {
      await processExpiredSnoozes();
    } catch (error) {
      logger.error('Error processing expired snoozes:', error);
    }
  }, 60000);

  // Ütemezett emailek feldolgozása percenként
  setInterval(async () => {
    try {
      await processScheduledEmails();
    } catch (error) {
      logger.error('Error processing scheduled emails:', error);
    }
  }, 60000);

  // Első futtatás induláskor (with error handling)
  try {
    processExpiredSnoozes();
  } catch (err) {
    logger.error('Initial snooze processing failed:', err);
  }

  (async () => {
    try {
      await processScheduledEmails();
    } catch (err) {
      logger.error('Initial scheduled processing failed:', err);
    }
  })();

  // Automatikus mentés indítása
  startAutoSave();

  app.listen(PORT, () => {
    logger.info(`Gmail client server running on port ${PORT}`);
    logger.info(`${existingAccounts.length} accounts loaded`);
  });
}

// Graceful shutdown - adatbázis mentése kilépés előtt
function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received. Saving database and shutting down...`);
  stopAutoSave();
  logger.info('Database saved. Exiting.');
  process.exit(0);
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
  // Graceful shutdown on uncaught exceptions - save database first
  stopAutoSave();
  process.exit(1);
});

start().catch((err) => {
  logger.error('Server startup error', err);
  process.exit(1);
});
