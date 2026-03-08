import session from 'express-session';
import { queryOne, queryAll, execute } from './index.js';
import logger from '../utils/logger.js';

interface SessionRow {
  sid: string;
  sess: string;
  expire: number;
}

export class PgSessionStore extends session.Store {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Lejárt session-ök törlése 15 percenként
    this.cleanupInterval = setInterval(
      () => {
        this.clearExpiredSessions();
      },
      15 * 60 * 1000,
    );
  }

  private async clearExpiredSessions() {
    try {
      await execute('DELETE FROM sessions WHERE expire < ?', [Date.now()]);
    } catch (err) {
      logger.debug('Session cleanup error (non-critical)', { error: err });
    }
  }

  get(sid: string, callback: (err: Error | null, session?: session.SessionData | null) => void) {
    queryOne<SessionRow>('SELECT sess, expire FROM sessions WHERE sid = ?', [sid])
      .then((row) => {
        if (!row) {
          return callback(null, null);
        }

        // Ellenőrizzük, hogy lejárt-e
        if (row.expire < Date.now()) {
          this.destroy(sid, (err) => {
            if (err) {
              logger.warn('Failed to destroy expired session', { sid, error: err });
            }
          });
          return callback(null, null);
        }

        const sess = JSON.parse(row.sess) as session.SessionData;
        callback(null, sess);
      })
      .catch((err) => callback(err as Error));
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: Error) => void) {
    const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 nap default
    const expire = Date.now() + maxAge;
    const sess = JSON.stringify(sessionData);

    execute(
      `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
      [sid, sess, expire],
    )
      .then(() => callback?.())
      .catch((err) => callback?.(err as Error));
  }

  destroy(sid: string, callback?: (err?: Error) => void) {
    execute('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => callback?.())
      .catch((err) => callback?.(err as Error));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: Error) => void) {
    const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 nap default
    const expire = Date.now() + maxAge;
    const sess = JSON.stringify(sessionData);
    execute('UPDATE sessions SET sess = ?, expire = ? WHERE sid = ?', [sess, expire, sid])
      .then(() => callback?.())
      .catch((err) => callback?.(err as Error));
  }

  length(callback: (err: Error | null, length?: number) => void) {
    queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sessions WHERE expire >= ?',
      [Date.now()],
    )
      .then((result) => callback(null, Number(result?.count ?? 0)))
      .catch((err) => callback(err as Error));
  }

  clear(callback?: (err?: Error) => void) {
    execute('DELETE FROM sessions')
      .then(() => callback?.())
      .catch((err) => callback?.(err as Error));
  }

  all(
    callback: (
      err: Error | null,
      sessions?: session.SessionData[] | { [sid: string]: session.SessionData } | null,
    ) => void,
  ) {
    queryAll<SessionRow>('SELECT sid, sess FROM sessions WHERE expire >= ?', [Date.now()])
      .then((rows) => {
        const sessions: { [sid: string]: session.SessionData } = {};
        for (const row of rows) {
          try {
            sessions[row.sid] = JSON.parse(row.sess);
          } catch {
            logger.warn('Corrupted session data for sid: ' + row.sid);
          }
        }
        callback(null, sessions);
      })
      .catch((err) => callback(err as Error));
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
