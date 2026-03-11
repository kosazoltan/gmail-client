import logger from '../utils/logger.js';
import type { Request, Response, NextFunction } from 'express';
import { buildAllowedOrigins } from '../utils/cors-config.js';
import { sendErrorReport } from '../lib/error-mailer.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Ensures CORS headers are present on error responses.
 * Without this, Render cold-start 502s or unhandled 500s lack CORS headers,
 * causing the browser to block the response entirely as a CORS error.
 */
function setCorsHeadersOnError(req: Request, res: Response): void {
  // Only set if not already set (cors middleware may have already run)
  if (res.getHeader('Access-Control-Allow-Origin')) return;

  const origin = req.headers.origin;
  if (!origin) return;

  // H1: Use shared CORS config
  const allowedOrigins = buildAllowedOrigins();

  const normalizedOrigin = origin.trim();
  if (allowedOrigins.includes(normalizedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Safely extract message and stack from any error type
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error(`[HIBA] ${message}`, stack || '');

  // Ensure CORS headers are present even on error responses
  setCorsHeadersOnError(req, res);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Handle JSON parse errors from Express body parser
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Érvénytelen JSON formátum' });
    return;
  }

  // Never leak internal error details to the client
  res.status(500).json({ error: 'Belső szerverhiba' });

  // Async error report (non-blocking — never crash the request handler)
  sendErrorReport({
    errorType: 'api_error',
    message: message,
    stack: stack,
    url: req.originalUrl,
    requestMethod: req.method,
    requestId: req.headers['x-request-id'] as string | undefined,
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

// ─── Process-level error handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  sendErrorReport({
    errorType: 'uncaught_exception',
    severity: 'CRITICAL',
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  }).catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled Rejection:', err);
  sendErrorReport({
    errorType: 'unhandled_rejection',
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  }).catch(() => {});
});
