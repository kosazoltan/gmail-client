import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatEmailDate, formatRelativeTime } from './dateFormatter';

// Fix "now" for predictable tests
const FIXED_NOW = new Date('2026-04-11T14:00:00.000Z');

describe('formatEmailDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns time for today emails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const todayEmail = new Date('2026-04-11T10:30:00.000Z');
    const result = formatEmailDate(todayEmail);
    // Should be HH:MM format (locale-dependent, but contains digits + colon)
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns "Tegnap" for yesterday emails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const yesterday = new Date('2026-04-10T10:00:00.000Z');
    const result = formatEmailDate(yesterday);
    expect(result).toBe('Tegnap');
  });

  it('returns weekday name for this week emails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const threeDaysAgo = new Date('2026-04-08T10:00:00.000Z');
    const result = formatEmailDate(threeDaysAgo);
    // Should be a Hungarian weekday name (e.g., "szerda")
    expect(result.length).toBeGreaterThan(2);
    expect(result).not.toMatch(/\d{4}/); // Not a full date with year
  });

  it('returns "Ismeretlen dátum" for invalid date', () => {
    expect(formatEmailDate(NaN)).toBe('Ismeretlen dátum');
  });

  it('handles numeric timestamp input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const timestamp = new Date('2026-04-11T08:00:00.000Z').getTime();
    const result = formatEmailDate(timestamp);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns year for old emails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const oldEmail = new Date('2024-01-15T10:00:00.000Z');
    const result = formatEmailDate(oldEmail);
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Most" for just now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const justNow = new Date(FIXED_NOW.getTime() - 5000); // 5 seconds ago
    expect(formatRelativeTime(justNow)).toBe('Most');
  });

  it('returns minutes for recent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const fiveMinAgo = new Date(FIXED_NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 perce');
  });

  it('returns hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const threeHoursAgo = new Date(FIXED_NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3 órája');
  });

  it('returns days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const twoDaysAgo = new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2 napja');
  });

  it('returns weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const twoWeeksAgo = new Date(FIXED_NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2 hete');
  });

  it('handles numeric timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const ts = FIXED_NOW.getTime() - 10 * 60 * 1000;
    expect(formatRelativeTime(ts)).toBe('10 perce');
  });
});
