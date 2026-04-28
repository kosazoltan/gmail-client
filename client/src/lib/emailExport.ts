import DOMPurify from 'dompurify';
import type { Email } from '../types';

function sanitizeFilename(value: string): string {
  return (
    value
      .split('')
      .map((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || '<>:"/\\|?*'.includes(character) ? ' ' : character;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'email'
  );
}

function escapeHeader(value: string | null | undefined): string {
  return (value || '').replace(/[\r\n]+/g, ' ').trim();
}

function formatAddress(name: string | null | undefined, email: string | null | undefined): string {
  const safeEmail = escapeHeader(email);
  const safeName = escapeHeader(name);

  if (!safeEmail) return safeName || 'unknown@example.invalid';
  if (!safeName || safeName === safeEmail) return safeEmail;
  return `"${safeName.replace(/"/g, '\\"')}" <${safeEmail}>`;
}

function htmlToPlainText(html: string): string {
  const element = document.createElement('div');
  element.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  return element.textContent || '';
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportEmailToEml(email: Email): void {
  const subject = escapeHeader(email.subject || '(Nincs tárgy)');
  const date = new Date(email.date).toUTCString();
  const from = formatAddress(email.fromName, email.from);
  const to = escapeHeader(email.to || '');
  const cc = escapeHeader(email.cc || '');
  const htmlBody = email.bodyHtml ? DOMPurify.sanitize(email.bodyHtml) : '';
  const textBody = email.body || (htmlBody ? htmlToPlainText(htmlBody) : email.snippet || '');
  const boundary = `zmail-${email.id}-${Date.now()}`;

  const headers = [
    'X-ZMail-Export: true',
    `Message-ID: <${escapeHeader(email.id)}@zmail.local>`,
    `Date: ${date}`,
    `From: ${from}`,
    to ? `To: ${to}` : null,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  const body = htmlBody
    ? [
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        textBody,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        htmlBody,
        '',
        `--${boundary}--`,
      ]
    : ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', textBody];

  const filename = `${sanitizeFilename(subject)}_${new Date(email.date).toISOString().slice(0, 10)}.eml`;
  downloadTextFile(filename, `${headers.join('\r\n')}\r\n${body.join('\r\n')}`, 'message/rfc822');
}
