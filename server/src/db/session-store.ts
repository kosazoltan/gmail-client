import session from 'express-session';
import { queryOne, queryAll, execute, getDb } from './index.js';
import logger from '../utils/logger.js';

interface SessionRow {
  sid: string;
  sess: string;
  expire: number;
}

export class SqliteSessionStore extends session.Store {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Lejárt session-ök törlése 15 percenként
    this.cleanupInterval = setInterval(() => {
      this.clearExpiredSessions();
    }, 15 * 60 * 1000);
  }

  private clearExpiredSessions() {
    try {
      const db = getDb();
      db.run('DELETE FROM sessions WHERE expire < ?', [Date.now()]);
    } catch (err) {
      logger.debug('Session cleanup error (non-critical)', { error: err });
    }
  }

  get(sid: string, callback: (err: Error | null, session?: session.SessionData | null) => void) {
    try {
      const row = queryOne<SessionRow>('SELECT sess, expire FROM sessions WHERE sid = ?', [sid]);

      if (!row) {
        return callback(null, null);
      }

      // Ellenőrizzük, hogy lejárt-e
      if (row.expire < Date.now()) {
        this.destroy(sid, () => {});
        return callback(null, null);
      }

      const sess = JSON.parse(row.sess) as session.SessionData;
      callback(null, sess);
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, session: session.SessionData, callback?: (err?: Error) => void) {
    try {
      const maxAge = session.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 nap default
      const expire = Date.now() + maxAge;
      const sess = JSON.stringify(session);

      // Atomi UPSERT művelet a race condition elkerülésére
      execute(
        `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
        [sid, sess, expire]
      );

      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error) => void) {
    try {
      execute('DELETE FROM sessions WHERE sid = ?', [sid]);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, session: session.SessionData, callback?: (err?: Error) => void) {
    try {
      const maxAge = session.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 nap default
      const expire = Date.now() + maxAge;
      const sess = JSON.stringify(session);
      // Frissítjük a session tartalmát és a lejárati időt is
      execute('UPDATE sessions SET sess = ?, expire = ? WHERE sid = ?', [sess, expire, sid]);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  length(callback: (err: Error | null, length?: number) => void) {
    try {
      const rows = queryAll<{ count: number }>('SELECT COUNT(*) as count FROM sessions WHERE expire >= ?', [Date.now()]);
      callback(null, rows[0]?.count || 0);
    } catch (err) {
      callback(err as Error);
    }
  }

  clear(callback?: (err?: Error) => void) {
    try {
      execute('DELETE FROM sessions');
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  all(callback: (err: Error | null, sessions?: session.SessionData[] | { [sid: string]: session.SessionData } | null) => void) {
    try {
      const rows = queryAll<SessionRow>('SELECT sid, sess FROM sessions WHERE expire >= ?', [Date.now()]);
      const sessions: { [sid: string]: session.SessionData } = {};

      for (const row of rows) {
        try {
          sessions[row.sid] = JSON.parse(row.sess);
        } catch {
          // Skip corrupted session data
          logger.warn('Corrupted session data for sid:', row.sid);
        }
      }

      callback(null, sessions);
    } catch (err) {
      callback(err as Error);
    }
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
