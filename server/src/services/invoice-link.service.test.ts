import { describe, expect, it } from 'vitest';
import {
  extractInvoiceLinkCandidates,
  isSafePublicHttpsUrl,
  normalizeInvoiceUrl,
  scoreInvoiceLinkWithReasons,
} from './invoice-link.service.js';

describe('invoice-link.service', () => {
  it('scores only invoice-like links high enough', () => {
    expect(
      scoreInvoiceLinkWithReasons('https://example.com/download', 'Download').score,
    ).toBeLessThan(6);
    expect(
      scoreInvoiceLinkWithReasons('https://invoice.stripe.com/i/acct_123', 'Invoice').score,
    ).toBeGreaterThanOrEqual(6);
    expect(
      scoreInvoiceLinkWithReasons('https://example.com/invoice.pdf', '').score,
    ).toBeGreaterThanOrEqual(6);
  });

  it('extracts and deduplicates invoice candidates from html and text', () => {
    const html =
      '<a href="https://example.com/files/invoice.pdf?utm_source=x">Download invoice</a>';
    const text = 'Same link: https://example.com/files/invoice.pdf?utm_source=x';
    const candidates = extractInvoiceLinkCandidates(html, text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].url).toBe('https://example.com/files/invoice.pdf');
    expect(candidates[0].score).toBeGreaterThanOrEqual(6);
  });

  it('normalizes tracking parameters from invoice urls', () => {
    expect(normalizeInvoiceUrl('https://example.com/invoice.pdf?utm_source=a&gclid=b&id=1')).toBe(
      'https://example.com/invoice.pdf?id=1',
    );
  });

  it('rejects non-https and private hosts before download', async () => {
    await expect(isSafePublicHttpsUrl('http://example.com/invoice.pdf')).resolves.toBe(false);
    await expect(isSafePublicHttpsUrl('https://127.0.0.1/invoice.pdf')).resolves.toBe(false);
    await expect(isSafePublicHttpsUrl('https://localhost/invoice.pdf')).resolves.toBe(false);
  });
});
