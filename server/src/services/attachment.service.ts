import { queryOne, queryAll } from '../db/index.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getGmailClient, getAttachment } from './gmail.service.js';

export function getAttachmentInfo(attachmentId: string) {
  return queryOne(
    'SELECT * FROM attachments WHERE id = ?',
    [attachmentId],
  );
}

export async function downloadAttachment(attachmentId: string) {
  const attachment = queryOne<{
    id: string;
    email_id: string;
    filename: string;
    mime_type: string;
    size: number;
    gmail_attachment_id: string;
  }>(
    'SELECT * FROM attachments WHERE id = ?',
    [attachmentId],
  );

  if (!attachment) {
    throw new Error('Melléklet nem található');
  }

  const email = queryOne<{ id: string; account_id: string }>(
    'SELECT id, account_id FROM emails WHERE id = ?',
    [attachment.email_id],
  );

  if (!email) {
    throw new Error('Email nem található');
  }

  const { oauth2Client } = getOAuth2ClientForAccount(email.account_id);
  const gmail = getGmailClient(oauth2Client);

  const data = await getAttachment(
    gmail,
    attachment.email_id,
    attachment.gmail_attachment_id,
  );

  return {
    data: data.data,
    filename: attachment.filename,
    mimeType: attachment.mime_type,
    size: attachment.size,
  };
}

export function getEmailAttachments(emailId: string) {
  return queryAll(
    'SELECT * FROM attachments WHERE email_id = ?',
    [emailId],
  );
}

// Melléklet tulajdonosának (account_id) lekérdezése
export function getAttachmentOwner(attachmentId: string): string | null {
  const result = queryOne<{ account_id: string }>(
    `SELECT e.account_id
     FROM attachments a
     JOIN emails e ON a.email_id = e.id
     WHERE a.id = ?`,
    [attachmentId],
  );
  return result?.account_id || null;
}

// Melléklet típusok meghatározása MIME type alapján
function getAttachmentType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'document';
  if (
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'spreadsheet';
  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) return 'presentation';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'other';
}

export interface AttachmentFilter {
  accountId: string;
  type?: string; // 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'video' | 'audio' | 'archive' | 'other'
  search?: string;
  sort?: 'date' | 'size' | 'name';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AttachmentWithEmail {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  gmailAttachmentId: string;
  type: string;
  // Email info
  emailSubject: string | null;
  emailFrom: string | null;
  emailDate: number;
}

export interface AttachmentListResult {
  attachments: AttachmentWithEmail[];
  total: number;
  page: number;
  totalPages: number;
  typeStats: Record<string, number>;
}

export function listAttachments(filter: AttachmentFilter): AttachmentListResult {
  const { accountId, type, search, sort = 'date', order = 'desc', page = 1, limit = 50 } = filter;
  const offset = (page - 1) * limit;

  // Típus szűrés MIME type alapján
  let typeCondition = '';
  const typeParams: string[] = [];
  if (type) {
    switch (type) {
      case 'image':
        typeCondition = "AND a.mime_type LIKE 'image/%'";
        break;
      case 'pdf':
        typeCondition = "AND a.mime_type = 'application/pdf'";
        break;
      case 'document':
        typeCondition = "AND (a.mime_type LIKE '%word%' OR a.mime_type LIKE '%document%' OR a.mime_type = 'application/msword')";
        break;
      case 'spreadsheet':
        typeCondition = "AND (a.mime_type LIKE '%excel%' OR a.mime_type LIKE '%spreadsheet%')";
        break;
      case 'presentation':
        typeCondition = "AND (a.mime_type LIKE '%presentation%' OR a.mime_type LIKE '%powerpoint%')";
        break;
      case 'video':
        typeCondition = "AND a.mime_type LIKE 'video/%'";
        break;
      case 'audio':
        typeCondition = "AND a.mime_type LIKE 'audio/%'";
        break;
      case 'archive':
        typeCondition = "AND (a.mime_type LIKE '%zip%' OR a.mime_type LIKE '%archive%' OR a.mime_type LIKE '%compressed%')";
        break;
      case 'other':
        typeCondition = `AND a.mime_type NOT LIKE 'image/%'
          AND a.mime_type != 'application/pdf'
          AND a.mime_type NOT LIKE '%word%'
          AND a.mime_type NOT LIKE '%document%'
          AND a.mime_type NOT LIKE '%excel%'
          AND a.mime_type NOT LIKE '%spreadsheet%'
          AND a.mime_type NOT LIKE '%presentation%'
          AND a.mime_type NOT LIKE '%powerpoint%'
          AND a.mime_type NOT LIKE 'video/%'
          AND a.mime_type NOT LIKE 'audio/%'
          AND a.mime_type NOT LIKE '%zip%'
          AND a.mime_type NOT LIKE '%archive%'`;
        break;
    }
  }

  // Keresés szűrés
  let searchCondition = '';
  const searchParams: (string | number)[] = [];
  if (search) {
    searchCondition = 'AND (a.filename LIKE ? OR e.subject LIKE ?)';
    searchParams.push(`%${search}%`, `%${search}%`);
  }

  // Rendezés
  let orderBy: string;
  switch (sort) {
    case 'size':
      orderBy = `a.size ${order}`;
      break;
    case 'name':
      orderBy = `a.filename ${order}`;
      break;
    case 'date':
    default:
      orderBy = `e.date ${order}`;
      break;
  }

  // Összesítés
  const countResult = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM attachments a
     JOIN emails e ON a.email_id = e.id
     WHERE e.account_id = ?
     ${typeCondition}
     ${searchCondition}`,
    [accountId, ...typeParams, ...searchParams],
  );
  const total = countResult?.count || 0;

  // Adatok lekérése
  const rows = queryAll<{
    id: string;
    email_id: string;
    filename: string;
    mime_type: string;
    size: number;
    gmail_attachment_id: string;
    email_subject: string | null;
    email_from: string | null;
    email_date: number;
  }>(
    `SELECT
      a.id, a.email_id, a.filename, a.mime_type, a.size, a.gmail_attachment_id,
      e.subject as email_subject, e.from_email as email_from, e.date as email_date
     FROM attachments a
     JOIN emails e ON a.email_id = e.id
     WHERE e.account_id = ?
     ${typeCondition}
     ${searchCondition}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [accountId, ...typeParams, ...searchParams, limit, offset],
  );

  const attachments: AttachmentWithEmail[] = rows.map((row) => ({
    id: row.id,
    emailId: row.email_id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size,
    gmailAttachmentId: row.gmail_attachment_id,
    type: getAttachmentType(row.mime_type),
    emailSubject: row.email_subject,
    emailFrom: row.email_from,
    emailDate: row.email_date,
  }));

  // Típus statisztikák
  const typeStatsRows = queryAll<{ mime_type: string; count: number }>(
    `SELECT a.mime_type, COUNT(*) as count
     FROM attachments a
     JOIN emails e ON a.email_id = e.id
     WHERE e.account_id = ?
     GROUP BY a.mime_type`,
    [accountId],
  );

  const typeStats: Record<string, number> = {
    all: 0,
    image: 0,
    pdf: 0,
    document: 0,
    spreadsheet: 0,
    presentation: 0,
    video: 0,
    audio: 0,
    archive: 0,
    other: 0,
  };

  for (const row of typeStatsRows) {
    const attachType = getAttachmentType(row.mime_type);
    typeStats[attachType] = (typeStats[attachType] || 0) + row.count;
    typeStats.all += row.count;
  }

  return {
    attachments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    typeStats,
  };
}
