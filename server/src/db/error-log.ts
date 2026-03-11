import { execute } from './index.js';

/**
 * Ensure the error_logs table and its indexes exist.
 * Call this after initializeDatabase() in server.ts.
 */
export async function ensureErrorLogTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      fingerprint VARCHAR(32) NOT NULL UNIQUE,
      error_type VARCHAR(50) NOT NULL,
      severity VARCHAR(10) NOT NULL DEFAULT 'ERROR',
      message TEXT NOT NULL,
      stack TEXT,
      commit_sha VARCHAR(40),
      app_name VARCHAR(50) NOT NULL DEFAULT 'ZMail Gmail Kliens',
      repo_path VARCHAR(100) NOT NULL DEFAULT 'D:/repo/gmail-client',
      environment VARCHAR(20) NOT NULL DEFAULT 'production',
      breadcrumbs JSONB,
      url VARCHAR(500),
      request_id VARCHAR(100),
      request_method VARCHAR(10),
      request_body TEXT,
      user_id VARCHAR(100),
      user_email VARCHAR(200),
      browser VARCHAR(300),
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email_sent BOOLEAN NOT NULL DEFAULT false,
      email_sent_at TIMESTAMPTZ,
      resolved BOOLEAN NOT NULL DEFAULT false,
      resolved_at TIMESTAMPTZ,
      resolved_commit VARCHAR(40),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS error_logs_fingerprint_idx ON error_logs(fingerprint)`);
  await execute(`CREATE INDEX IF NOT EXISTS error_logs_severity_idx ON error_logs(severity)`);
  await execute(`CREATE INDEX IF NOT EXISTS error_logs_resolved_idx ON error_logs(resolved)`);
  await execute(`CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs(created_at)`);
}
