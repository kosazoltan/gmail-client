import { createHmac, timingSafeEqual } from 'crypto';

const HMAC_SECRET = process.env.ERRORLOG_HMAC_SECRET ?? 'change-me-in-env-not-in-repo';
const FRESHNESS_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate an HMAC-SHA256 signature for a payload + timestamp.
 */
export function signPayload(payload: string, timestamp: number): string {
  return createHmac('sha256', HMAC_SECRET).update(`${timestamp}:${payload}`).digest('hex');
}

/**
 * Validate an HMAC signature with timing-safe compare and 24h freshness check.
 */
export function validateSignature(payload: string, timestamp: number, signature: string): boolean {
  // Freshness check
  if (Date.now() - timestamp > FRESHNESS_MS) return false;

  const expected = signPayload(payload, timestamp);

  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
