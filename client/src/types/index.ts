export interface Account {
  id: string;
  email: string;
  name: string;
  lastSyncAt: number | null;
}

export interface Email {
  id: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  to: string | null;
  cc: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
  categoryId: string | null;
  topicId: string | null;
  // Részletes nézetnél
  body?: string | null;
  bodyHtml?: string | null;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  gmailAttachmentId: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
  emailCount?: number;
}

export interface CategorizationRule {
  id: string;
  categoryId: string;
  type: 'sender_domain' | 'sender_email' | 'subject_keyword' | 'label';
  value: string;
  priority: number;
}

export interface SenderGroup {
  id: string;
  email: string;
  name: string | null;
  domain: string | null;
  messageCount: number;
  lastMessageAt: number | null;
}

export interface Topic {
  id: string;
  name: string;
  normalizedSubject: string;
  messageCount: number;
}

export interface TimePeriod {
  id: string;
  name: string;
  from: number;
  to: number;
  count: number;
}

export interface SessionInfo {
  authenticated: boolean;
  accounts: Account[];
  activeAccountId: string | null;
}

export interface PaginatedEmails {
  emails: Email[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Contact {
  id: string;
  email: string;
  name: string | null;
  frequency: number;
  lastUsedAt: number;
}

export interface DatabaseStats {
  totalEmails: number;
  totalContacts: number;
  totalAttachments: number;
  totalCategories: number;
  totalSenderGroups: number;
  totalTopics: number;
  databaseSizeBytes: number;
  oldestEmail: number | null;
  newestEmail: number | null;
  emailsByAccount: Array<{ accountId: string; email: string; count: number }>;
}

export interface DatabaseEmail {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  date: number;
  is_read: number;
  has_attachments: number;
  body_size: number;
}

export interface Backup {
  filename: string;
  path: string;
  size: number;
  createdAt: number;
}
