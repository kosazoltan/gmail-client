import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Safely extract message and stack from any error type
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(`[HIBA] ${message}`, stack || '');

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
}
