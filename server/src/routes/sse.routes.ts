import { Router } from 'express';
import type { Response } from 'express';
import logger from '../utils/logger.js';

const router = Router();

// Active SSE connections per account
const sseClients = new Map<string, Set<Response>>();

/**
 * Register a new SSE client for a given account.
 */
function addClient(accountId: string, res: Response) {
  if (!sseClients.has(accountId)) {
    sseClients.set(accountId, new Set());
  }
  const clients = sseClients.get(accountId)!;
  if (clients.size >= 5) {
    const oldest = clients.values().next().value;
    if (oldest) { oldest.end(); clients.delete(oldest); }
  }
  clients.add(res);
}

/**
 * Remove an SSE client on disconnect.
 */
function removeClient(accountId: string, res: Response) {
  const clients = sseClients.get(accountId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(accountId);
    }
  }
}

/**
 * Broadcast an event to all SSE clients for a given account.
 * Called by sync.service when new emails are discovered.
 */
export function broadcastNewEmail(
  accountId: string,
  data: {
    emailId: string;
    subject: string | null;
    from: string | null;
    fromName: string | null;
    date: number;
    snippet: string | null;
  },
) {
  const clients = sseClients.get(accountId);
  if (!clients || clients.size === 0) return;

  const payload = `event: new-email\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      logger.warn('SSE write failed, removing client', { accountId, error: err });
      removeClient(accountId, client);
    }
  }
}

/**
 * Broadcast a generic event to SSE clients.
 */
export function broadcastEvent(accountId: string, event: string, data: unknown) {
  const clients = sseClients.get(accountId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      removeClient(accountId, client);
    }
  }
}

// GET /api/sse/events — SSE stream for real-time updates
router.get('/events', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  const accountIds = req.session?.accountIds || [];

  if (!accountId || !accountIds.includes(accountId)) {
    return res.status(401).json({ error: 'Nincs bejelentkezve' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ accountId, timestamp: Date.now() })}\n\n`);

  // Register client
  addClient(accountId, res);
  logger.info(`SSE client connected for account ${accountId}. Total: ${sseClients.get(accountId)?.size || 0}`);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      removeClient(accountId, res);
    }
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(accountId, res);
    logger.info(`SSE client disconnected for account ${accountId}`);
  });
});

export default router;
