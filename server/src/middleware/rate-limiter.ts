import logger from '../utils/logger.js';

type QuotaBucket = { date: string; calls: number };
const quotaByAccount = new Map<string, QuotaBucket>();
const DAILY_LIMIT = 10000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function trackQuota(accountId: string): void {
  const key = todayKey();
  const current = quotaByAccount.get(accountId);
  if (!current || current.date !== key) {
    quotaByAccount.set(accountId, { date: key, calls: 1 });
    return;
  }
  current.calls += 1;
}

export function getQuotaUsage(accountId: string): {
  calls: number;
  limit: number;
  percent: number;
} {
  const key = todayKey();
  const current = quotaByAccount.get(accountId);
  const calls = !current || current.date !== key ? 0 : current.calls;
  const percent = Math.min(100, Math.round((calls / DAILY_LIMIT) * 100));
  return { calls, limit: DAILY_LIMIT, percent };
}

export async function withGmailBackoff<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const is429 = message.includes('429') || message.toLowerCase().includes('rate limit');
      if (!is429 || attempt >= maxRetries) {
        throw error;
      }
      const delayMs = Math.min(1000 * 2 ** attempt, 16000);
      logger.warn(`Gmail 429, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}
