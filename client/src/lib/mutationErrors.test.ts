import { describe, it, expect } from 'vitest';
import { userVisibleApiError } from './mutationErrors';

describe('userVisibleApiError', () => {
  const fallback = 'Hiba történt';

  it('returns error message for Error with meaningful message', () => {
    const err = new Error('A fiók OAuth tokenje lejárt, jelentkezz be újra!');
    expect(userVisibleApiError(err, fallback)).toBe(
      'A fiók OAuth tokenje lejárt, jelentkezz be újra!',
    );
  });

  it('returns fallback for generic HTTP status error', () => {
    const err = new Error('HTTP 500');
    expect(userVisibleApiError(err, fallback)).toBe(fallback);
  });

  it('returns fallback for "Hálózati hiba"', () => {
    const err = new Error('Hálózati hiba');
    expect(userVisibleApiError(err, fallback)).toBe(fallback);
  });

  it('returns fallback for empty message', () => {
    const err = new Error('');
    expect(userVisibleApiError(err, fallback)).toBe(fallback);
  });

  it('returns fallback for non-Error', () => {
    expect(userVisibleApiError('string error', fallback)).toBe(fallback);
  });

  it('returns fallback for null', () => {
    expect(userVisibleApiError(null, fallback)).toBe(fallback);
  });

  it('returns fallback for undefined', () => {
    expect(userVisibleApiError(undefined, fallback)).toBe(fallback);
  });

  it('returns fallback for whitespace-only message', () => {
    const err = new Error('   ');
    expect(userVisibleApiError(err, fallback)).toBe(fallback);
  });
});
