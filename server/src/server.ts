import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createSessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { initializeDatabase } from './db/index.js';
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

const PORT = parseInt(process.env.PORT || '5000');

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

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Error handler
  app.use(errorHandler);

  // Háttér szinkronizálás indítása minden meglévő fiókhoz
  const existingAccounts = getAllAccounts();
  for (const account of existingAccounts) {
    logger.info(`Starting background sync for account: ${account.email}`);
    startBackgroundSync(account.id);
  }

  // Lejárt szundik feldolgozása percenként
  setInterval(() => {
    processExpiredSnoozes();
  }, 60000);

  // Első futtatás induláskor
  processExpiredSnoozes();

  app.listen(PORT, () => {
    logger.info(`Gmail client server running on port ${PORT}`);
    logger.info(`${existingAccounts.length} accounts loaded`);
  });
}

start().catch((err) => {
  logger.error('Server startup error', err);
  process.exit(1);
});
