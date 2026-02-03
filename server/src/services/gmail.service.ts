import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import iconv from 'iconv-lite';
import logger from '../utils/logger.js';

// Gmail API wrapper
export function getGmailClient(auth: OAuth2Client): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth });
}

// Levelek listázása
export async function listMessages(
  gmail: gmail_v1.Gmail,
  options: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
  } = {},
) {
  const { query, maxResults = 50, pageToken, labelIds } = options;

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    pageToken,
    labelIds,
  });

  return {
    messages: response.data.messages || [],
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate,
  };
}

// Egy levél teljes lekérése
export async function getMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return parseMessage(response.data, gmail, messageId);
}

// Levél metaadatainak lekérése (gyorsabb, body nélkül)
export async function getMessageMetadata(gmail: gmail_v1.Gmail, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'],
  });

  return parseMessageMetadata(response.data);
}

// Üzenet feldolgozása
async function parseMessage(message: gmail_v1.Schema$Message, gmail?: gmail_v1.Gmail, messageId?: string) {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);

  // Body kinyerése
  const { text, html } = extractBody(message.payload);

  // Inline képek kinyerése
  const inlineImages = extractInlineImages(message.payload);

  // Inline képek letöltése, ha szükséges (nagyobb képeknél)
  if (gmail && messageId && inlineImages.length > 0) {
    for (const img of inlineImages) {
      if (!img.data && img.attachmentId) {
        try {
          const attachmentData = await getAttachment(gmail, messageId, img.attachmentId);
          // Buffer-t base64 string-gé alakítjuk
          img.data = attachmentData.data.toString('base64');
        } catch (err) {
          logger.warn('Failed to fetch inline image', { contentId: img.contentId, error: err });
        }
      }
    }
  }

  // HTML-ben a cid: referenciák cseréje base64 data URL-ekre
  const processedHtml = html && inlineImages.length > 0
    ? replaceCidReferences(html, inlineImages)
    : html;

  // Mellékletek
  const attachmentsList = extractAttachments(message.payload);

  // Subject dekódolása RFC 2047 formátumból
  const rawSubject = getHeader('Subject');
  const decodedSubject = decodeRFC2047(rawSubject);

  return {
    id: message.id!,
    threadId: message.threadId,
    subject: decodedSubject,
    from: fromEmail,
    fromName: fromName,
    to: decodeRFC2047(getHeader('To')),
    cc: decodeRFC2047(getHeader('Cc')),
    snippet: message.snippet,
    body: text,
    bodyHtml: processedHtml,
    date: parseInt(message.internalDate || '0', 10),
    isRead: !message.labelIds?.includes('UNREAD'),
    isStarred: message.labelIds?.includes('STARRED') || false,
    labels: message.labelIds || [],
    hasAttachments: attachmentsList.length > 0,
    attachments: attachmentsList,
  };
}

function parseMessageMetadata(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);

  // Subject dekódolása RFC 2047 formátumból
  const rawSubject = getHeader('Subject');
  const decodedSubject = decodeRFC2047(rawSubject);

  return {
    id: message.id!,
    threadId: message.threadId,
    subject: decodedSubject,
    from: fromEmail,
    fromName: fromName,
    to: decodeRFC2047(getHeader('To')),
    cc: decodeRFC2047(getHeader('Cc')),
    snippet: message.snippet,
    date: parseInt(message.internalDate || '0', 10),
    isRead: !message.labelIds?.includes('UNREAD'),
    isStarred: message.labelIds?.includes('STARRED') || false,
    labels: message.labelIds || [],
    hasAttachments: (message.payload?.parts || []).some(
      (p) => p.filename && p.filename.length > 0,
    ),
  };
}

// RFC 2047 MIME encoded-word dekódolás (=?charset?encoding?text?= formátum)
function decodeRFC2047(text: string): string {
  if (!text) return text;

  // RFC 2047 encoded-word pattern: =?charset?encoding?encoded_text?=
  const encodedWordPattern = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

  return text.replace(encodedWordPattern, (match, charset, encoding, encodedText) => {
    try {
      const upperEncoding = encoding.toUpperCase();
      let decoded: Buffer;

      if (upperEncoding === 'B') {
        // Base64 kódolás
        decoded = Buffer.from(encodedText, 'base64');
      } else if (upperEncoding === 'Q') {
        // Quoted-printable kódolás
        // Az underscore space-t jelent a Q kódolásban
        const normalized = encodedText.replace(/_/g, ' ');
        // =XX hexadecimális kódokat dekódolunk
        const bytes: number[] = [];
        let i = 0;
        while (i < normalized.length) {
          if (normalized[i] === '=' && i + 2 < normalized.length) {
            const hex = normalized.substring(i + 1, i + 3);
            const byte = parseInt(hex, 16);
            if (!isNaN(byte)) {
              bytes.push(byte);
              i += 3;
              continue;
            }
          }
          bytes.push(normalized.charCodeAt(i));
          i++;
        }
        decoded = Buffer.from(bytes);
      } else {
        return match; // Ismeretlen kódolás, marad az eredeti
      }

      // Charset alapján dekódolás - iconv-lite használata a speciális kódolásokhoz
      const lowerCharset = charset.toLowerCase().replace(/[_-]/g, '');

      // UTF-8
      if (lowerCharset === 'utf8') {
        return decoded.toString('utf-8');
      }

      // ISO-8859-1 / Latin1 (nyugat-európai)
      if (lowerCharset === 'iso88591' || lowerCharset === 'latin1') {
        return decoded.toString('latin1');
      }

      // ISO-8859-2 / Latin2 (közép-európai: magyar, lengyel, cseh, stb.)
      if (lowerCharset === 'iso88592' || lowerCharset === 'latin2') {
        return iconv.decode(decoded, 'iso-8859-2');
      }

      // Windows-1250 (közép-európai Windows kódolás)
      if (lowerCharset === 'windows1250' || lowerCharset === 'cp1250') {
        return iconv.decode(decoded, 'windows-1250');
      }

      // Windows-1252 (nyugat-európai Windows kódolás)
      if (lowerCharset === 'windows1252' || lowerCharset === 'cp1252') {
        return iconv.decode(decoded, 'windows-1252');
      }

      // ISO-8859-15 / Latin9 (nyugat-európai € jellel)
      if (lowerCharset === 'iso885915' || lowerCharset === 'latin9') {
        return iconv.decode(decoded, 'iso-8859-15');
      }

      // KOI8-R (orosz)
      if (lowerCharset === 'koi8r') {
        return iconv.decode(decoded, 'koi8-r');
      }

      // Windows-1251 (cirill)
      if (lowerCharset === 'windows1251' || lowerCharset === 'cp1251') {
        return iconv.decode(decoded, 'windows-1251');
      }

      // Ha ismert a kódolás az iconv-lite-nak, próbáljuk meg
      if (iconv.encodingExists(charset)) {
        return iconv.decode(decoded, charset);
      }

      // Alapértelmezett: UTF-8
      return decoded.toString('utf-8');
    } catch (err) {
      logger.warn('RFC2047 decode failed', { match, error: err });
      return match; // Hiba esetén marad az eredeti
    }
  });
}

// Email cím és név szétbontása: "Név <email>" formátumból
function parseEmailAddress(raw: string): { email: string; name: string } {
  // Először dekódoljuk az esetleges MIME kódolt részeket
  const decoded = decodeRFC2047(raw);
  const match = decoded.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { email: decoded, name: '' };
}

// Body kinyerése a MIME struktúrából
function extractBody(payload?: gmail_v1.Schema$MessagePart | null): {
  text: string;
  html: string;
} {
  let text = '';
  let html = '';

  if (!payload) return { text, html };

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    text = decodeBase64(payload.body.data);
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64(part.body.data);
      } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
        const nested = extractBody(part);
        if (nested.text) text = nested.text;
        if (nested.html) html = nested.html;
      }
    }
  }

  return { text, html };
}

// Inline képek típusa (Content-ID és adat)
export interface InlineImage {
  contentId: string;
  mimeType: string;
  data?: string; // base64 encoded (ha közvetlenül elérhető)
  attachmentId?: string; // ha nagyobb, külön le kell tölteni
}

// Inline képek kinyerése (cid: referenciákhoz)
function extractInlineImages(
  payload?: gmail_v1.Schema$MessagePart | null,
): InlineImage[] {
  const result: InlineImage[] = [];

  if (!payload) return result;

  const headers = payload.headers || [];
  const contentId = headers.find(h => h.name?.toLowerCase() === 'content-id')?.value;
  const contentDisposition = headers.find(h => h.name?.toLowerCase() === 'content-disposition')?.value || '';
  const isInline = contentDisposition.toLowerCase().includes('inline') || contentId;

  // Ha van Content-ID és inline kép
  if (contentId && isInline && payload.mimeType?.startsWith('image/')) {
    // Content-ID: <xxx> formátumból kinyerjük az xxx-et
    const cid = contentId.replace(/^<|>$/g, '');

    if (payload.body?.data) {
      // Kisebb inline képek: közvetlenül tartalmazza az adatot
      result.push({
        contentId: cid,
        mimeType: payload.mimeType,
        data: payload.body.data,
      });
    } else if (payload.body?.attachmentId) {
      // Nagyobb inline képek: attachmentId-vel kell letölteni
      result.push({
        contentId: cid,
        mimeType: payload.mimeType,
        attachmentId: payload.body.attachmentId,
      });
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      result.push(...extractInlineImages(part));
    }
  }

  return result;
}

// FIX: Valid MIME types for inline images to prevent injection
const VALID_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/tiff',
]);

// HTML body-ban a cid: referenciák cseréje base64 data URL-ekre
function replaceCidReferences(html: string, inlineImages: InlineImage[]): string {
  let result = html;

  for (const img of inlineImages) {
    // Ha nincs adat, skip
    if (!img.data) continue;

    // FIX: Validate MIME type to prevent injection
    if (!VALID_IMAGE_MIME_TYPES.has(img.mimeType)) {
      logger.warn('Skipping inline image with invalid MIME type', { contentId: img.contentId, mimeType: img.mimeType });
      continue;
    }

    // cid:xxx formátumú referenciák cseréje data URL-re
    const cidPattern = new RegExp(`cid:${img.contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    // A Gmail API base64url formátumot használ, át kell alakítani sima base64-re
    const base64Data = img.data.replace(/-/g, '+').replace(/_/g, '/');
    const dataUrl = `data:${img.mimeType};base64,${base64Data}`;
    result = result.replace(cidPattern, dataUrl);
  }

  return result;
}

// Mellékletek kinyerése (csak valódi mellékletek, inline képek kiszűrése)
function extractAttachments(
  payload?: gmail_v1.Schema$MessagePart | null,
): Array<{
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}> {
  const result: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

  if (!payload) return result;

  // Ellenőrizzük, hogy valódi melléklet-e (nem inline)
  const headers = payload.headers || [];
  const contentDisposition = headers.find(h => h.name?.toLowerCase() === 'content-disposition')?.value || '';
  const contentId = headers.find(h => h.name?.toLowerCase() === 'content-id')?.value;
  const isInline = contentDisposition.toLowerCase().includes('inline') || contentId;

  // Csak akkor adjuk hozzá, ha van filename, attachmentId és NEM inline
  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId && !isInline) {
    result.push({
      filename: payload.filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body.size || 0,
      attachmentId: payload.body.attachmentId,
    });
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      result.push(...extractAttachments(part));
    }
  }

  return result;
}

function decodeBase64(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

// RFC 2047 MIME encoded-word kódolás ékezetes karakterekhez a fejlécekben
function encodeRFC2047(text: string): string {
  // Ha csak ASCII karakterek vannak, nem kell kódolni
  if (/^[\x00-\x7F]*$/.test(text)) {
    return text;
  }
  // UTF-8 base64 kódolás: =?UTF-8?B?base64?=
  const encoded = Buffer.from(text, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

// Email küldés mellékletekkel
export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64 encoded
}

export async function sendEmail(
  gmail: gmail_v1.Gmail,
  options: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    inReplyTo?: string;
    threadId?: string;
    attachments?: EmailAttachment[];
  },
) {
  const { to, subject, body, cc, inReplyTo, threadId, attachments } = options;

  let raw: string;

  if (attachments && attachments.length > 0) {
    // Multipart email mellékletekkel
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const headers = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      `Subject: ${encodeRFC2047(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      inReplyTo ? `References: ${inReplyTo}` : '',
    ].filter(Boolean);

    const parts: string[] = [];

    // Body rész - base64 kódolva az ékezetes karakterek megfelelő kezeléséhez
    const bodyBase64 = Buffer.from(body, 'utf-8').toString('base64');
    parts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      bodyBase64,
    );

    // Melléklet részek
    for (const att of attachments) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.content,
      );
    }

    parts.push(`--${boundary}--`);

    raw = Buffer.from([...headers, '', ...parts].join('\r\n')).toString('base64url');
  } else {
    // Egyszerű email melléklet nélkül
    // Body-t base64-be kódoljuk az ékezetes karakterek megfelelő kezeléséhez
    const bodyBase64 = Buffer.from(body, 'utf-8').toString('base64');

    const messageParts = [
      `To: ${to}`,
      `Subject: ${encodeRFC2047(subject)}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      'MIME-Version: 1.0',
    ];

    if (cc) {
      messageParts.splice(1, 0, `Cc: ${cc}`);
    }
    if (inReplyTo) {
      messageParts.push(`In-Reply-To: ${inReplyTo}`);
      messageParts.push(`References: ${inReplyTo}`);
    }

    messageParts.push('', bodyBase64);

    raw = Buffer.from(messageParts.join('\r\n')).toString('base64url');
  }

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: threadId || undefined,
    },
  });

  return response.data;
}

// Melléklet letöltés
export async function getAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string,
) {
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  return {
    data: Buffer.from(response.data.data || '', 'base64url'),
    size: response.data.size || 0,
  };
}

// Levél módosítása (olvasott/csillag)
export async function modifyMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  options: { addLabels?: string[]; removeLabels?: string[] },
) {
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: options.addLabels,
      removeLabelIds: options.removeLabels,
    },
  });
}

// History lekérése inkrementális szinkronizáláshoz
export async function getHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
) {
  const response = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
  });

  return {
    history: response.data.history || [],
    historyId: response.data.historyId,
  };
}

// Profil (historyId lekéréshez)
export async function getProfile(gmail: gmail_v1.Gmail) {
  const response = await gmail.users.getProfile({ userId: 'me' });
  return {
    emailAddress: response.data.emailAddress,
    historyId: response.data.historyId,
    messagesTotal: response.data.messagesTotal,
  };
}

// Levél törlése (kukába helyezés)
export async function trashMessage(gmail: gmail_v1.Gmail, messageId: string) {
  await gmail.users.messages.trash({
    userId: 'me',
    id: messageId,
  });
}

// Levél végleges törlése
export async function deleteMessage(gmail: gmail_v1.Gmail, messageId: string) {
  await gmail.users.messages.delete({
    userId: 'me',
    id: messageId,
  });
}

// Gmail címke típus
export interface GmailLabelInfo {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal: number;
  messagesUnread: number;
  color: {
    textColor: string;
    backgroundColor: string;
  } | null;
}

// Gmail címkék listázása
export async function listLabels(gmail: gmail_v1.Gmail): Promise<GmailLabelInfo[]> {
  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  return (response.data.labels ?? [])
    .filter((label): label is typeof label & { id: string; name: string } =>
      typeof label.id === 'string' && typeof label.name === 'string'
    )
    .map((label) => ({
      id: label.id,
      name: label.name,
      type: (label.type === 'system' ? 'system' : 'user') as 'system' | 'user',
      messagesTotal: label.messagesTotal ?? 0,
      messagesUnread: label.messagesUnread ?? 0,
      color:
        label.color?.textColor && label.color?.backgroundColor
          ? {
              textColor: label.color.textColor,
              backgroundColor: label.color.backgroundColor,
            }
          : null,
    }));
}

// Egy címke lekérése
export async function getLabel(gmail: gmail_v1.Gmail, labelId: string) {
  const response = await gmail.users.labels.get({
    userId: 'me',
    id: labelId,
  });

  const label = response.data;
  return {
    id: label.id!,
    name: label.name!,
    type: label.type || 'user',
    messagesTotal: label.messagesTotal || 0,
    messagesUnread: label.messagesUnread || 0,
    color: label.color
      ? {
          textColor: label.color.textColor,
          backgroundColor: label.color.backgroundColor,
        }
      : null,
  };
}

// Új címke létrehozása
export async function createLabel(
  gmail: gmail_v1.Gmail,
  options: {
    name: string;
    backgroundColor?: string;
    textColor?: string;
  },
) {
  const response = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: options.name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color:
        options.backgroundColor && options.textColor
          ? {
              backgroundColor: options.backgroundColor,
              textColor: options.textColor,
            }
          : undefined,
    },
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
  };
}

// Címke törlése
export async function deleteLabel(gmail: gmail_v1.Gmail, labelId: string) {
  await gmail.users.labels.delete({
    userId: 'me',
    id: labelId,
  });
}
