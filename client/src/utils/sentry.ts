/**
 * Sentry error tracking initialization for the React client.
 * Import and call initSentry() in main.tsx before React renders.
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENTRY_ENVIRONMENT = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || 'development';
const SENTRY_RELEASE = (import.meta.env.VITE_SENTRY_RELEASE as string) || 'zmail-client@unknown';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!SENTRY_DSN) {
    console.info('[Sentry] VITE_SENTRY_DSN not set — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  initialized = true;
  console.info(`[Sentry] Initialized (env=${SENTRY_ENVIRONMENT})`);
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export { Sentry };
