/**
 * Sentry error tracking initialization for the server.
 * Must be imported BEFORE any other modules in server.ts.
 */
import * as Sentry from '@sentry/node';
import logger from './logger.js';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || 'zmail-server@unknown';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!SENTRY_DSN) {
    logger.info('[Sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    // Filter out noisy errors
    beforeSend(event) {
      // Skip CORS errors (browser-originated, not actionable server-side)
      if (event.exception?.values?.some((v) => v.value?.includes('Not allowed by CORS'))) {
        return null;
      }
      return event;
    },
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  });

  initialized = true;
  logger.info(`[Sentry] Initialized (env=${SENTRY_ENVIRONMENT}, release=${SENTRY_RELEASE})`);
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

export { Sentry };
