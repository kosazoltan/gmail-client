import { google } from 'googleapis';
import crypto from 'crypto';
import { queryOne, queryAll, execute } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.FRONTEND_URL?.startsWith('https://');

  if (isProduction && !process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY környezeti változó kötelező production módban!');
  }

  const key = process.env.ENCRYPTION_KEY || 'dev-only-encryption-key-32chars!';
  return crypto.scryptSync(key, 'salt', 32);
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Érvénytelen titkosított adat formátum');
  }

  const [ivHex, authTagHex, encryptedText] = parts;

  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error('Hiányzó titkosítási komponens');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function handleAuthCallback(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  if (!userInfo.data.email) {
    throw new Error('Google fiókból nem sikerült email címet lekérni');
  }
  if (!tokens.access_token) {
    throw new Error('Hiányzó access token a Google válaszból');
  }
  if (!tokens.refresh_token) {
    throw new Error('Hiányzó refresh token a Google válaszból');
  }

  const email = userInfo.data.email;
  const name = userInfo.data.name || email;

  const existingAccount = queryOne<{ id: string }>(
    'SELECT id FROM accounts WHERE email = ?',
    [email],
  );

  const accountId = existingAccount?.id || uuidv4();
  const encryptedAccess = encrypt(tokens.access_token);
  const encryptedRefresh = encrypt(tokens.refresh_token);

  if (existingAccount) {
    execute(
      'UPDATE accounts SET access_token = ?, refresh_token = ?, token_expiry = ?, name = ? WHERE id = ?',
      [encryptedAccess, encryptedRefresh, tokens.expiry_date || 0, name, accountId],
    );
  } else {
    execute(
      `INSERT INTO accounts (id, email, name, access_token, refresh_token, token_expiry, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, email, name, encryptedAccess, encryptedRefresh, tokens.expiry_date || 0, Date.now()],
    );

    createDefaultCategories(accountId);
  }

  return { accountId, email, name };
}

function createDefaultCategories(accountId: string) {
  const defaultCategories = [
    { name: 'Munka', color: '#3B82F6', icon: 'briefcase' },
    { name: 'Személyes', color: '#10B981', icon: 'user' },
    { name: 'Hírlevél', color: '#8B5CF6', icon: 'newspaper' },
    { name: 'Értesítés', color: '#F59E0B', icon: 'bell' },
    { name: 'Pénzügy', color: '#EF4444', icon: 'wallet' },
    { name: 'Egyéb', color: '#6B7280', icon: 'folder' },
  ];

  for (const cat of defaultCategories) {
    const categoryId = uuidv4();
    execute(
      'INSERT INTO categories (id, name, color, icon, is_system, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [categoryId, cat.name, cat.color, cat.icon, 1, accountId],
    );
  }

  const cats = queryAll<{ id: string; name: string }>(
    'SELECT id, name FROM categories WHERE account_id = ?',
    [accountId],
  );

  const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const defaultRules = [
    { categoryId: catMap['Hírlevél'], type: 'label', value: 'CATEGORY_PROMOTIONS', priority: 10 },
    { categoryId: catMap['Hírlevél'], type: 'sender_domain', value: 'newsletter', priority: 9 },
    { categoryId: catMap['Hírlevél'], type: 'sender_email', value: 'noreply@medium.com', priority: 9 },
    { categoryId: catMap['Értesítés'], type: 'sender_email', value: 'noreply@', priority: 8 },
    { categoryId: catMap['Értesítés'], type: 'sender_email', value: 'notification@', priority: 8 },
    { categoryId: catMap['Értesítés'], type: 'sender_email', value: 'no-reply@', priority: 8 },
    { categoryId: catMap['Értesítés'], type: 'label', value: 'CATEGORY_UPDATES', priority: 7 },
    { categoryId: catMap['Pénzügy'], type: 'subject_keyword', value: 'számla', priority: 6 },
    { categoryId: catMap['Pénzügy'], type: 'subject_keyword', value: 'invoice', priority: 6 },
    { categoryId: catMap['Pénzügy'], type: 'subject_keyword', value: 'payment', priority: 6 },
    { categoryId: catMap['Pénzügy'], type: 'subject_keyword', value: 'fizetés', priority: 6 },
    { categoryId: catMap['Személyes'], type: 'sender_domain', value: 'gmail.com', priority: 2 },
    { categoryId: catMap['Személyes'], type: 'sender_domain', value: 'hotmail.com', priority: 2 },
    { categoryId: catMap['Személyes'], type: 'sender_domain', value: 'yahoo.com', priority: 2 },
    { categoryId: catMap['Személyes'], type: 'label', value: 'CATEGORY_PERSONAL', priority: 3 },
  ];

  for (const rule of defaultRules) {
    execute(
      'INSERT INTO categorization_rules (id, category_id, type, value, priority, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), rule.categoryId, rule.type, rule.value, rule.priority, accountId],
    );
  }
}

export function getOAuth2ClientForAccount(accountId: string) {
  const account = queryOne<{
    id: string;
    email: string;
    name: string;
    access_token: string;
    refresh_token: string;
    token_expiry: number;
    history_id: string | null;
    last_sync_at: number | null;
  }>('SELECT * FROM accounts WHERE id = ?', [accountId]);

  if (!account) {
    throw new Error('Fiók nem található: ' + accountId);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(account.access_token),
    refresh_token: decrypt(account.refresh_token),
    expiry_date: account.token_expiry,
  });

  oauth2Client.on('tokens', (tokens) => {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];

      if (tokens.access_token) {
        updates.push('access_token = ?');
        params.push(encrypt(tokens.access_token));
      }
      if (tokens.refresh_token) {
        updates.push('refresh_token = ?');
        params.push(encrypt(tokens.refresh_token));
      }
      if (tokens.expiry_date) {
        updates.push('token_expiry = ?');
        params.push(tokens.expiry_date);
      }
      if (updates.length > 0) {
        params.push(accountId);
        execute('UPDATE accounts SET ' + updates.join(', ') + ' WHERE id = ?', params);
      }
    } catch (error) {
      console.error('Token frissítés mentési hiba:', error);
    }
  });

  return { oauth2Client, account };
}

export function getAccountById(accountId: string) {
  return queryOne<{ id: string; email: string; name: string; last_sync_at: number | null }>(
    'SELECT id, email, name, last_sync_at FROM accounts WHERE id = ?',
    [accountId],
  );
}

export function getAllAccounts() {
  return queryAll<{ id: string; email: string; name: string; last_sync_at: number | null }>(
    'SELECT id, email, name, last_sync_at FROM accounts',
  );
}

export function deleteAccount(accountId: string) {
  execute('DELETE FROM accounts WHERE id = ?', [accountId]);
}
