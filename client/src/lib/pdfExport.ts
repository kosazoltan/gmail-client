import html2pdf from 'html2pdf.js';
import type { Email } from '../types';
import { formatFullDate } from './utils';

interface ExportOptions {
  includeAttachments?: boolean;
  filename?: string;
}

/**
 * Export an email to PDF format
 */
export async function exportEmailToPdf(email: Email, options: ExportOptions = {}): Promise<void> {
  const { filename } = options;

  // Create a container for the PDF content
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';

  // Header with email metadata
  const header = document.createElement('div');
  header.style.borderBottom = '2px solid #e5e7eb';
  header.style.paddingBottom = '15px';
  header.style.marginBottom = '20px';

  header.innerHTML = `
    <h1 style="font-size: 18px; color: #1f2937; margin: 0 0 15px 0; word-wrap: break-word;">
      ${escapeHtml(email.subject || '(Nincs tárgy)')}
    </h1>
    <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #6b7280;">
      <div><strong>Feladó:</strong> ${escapeHtml(email.fromName || '')} &lt;${escapeHtml(email.from || '')}&gt;</div>
      <div><strong>Címzett:</strong> ${escapeHtml(email.to || '')}</div>
      ${email.cc ? `<div><strong>Másolat:</strong> ${escapeHtml(email.cc)}</div>` : ''}
      <div><strong>Dátum:</strong> ${formatFullDate(email.date)}</div>
    </div>
  `;
  container.appendChild(header);

  // Email body
  const body = document.createElement('div');
  body.style.fontSize = '14px';
  body.style.lineHeight = '1.6';
  body.style.color = '#374151';

  if (email.bodyHtml) {
    // Use HTML body but sanitize it for PDF
    body.innerHTML = sanitizeForPdf(email.bodyHtml);
  } else if (email.body) {
    // Plain text body
    body.innerHTML = `<pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; margin: 0;">${escapeHtml(email.body)}</pre>`;
  } else {
    body.innerHTML = '<p style="color: #9ca3af; font-style: italic;">Nincs megjeleníthető tartalom</p>';
  }
  container.appendChild(body);

  // Attachments list (if any)
  if (email.attachments && email.attachments.length > 0) {
    const attachmentsSection = document.createElement('div');
    attachmentsSection.style.marginTop = '20px';
    attachmentsSection.style.paddingTop = '15px';
    attachmentsSection.style.borderTop = '1px solid #e5e7eb';

    const attachmentsList = email.attachments.map(att =>
      `<li style="margin: 5px 0; color: #6b7280; font-size: 12px;">${escapeHtml(att.filename)} (${formatFileSize(att.size)})</li>`
    ).join('');

    attachmentsSection.innerHTML = `
      <h3 style="font-size: 14px; color: #1f2937; margin: 0 0 10px 0;">Mellékletek (${email.attachments.length})</h3>
      <ul style="margin: 0; padding-left: 20px;">${attachmentsList}</ul>
    `;
    container.appendChild(attachmentsSection);
  }

  // Footer with export info
  const footer = document.createElement('div');
  footer.style.marginTop = '30px';
  footer.style.paddingTop = '10px';
  footer.style.borderTop = '1px solid #e5e7eb';
  footer.style.fontSize = '10px';
  footer.style.color = '#9ca3af';
  footer.style.textAlign = 'center';
  footer.innerHTML = `Exportálva: ${new Date().toLocaleString('hu-HU')} | ZMail`;
  container.appendChild(footer);

  // Generate PDF filename
  const sanitizedSubject = (email.subject || 'email')
    .replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ\s-]/g, '')
    .trim()
    .substring(0, 50);
  const pdfFilename = filename || `${sanitizedSubject}_${new Date().toISOString().split('T')[0]}.pdf`;

  // PDF generation options
  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: pdfFilename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  // Generate and download PDF
  try {
    await html2pdf().set(opt).from(container).save();
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDF exportálás sikertelen');
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML for PDF (remove scripts, external resources, etc.)
 */
function sanitizeForPdf(html: string): string {
  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  // Make images inline (data URLs work better in PDF)
  // Keep external images but they may not render in PDF

  // Limit image sizes for PDF
  sanitized = sanitized.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // Add max-width style if not present
    if (!attrs.includes('max-width')) {
      return `<img${attrs} style="max-width: 100%; height: auto;">`;
    }
    return match;
  });

  return sanitized;
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
  // FIX: Handle edge cases for 0, negative, and very small numbers
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
