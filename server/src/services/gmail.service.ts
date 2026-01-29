import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

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

  return parseMessage(response.data);
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
function parseMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);

  // Body kinyerése
  const { text, html } = extractBody(message.payload);

  // Mellékletek
  const attachmentsList = extractAttachments(message.payload);

  return {
    id: message.id!,
    threadId: message.threadId,
    subject: getHeader('Subject'),
    from: fromEmail,
    fromName: fromName,
    to: getHeader('To'),
    cc: getHeader('Cc'),
    snippet: message.snippet,
    body: text,
    bodyHtml: html,
    date: parseInt(message.internalDate || '0'),
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

  return {
    id: message.id!,
    threadId: message.threadId,
    subject: getHeader('Subject'),
    from: fromEmail,
    fromName: fromName,
    to: getHeader('To'),
    cc: getHeader('Cc'),
    snippet: message.snippet,
    date: parseInt(message.internalDate || '0'),
    isRead: !message.labelIds?.includes('UNREAD'),
    isStarred: message.labelIds?.includes('STARRED') || false,
    labels: message.labelIds || [],
    hasAttachments: (message.payload?.parts || []).some(
      (p) => p.filename && p.filename.length > 0,
    ),
  };
}

// Email cím és név szétbontása: "Név <email>" formátumból
function parseEmailAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { email: raw, name: '' };
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

// Mellékletek kinyerése
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

  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) {
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
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      inReplyTo ? `References: ${inReplyTo}` : '',
    ].filter(Boolean);

    const parts: string[] = [];

    // Body rész
    parts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
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
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    if (cc) {
      messageParts.splice(1, 0, `Cc: ${cc}`);
    }
    if (inReplyTo) {
      messageParts.push(`In-Reply-To: ${inReplyTo}`);
      messageParts.push(`References: ${inReplyTo}`);
    }

    messageParts.push('', body);

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
