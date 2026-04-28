/**
 * ErrorReporter — Global frontend error capture
 * - Breadcrumb ring buffer (last 30 events)
 * - Captures window.onerror and unhandledrejection
 * - Reports to /api/error-report
 *
 * Usage: import and call setupErrorReporter() in main.tsx BEFORE rendering the app.
 */

import { API_BASE } from '../lib/api';

const MAX_BREADCRUMBS = 30;

interface Breadcrumb {
  type: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

const breadcrumbs: Breadcrumb[] = [];

function addBreadcrumb(type: string, message: string, data?: unknown): void {
  breadcrumbs.push({ type, message, timestamp: new Date().toISOString(), data });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function sendReport(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({ ...payload, breadcrumbs: [...breadcrumbs] });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/error-report`,
        new Blob([body], { type: 'application/json' }),
      );
    } else {
      fetch(`${API_BASE}/error-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never throw from error reporter
  }
}

export function setupErrorReporter(): void {
  // Track navigation for breadcrumbs
  const origPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    addBreadcrumb('navigation', `pushState: ${args[2]}`);
    return origPushState(...args);
  };

  // Track clicks
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        addBreadcrumb(
          'ui',
          `click: ${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}`,
        );
      }
    },
    { capture: true, passive: true },
  );

  // Global JS errors
  window.addEventListener('error', (event) => {
    addBreadcrumb('error', event.message);
    sendReport({
      errorType: 'window_error',
      message: event.message,
      stack: event.error?.stack,
      url: event.filename || window.location.href,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    addBreadcrumb('error', `unhandledrejection: ${err.message}`);
    sendReport({
      errorType: 'unhandled_rejection',
      message: err.message,
      stack: err.stack,
      url: window.location.href,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });
}

/** Add a manual breadcrumb (e.g. from API calls) */
export function trackBreadcrumb(type: string, message: string, data?: unknown): void {
  addBreadcrumb(type, message, data);
}
