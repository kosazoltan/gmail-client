import { describe, it, expect } from 'vitest';
import { isBotUserAgent } from '../bot-user-agent.js';

describe('isBotUserAgent (server-side)', () => {
  it('bingbot UA → true', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'),
    ).toBe(true);
  });

  it('googlebot UA → true', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe(true);
  });

  it('AhrefsBot UA → true', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'),
    ).toBe(true);
  });

  it('HeadlessChrome UA → true', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/136.0.0.0 Safari/537.36',
      ),
    ).toBe(true);
  });

  it('Playwright UA → true', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) playwright/1.0 Chrome/136.0.0.0 Safari/537.36',
      ),
    ).toBe(true);
  });

  it('normal Chrome UA → false', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('empty string → false', () => {
    expect(isBotUserAgent('')).toBe(false);
  });

  it('null → false', () => {
    expect(isBotUserAgent(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isBotUserAgent(undefined)).toBe(false);
  });

  it('2049-character UA → true (long-UA defense)', () => {
    const longUa = 'A'.repeat(2049);
    expect(isBotUserAgent(longUa)).toBe(true);
  });

  it('non-string (number) → false', () => {
    // @ts-expect-error intentional type violation for runtime guard test
    expect(isBotUserAgent(42)).toBe(false);
  });

  it('non-string (object) → false', () => {
    // @ts-expect-error intentional type violation for runtime guard test
    expect(isBotUserAgent({ ua: 'bingbot' })).toBe(false);
  });
});
