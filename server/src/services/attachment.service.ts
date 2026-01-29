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
