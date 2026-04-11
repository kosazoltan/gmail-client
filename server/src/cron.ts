/**
 * Background jobs and scheduled tasks.
 * All setInterval-based recurring work lives here.
 */
import { v4 as uuidv4 } from 'uuid';
import logger from './utils/logger.js';
import { queryOne, execute } from './db/index.js';
import { processExpiredSnoozes } from './routes/snooze.routes.js';
import { processScheduledEmails } from './routes/scheduled.routes.js';
import { processScheduledWorkflows } from './services/workflow.service.js';
import { generateAISummary } from './routes/brief.routes.js';
import { runAiDigestScheduler } from './services/digest-scheduler.service.js';
import { runInvoiceAutomation } from './services/invoice-automation.service.js';
import {
  detectUnansweredEmails,
  processExpiredSnoozedTasks,
} from './services/task-detection.service.js';
import { touchCriticalJobsOk } from './services/runtime-watchdog.service.js';
import { startBackgroundSync, reprocessRecentOperationalSignals } from './services/sync.service.js';
import { getAllAccounts } from './services/auth.service.js';
import { hasStoredOAuthTokensForAccount } from './services/token-vault.service.js';

// Track intervals for graceful shutdown
let criticalJobsInterval: NodeJS.Timeout | null = null;
let workflowInterval: NodeJS.Timeout | null = null;
let taskDetectionInterval: NodeJS.Timeout | null = null;
let dailyBriefInterval: NodeJS.Timeout | null = null;
let operationalReprocessInterval: NodeJS.Timeout | null = null;

async function getLastDetectionRun(): Promise<number> {
  const result = await queryOne<{ max_created: number }>(
    'SELECT MAX(created_at) as max_created FROM detected_tasks',
  );
  return result?.max_created || 0;
}

/** Critical per-minute jobs: snooze + scheduled emails + watchdog heartbeat */
async function runCriticalEmailJobsAndHeartbeat(): Promise<void> {
  try {
    await processExpiredSnoozes();
  } catch (error) {
    logger.error('[ZMAIL][CRITICAL_JOB] processExpiredSnoozes hiba', error);
    return;
  }
  try {
    await processScheduledEmails();
  } catch (error) {
    logger.error('[ZMAIL][CRITICAL_JOB] processScheduledEmails hiba', error);
    return;
  }
  try {
    await touchCriticalJobsOk();
  } catch (error) {
    logger.error('[ZMAIL][WATCHDOG] touchCriticalJobsOk hiba', error);
  }
}

/**
 * Start all background jobs and sync.
 * @param frontendUrl - Used by digest scheduler for email links
 */
export async function startBackgroundJobs(frontendUrl: string | undefined): Promise<void> {
  // Load accounts for sync
  let existingAccounts = [] as Awaited<ReturnType<typeof getAllAccounts>>;
  try {
    existingAccounts = await getAllAccounts();
  } catch (error) {
    logger.error('Startup account preload failed; continuing without eager background sync', error);
  }

  // Immediate sync for accounts with stored OAuth tokens
  for (const account of existingAccounts) {
    if (!(await hasStoredOAuthTokensForAccount(account.id))) continue;
    syncAccount(account.id).catch((err: unknown) => {
      logger.error(`Startup immediate sync failed for ${account.email}`, err);
    });
  }

  // Delayed background sync (30s after startup)
  setTimeout(async () => {
    let oauthAccountCount = 0;
    for (const account of existingAccounts) {
      try {
        if (!(await hasStoredOAuthTokensForAccount(account.id))) continue;
        oauthAccountCount += 1;
        logger.info(`Háttérszinkron időzítő: ${account.email}`);
        await startBackgroundSync(account.id);
      } catch (err) {
        logger.error(`Failed to start background sync for ${account.email}`, err);
      }
    }
    if (oauthAccountCount === 0) {
      logger.info(
        'Háttérszinkron: nincs mentett OAuth token — intervallum nem indult (jelentkezz be a webappban).',
      );
    } else {
      logger.info(
        `Háttérszinkron ütemezve: ${oauthAccountCount} fiók (30s után, majd SYNC_INTERVAL_MS).`,
      );
    }
  }, 30000);

  // Critical per-minute jobs
  if (criticalJobsInterval) clearInterval(criticalJobsInterval);
  criticalJobsInterval = setInterval(() => {
    void runCriticalEmailJobsAndHeartbeat();
  }, 60000);

  // First critical tick 60s after startup
  setTimeout(() => {
    void runCriticalEmailJobsAndHeartbeat();
  }, 60000);

  // Workflow processing (every minute)
  if (workflowInterval) clearInterval(workflowInterval);
  workflowInterval = setInterval(async () => {
    try {
      await processScheduledWorkflows();
    } catch (error) {
      logger.error('Error processing scheduled workflows:', error);
    }
  }, 60000);

  // Task detection (check every 5 min, run daily)
  if (taskDetectionInterval) clearInterval(taskDetectionInterval);
  taskDetectionInterval = setInterval(async () => {
    try {
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
        try {
          await processExpiredSnoozedTasks();
        } catch (err) {
          logger.error('Snoozed task processing failed:', err);
        }
        logger.info(
          `Task detection completed for ${accounts.length} accounts (${daysBack} days back)`,
        );
      }
    } catch (err) {
      logger.error('Task detection interval error:', err);
    }
  }, 300000);

  // Daily brief + AI digest + invoice automation (check every 5 min)
  if (dailyBriefInterval) clearInterval(dailyBriefInterval);
  let lastBriefDate = await (async () => {
    try {
      const row = await queryOne<{ date: string }>(
        'SELECT date FROM daily_briefs ORDER BY generated_at DESC LIMIT 1',
      );
      return row?.date || '';
    } catch {
      return '';
    }
  })();
  dailyBriefInterval = setInterval(async () => {
    const now = new Date();
    const budapestTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
    const hour = budapestTime.getHours();
    const todayStr = budapestTime.toISOString().slice(0, 10);

    // Daily brief at 8:00 Budapest time
    if (hour >= 8 && lastBriefDate !== todayStr) {
      lastBriefDate = todayStr;
      try {
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
              [
                uuidv4(),
                account.id,
                todayStr,
                result.summary,
                JSON.stringify(result.highlights),
                result.actionItemsCount,
                result.urgentCount,
                result.totalEmails,
                Date.now(),
              ],
            );
            logger.info(`Daily brief generated for ${account.email}`);
          } catch (err) {
            logger.error(`Daily brief failed for ${account.email}:`, err);
          }
        }
      } catch (err) {
        logger.error('Daily brief: getAllAccounts() failed:', err);
        lastBriefDate = '';
      }
    }

    // AI digest scheduler (07:00 / 12:00 / 17:00 Budapest)
    try {
      const accounts = await getAllAccounts();
      await runAiDigestScheduler(accounts, frontendUrl);
    } catch (err) {
      logger.error('AI digest scheduler error:', err);
    }

    // Invoice automation
    try {
      const accounts = await getAllAccounts();
      await runInvoiceAutomation(accounts);
    } catch (err) {
      logger.error('Invoice automation error:', err);
    }
  }, 300000);

  // Operational AI reprocess (check every 15 min, run every 6h per account)
  if (operationalReprocessInterval) clearInterval(operationalReprocessInterval);
  operationalReprocessInterval = setInterval(async () => {
    try {
      const accounts = await getAllAccounts();
      for (const account of accounts) {
        try {
          const result = await reprocessRecentOperationalSignals(account.id, {
            daysBack: 30,
            maxEmails: 120,
            minIntervalMs: 6 * 60 * 60 * 1000,
          });
          if (!result.skipped && result.processed > 0) {
            logger.info(
              `Operational reprocess completed for ${account.email}: ${result.processed} emails`,
            );
          }
        } catch (err) {
          logger.error(`Operational reprocess failed for ${account.email}:`, err);
        }
      }
    } catch (err) {
      logger.error('Operational reprocess interval error:', err);
    }
  }, 900000);

  // Memory monitoring (every 5 min)
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
}

/** Stop all background jobs (graceful shutdown) */
export function stopBackgroundJobs(): void {
  if (criticalJobsInterval) {
    clearInterval(criticalJobsInterval);
    criticalJobsInterval = null;
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
  if (operationalReprocessInterval) {
    clearInterval(operationalReprocessInterval);
    operationalReprocessInterval = null;
  }
}

// Helper needed by sync — re-export syncAccount from sync.service
import { syncAccount } from './services/sync.service.js';
