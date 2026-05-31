import { describe, it, expect } from 'vitest';
import {
  cn,
  formatFileSize,
  shortenEmail,
  displaySender,
  getInitials,
  emailToColor,
} from './utils';

describe('cn (className merge)', () => {
  it('merges simple classes', () => {
    expect(cn('p-2', 'm-4')).toBe('p-2 m-4');
  });

  it('handles conditional classes', () => {
    const isHidden = false;
    expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('handles decimal values', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('handles negative values', () => {
    expect(formatFileSize(-100)).toBe('0 B');
  });

  it('handles NaN', () => {
    expect(formatFileSize(NaN)).toBe('0 B');
  });

  it('handles Infinity', () => {
    expect(formatFileSize(Infinity)).toBe('0 B');
  });
});

describe('shortenEmail', () => {
  it('returns short emails unchanged', () => {
    expect(shortenEmail('test@mail.com')).toBe('test@mail.com');
  });

  it('shortens long local part', () => {
    const long = 'verylongemailaddressname@example.com'; // 36 chars > 30, local > 15
    const result = shortenEmail(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('...');
    expect(result).toContain('@example.com');
  });

  it('handles exactly 30 chars', () => {
    const exact = 'a'.repeat(20) + '@12345.com'; // 30 chars
    expect(shortenEmail(exact)).toBe(exact);
  });
});

describe('displaySender', () => {
  it('returns fromName when available', () => {
    expect(displaySender('John Doe', 'john@example.com')).toBe('John Doe');
  });

  it('falls back to email when no name', () => {
    expect(displaySender(null, 'john@example.com')).toBe('john@example.com');
  });

  it('falls back to email for empty name', () => {
    expect(displaySender('  ', 'john@example.com')).toBe('john@example.com');
  });

  it('returns unknown when both null', () => {
    expect(displaySender(null, null)).toBe('Ismeretlen küldő');
  });
});

describe('getInitials', () => {
  it('returns two initials for two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns first two chars for single word', () => {
    expect(getInitials('Admin')).toBe('AD');
  });

  it('handles three-word names (first + last)', () => {
    expect(getInitials('John Michael Doe')).toBe('JD');
  });

  it('returns ?? for empty string', () => {
    expect(getInitials('')).toBe('??');
  });

  it('returns ?? for whitespace only', () => {
    expect(getInitials('   ')).toBe('??');
  });

  it('uppercases initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });
});

describe('emailToColor', () => {
  it('returns consistent HSL for same email', () => {
    const color1 = emailToColor('test@example.com');
    const color2 = emailToColor('test@example.com');
    expect(color1).toBe(color2);
  });

  it('returns valid HSL format', () => {
    const color = emailToColor('user@test.com');
    expect(color).toMatch(/^hsl\(\d+, 48%, 46%\)$/);
  });

  it('generates different colors for different emails', () => {
    const c1 = emailToColor('alice@example.com');
    const c2 = emailToColor('bob@example.com');
    expect(c1).not.toBe(c2);
  });
});
