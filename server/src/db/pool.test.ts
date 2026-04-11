import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test the pure helper functions by inlining them (they're module-scoped, not exported)

function getValidatedPgSchema(envValue: string | undefined): string | null {
  const raw = envValue?.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(raw)) {
    throw new Error('FATAL: ZMAIL_PG_SCHEMA must be lowercase identifier');
  }
  return raw;
}

function appendLibpqCompatForSslMode(url: string): string {
  try {
    const u = new URL(url);
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (!sslmode || sslmode === 'verify-full' || sslmode === 'disable') return url;
    if (
      ['require', 'prefer', 'verify-ca'].includes(sslmode) &&
      !u.searchParams.has('uselibpqcompat')
    ) {
      u.searchParams.set('uselibpqcompat', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

describe('getValidatedPgSchema', () => {
  it('returns null for undefined', () => {
    expect(getValidatedPgSchema(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getValidatedPgSchema('')).toBeNull();
  });

  it('returns null for whitespace', () => {
    expect(getValidatedPgSchema('   ')).toBeNull();
  });

  it('returns valid schema name', () => {
    expect(getValidatedPgSchema('zmail')).toBe('zmail');
  });

  it('accepts underscored names', () => {
    expect(getValidatedPgSchema('my_schema_1')).toBe('my_schema_1');
  });

  it('rejects uppercase', () => {
    expect(() => getValidatedPgSchema('ZMail')).toThrow();
  });

  it('rejects starting with number', () => {
    expect(() => getValidatedPgSchema('1schema')).toThrow();
  });

  it('rejects special characters', () => {
    expect(() => getValidatedPgSchema('my-schema')).toThrow();
  });

  it('rejects SQL injection attempt', () => {
    expect(() => getValidatedPgSchema("'; DROP TABLE users; --")).toThrow();
  });

  it('trims whitespace before validation', () => {
    expect(getValidatedPgSchema('  zmail  ')).toBe('zmail');
  });
});

describe('appendLibpqCompatForSslMode', () => {
  it('returns URL unchanged when no sslmode', () => {
    const url = 'postgresql://user:pass@host:5432/db';
    expect(appendLibpqCompatForSslMode(url)).toBe(url);
  });

  it('returns URL unchanged for sslmode=disable', () => {
    const url = 'postgresql://user:pass@host:5432/db?sslmode=disable';
    expect(appendLibpqCompatForSslMode(url)).toBe(url);
  });

  it('returns URL unchanged for sslmode=verify-full', () => {
    const url = 'postgresql://user:pass@host:5432/db?sslmode=verify-full';
    expect(appendLibpqCompatForSslMode(url)).toBe(url);
  });

  it('appends uselibpqcompat for sslmode=require', () => {
    const url = 'postgresql://user:pass@host:5432/db?sslmode=require';
    const result = appendLibpqCompatForSslMode(url);
    expect(result).toContain('uselibpqcompat=true');
  });

  it('does not duplicate uselibpqcompat if already present', () => {
    const url = 'postgresql://user:pass@host:5432/db?sslmode=require&uselibpqcompat=true';
    const result = appendLibpqCompatForSslMode(url);
    const count = (result.match(/uselibpqcompat/g) || []).length;
    expect(count).toBe(1);
  });

  it('handles invalid URL gracefully', () => {
    expect(appendLibpqCompatForSslMode('not-a-url')).toBe('not-a-url');
  });
});
