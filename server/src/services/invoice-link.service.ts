import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { normalizeInvoiceText } from './invoice-rules.service.js';

const MAX_LINK_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 4;

export interface InvoiceLinkCandidate {
  url: string;
  label: string;
  score: number;
  reasons: string[];
}

export interface InvoiceLinkDownloadResult {
  ok: boolean;
  status:
    | 'downloaded_pdf'
    | 'html_resolved_to_pdf'
    | 'unsafe_url'
    | 'http_error'
    | 'request_error'
    | 'too_large'
    | 'unsupported_content_type'
    | 'html_without_pdf'
    | 'invalid_pdf';
  detail: string;
  finalUrl: string;
  buffer?: Buffer;
  fileName?: string;
  contentType?: string | null;
  bytesCount: number;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;]+$/g, '');
}

export function normalizeInvoiceUrl(rawUrl: string): string {
  try {
    const url = new URL(stripTrailingPunctuation(rawUrl));
    for (const key of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return stripTrailingPunctuation(rawUrl);
  }
}

export function scoreInvoiceLinkWithReasons(
  url: string,
  label = '',
): { score: number; reasons: string[] } {
  const normalizedUrl = normalizeInvoiceText(url);
  const normalizedLabel = normalizeInvoiceText(label);
  const haystack = `${normalizedUrl} ${normalizedLabel}`;
  let score = 0;
  const reasons: string[] = [];

  for (const token of ['invoice', 'receipt', 'bill', 'billing', 'szamla', 'dijbekero']) {
    if (haystack.includes(token)) {
      score += 3;
      reasons.push(token);
    }
  }
  if (/\.pdf(?:\?|$)/i.test(url)) {
    score += 4;
    reasons.push('pdf_url');
  }
  if (/invoice\.stripe\.com|dashboard\.stripe\.com|pay\.stripe\.com/i.test(url)) {
    score += 5;
    reasons.push('stripe_invoice_domain');
  }
  if (/download|letoltes|view|megtekintes/i.test(haystack)) {
    score += 2;
    reasons.push('download_or_view');
  }

  return { score, reasons };
}

export function extractInvoiceLinkCandidates(htmlText = '', textBody = ''): InvoiceLinkCandidate[] {
  const candidates = new Map<string, InvoiceLinkCandidate>();
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of htmlText.matchAll(anchorRegex)) {
    const rawUrl = match[1];
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) continue;
    const label = (match[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const url = normalizeInvoiceUrl(rawUrl);
    const scored = scoreInvoiceLinkWithReasons(url, label);
    if (scored.score >= 6) candidates.set(url, { url, label, ...scored });
  }

  const raw = `${htmlText}\n${textBody}`;
  const regex = /https?:\/\/[^\s"'<>]+/gi;
  for (const match of raw.matchAll(regex)) {
    const url = normalizeInvoiceUrl(match[0]);
    const scored = scoreInvoiceLinkWithReasons(url, '');
    if (scored.score >= 6) candidates.set(url, { url, label: '', ...scored });
  }

  return Array.from(candidates.values()).sort((a, b) => b.score - a.score);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  const version = isIP(host);
  if (!version) return false;
  if (version === 4) {
    if (host.startsWith('10.') || host.startsWith('127.') || host.startsWith('192.168.'))
      return true;
    const second = Number(host.split('.')[1] || '0');
    return host.startsWith('172.') && second >= 16 && second <= 31;
  }
  return (
    host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
  );
}

export async function isSafePublicHttpsUrl(rawUrl: string): Promise<boolean> {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    if (isPrivateOrLocalHost(url.hostname)) return false;
    const resolved = await lookup(url.hostname, { all: true, verbatim: true });
    return resolved.length > 0 && resolved.every((entry) => !isPrivateOrLocalHost(entry.address));
  } catch {
    return false;
  }
}

function isPdfResponse(contentType: string | null, buffer: Buffer, finalUrl: string): boolean {
  const type = (contentType || '').toLowerCase();
  return (
    type.includes('application/pdf') ||
    buffer.subarray(0, 5).toString() === '%PDF-' ||
    /\.pdf(?:\?|$)/i.test(finalUrl)
  );
}

function isHtmlResponse(contentType: string | null, buffer: Buffer): boolean {
  const type = (contentType || '').toLowerCase();
  if (type.includes('text/html')) return true;
  const head = buffer.subarray(0, 300).toString('utf8').toLowerCase();
  return head.includes('<html') || head.includes('<!doctype html');
}

async function readLimited(response: Response): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_LINK_DOWNLOAD_BYTES) return null;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function fileNameFromHeaders(finalUrl: string, contentDisposition: string | null): string {
  const disposition = contentDisposition || '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const fromDisposition = decodeURIComponent(match?.[1] || match?.[2] || '').trim();
  const fromUrl = new URL(finalUrl).pathname.split('/').pop() || '';
  return (fromDisposition || fromUrl || `invoice-${Date.now()}.pdf`).replace(/[^\w.\-() ]/g, '_');
}

async function fetchFollowSafe(url: string, timeoutMs: number): Promise<Response | null> {
  let currentUrl = normalizeInvoiceUrl(url);
  if (!(await isSafePublicHttpsUrl(currentUrl))) return null;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(currentUrl, { redirect: 'manual', signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        const next = normalizeInvoiceUrl(new URL(location, currentUrl).toString());
        if (!(await isSafePublicHttpsUrl(next))) return null;
        currentUrl = next;
        continue;
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    if (!href) continue;
    const absolute = normalizeInvoiceUrl(new URL(href, baseUrl).toString());
    if (scoreInvoiceLinkWithReasons(absolute, match[2] || '').score >= 6) links.add(absolute);
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi)) {
    links.add(normalizeInvoiceUrl(match[0]));
  }
  return Array.from(links);
}

export async function downloadInvoiceFromLink(
  url: string,
  timeoutMs = 15_000,
): Promise<InvoiceLinkDownloadResult> {
  try {
    const response = await fetchFollowSafe(url, timeoutMs);
    if (!response) {
      return {
        ok: false,
        status: 'unsafe_url',
        detail: 'URL failed HTTPS/public-host validation',
        finalUrl: '',
        bytesCount: 0,
      };
    }
    const finalUrl = response.url || url;
    if (!response.ok) {
      return {
        ok: false,
        status: 'http_error',
        detail: `HTTP ${response.status}`,
        finalUrl,
        bytesCount: 0,
      };
    }
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_LINK_DOWNLOAD_BYTES) {
      return {
        ok: false,
        status: 'too_large',
        detail: `content-length=${contentLength}`,
        finalUrl,
        bytesCount: 0,
      };
    }
    const buffer = await readLimited(response);
    if (!buffer) {
      return {
        ok: false,
        status: 'too_large',
        detail: `size>${MAX_LINK_DOWNLOAD_BYTES}`,
        finalUrl,
        bytesCount: 0,
      };
    }
    const contentType = response.headers.get('content-type');
    if (isPdfResponse(contentType, buffer, finalUrl)) {
      return {
        ok: true,
        status: 'downloaded_pdf',
        detail: `${buffer.length} bytes`,
        finalUrl,
        buffer,
        fileName: fileNameFromHeaders(finalUrl, response.headers.get('content-disposition')),
        contentType: contentType || 'application/pdf',
        bytesCount: buffer.length,
      };
    }
    if (!isHtmlResponse(contentType, buffer)) {
      return {
        ok: false,
        status: 'unsupported_content_type',
        detail: `content_type=${contentType || ''}`,
        finalUrl,
        bytesCount: buffer.length,
      };
    }

    const html = buffer.toString('utf8');
    for (const discovered of extractPdfLinksFromHtml(html, finalUrl).slice(0, 5)) {
      const nested = await downloadInvoiceFromLink(discovered, timeoutMs);
      if (nested.ok) return { ...nested, status: 'html_resolved_to_pdf' };
    }
    return {
      ok: false,
      status: 'html_without_pdf',
      detail: 'No scored PDF invoice link found in HTML',
      finalUrl,
      bytesCount: buffer.length,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'request_error',
      detail: err instanceof Error ? err.message : String(err),
      finalUrl: '',
      bytesCount: 0,
    };
  }
}
