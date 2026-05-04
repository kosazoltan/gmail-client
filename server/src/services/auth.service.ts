import logger from '../utils/logger.js';
import { google } from 'googleapis';
import crypto from 'crypto';
import { queryOne, queryAll, execute } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { stopBackgroundSync } from './sync.service.js';
import {
  saveTokens,
  getTokens,
  deleteTokens,
  getVaultMarker,
  isVaultMarker,
} from './token-vault.service.js';

/** OAuth token hiányzik (vault üres / új deploy) — indításkor várt; megoldás: új bejelentkezés. */
export const MISSING_VAULT_TOKEN_MESSAGE =
  'Token nem található secure vaultban. Jelentkezz be újra.';

export function isMissingVaultTokenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Token nem található secure vaultban');
}

/** Gmail / Google OAuth hiba, amire újra bejelentkezés az ésszerű megoldás */
export function isOAuthReloginError(err: unknown): boolean {
  if (isMissingVaultTokenError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /invalid_grant|Invalid Credentials|invalid_rapt|Token has been expired|revoked|insufficient authentication scopes/i.test(
    msg,
  );
}

/** Felhasználónak megjelenő üzenet, ha OAuth token nincs a vaultban (törlés / Gmail API). */
export const OAUTH_RELOGIN_REQUIRED_MESSAGE =
  'A Gmail nem elérhető: a szerveren nincs mentett Google-token (pl. újraindítás után). Jelentkezz ki, majd jelentkezz be újra ugyanazzal a fiókkal.';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/drive.file',
];

const LEGACY_ALGORITHM = 'aes-256-gcm';

function getLegacyEncryptionKey(): Buffer {
  const salt = process.env.ENCRYPTION_SALT || 'salt';
  const key = process.env.ENCRYPTION_KEY || 'dev-only-encryption-key-32chars!';
  return crypto.scryptSync(key, salt, 32);
}

async function tryDecryptLegacy(encrypted: string): Promise<string | null> {
  if (!encrypted.includes(':')) return encrypted;

  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;

    const [ivHex, authTagHex, encryptedText] = parts;
    if (!ivHex || !authTagHex || !encryptedText) return encrypted;

    const decipher = crypto.createDecipheriv(
      LEGACY_ALGORITHM,
      getLegacyEncryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(state?: string, options: { forceConsent?: boolean } = {}): string {
  const oauth2Client = createOAuth2Client();
  const prompt =
    options.forceConsent || process.env.GOOGLE_OAUTH_FORCE_CONSENT === '1' ? 'consent' : undefined;
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true,
    ...(prompt ? { prompt } : {}),
    state, // CSRF protection - state parameter validated in callback
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
  const email = userInfo.data.email;
  const name = userInfo.data.name || email;

  const existingAccount = await queryOne<{ id: string }>(
    'SELECT id FROM accounts WHERE email = ?',
    [email],
  );

  const accountId = existingAccount?.id || uuidv4();
  const existingTokens = existingAccount ? await getTokens(email) : null;
  const refreshToken = tokens.refresh_token || existingTokens?.refreshToken;

  if (!refreshToken) {
    throw new Error(
      'Hiányzó refresh token a Google válaszból. Indítsd újra a bejelentkezést forceConsent=1 paraméterrel.',
    );
  }

  const vaultMarker = getVaultMarker();

  await saveTokens(email, {
    accessToken: tokens.access_token,
    refreshToken,
  });

  if (existingAccount) {
    await execute(
      'UPDATE accounts SET access_token = ?, refresh_token = ?, token_expiry = ?, name = ? WHERE id = ?',
      [vaultMarker, vaultMarker, tokens.expiry_date || 0, name, accountId],
    );
  } else {
    await execute(
      `INSERT INTO accounts (id, email, name, access_token, refresh_token, token_expiry, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, email, name, vaultMarker, vaultMarker, tokens.expiry_date || 0, Date.now()],
    );

    await createDefaultCategories(accountId);
  }

  return { accountId, email, name };
}

async function createDefaultCategories(accountId: string) {
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
    await execute(
      'INSERT INTO categories (id, name, color, icon, is_system, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [categoryId, cat.name, cat.color, cat.icon, 1, accountId],
    );
  }

  const cats = await queryAll<{ id: string; name: string }>(
    'SELECT id, name FROM categories WHERE account_id = ?',
    [accountId],
  );

  const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const defaultRules = [
    { categoryId: catMap['Hírlevél'], type: 'label', value: 'CATEGORY_PROMOTIONS', priority: 10 },
    { categoryId: catMap['Hírlevél'], type: 'sender_domain', value: 'newsletter', priority: 9 },
    {
      categoryId: catMap['Hírlevél'],
      type: 'sender_email',
      value: 'noreply@medium.com',
      priority: 9,
    },
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
    await execute(
      'INSERT INTO categorization_rules (id, category_id, type, value, priority, account_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), rule.categoryId, rule.type, rule.value, rule.priority, accountId],
    );
  }
}

export async function getOAuth2ClientForAccount(accountId: string) {
  const account = await queryOne<{
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

  let tokenPair = await getTokens(account.email);

  // Legacy migration: DB token -> vault
  if (!tokenPair && !isVaultMarker(account.access_token) && !isVaultMarker(account.refresh_token)) {
    const legacyAccess = await tryDecryptLegacy(account.access_token);
    const legacyRefresh = await tryDecryptLegacy(account.refresh_token);

    if (legacyAccess && legacyRefresh) {
      tokenPair = { accessToken: legacyAccess, refreshToken: legacyRefresh };
      await saveTokens(account.email, tokenPair);
      await execute('UPDATE accounts SET access_token = ?, refresh_token = ? WHERE id = ?', [
        getVaultMarker(),
        getVaultMarker(),
        accountId,
      ]);
      logger.info(`Token migration -> vault completed for ${account.email}`);
    }
  }

  if (!tokenPair) {
    throw new Error(MISSING_VAULT_TOKEN_MESSAGE);
  }

  oauth2Client.setCredentials({
    access_token: tokenPair.accessToken,
    refresh_token: tokenPair.refreshToken,
    expiry_date: account.token_expiry,
  });

  // Használjunk 'once'-ot 'on' helyett a memory leak elkerülésére
  oauth2Client.once('tokens', async (tokens) => {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];

      const nextAccess = tokens.access_token || tokenPair?.accessToken;
      const nextRefresh = tokens.refresh_token || tokenPair?.refreshToken;

      await saveTokens(account.email, {
        accessToken: nextAccess,
        refreshToken: nextRefresh,
      });

      tokenPair = {
        accessToken: nextAccess,
        refreshToken: nextRefresh,
      };

      if (tokens.access_token || tokens.refresh_token) {
        updates.push('access_token = ?');
        updates.push('refresh_token = ?');
        params.push(getVaultMarker(), getVaultMarker());
      }
      if (tokens.expiry_date) {
        updates.push('token_expiry = ?');
        params.push(tokens.expiry_date);
      }
      if (updates.length > 0) {
        params.push(accountId);
        await execute('UPDATE accounts SET ' + updates.join(', ') + ' WHERE id = ?', params);
      }
    } catch (error) {
      logger.error('Token frissítés mentési hiba:', error);
    }
  });

  return { oauth2Client, account };
}

export async function getAccountById(accountId: string) {
  return await queryOne<{
    id: string;
    email: string;
    name: string;
    last_sync_at: number | null;
    color: string | null;
  }>('SELECT id, email, name, last_sync_at, color FROM accounts WHERE id = ?', [accountId]);
}

export async function getAllAccounts() {
  return await queryAll<{
    id: string;
    email: string;
    name: string;
    last_sync_at: number | null;
    color: string | null;
  }>('SELECT id, email, name, last_sync_at, color FROM accounts');
}

export async function updateAccountColor(accountId: string, color: string) {
  await execute('UPDATE accounts SET color = ? WHERE id = ?', [color, accountId]);
}

export async function deleteAccount(accountId: string) {
  // Stop background sync before deleting to prevent orphaned intervals
  stopBackgroundSync(accountId);

  const account = await queryOne<{ email: string }>('SELECT email FROM accounts WHERE id = ?', [
    accountId,
  ]);
  if (account?.email) {
    await deleteTokens(account.email);
  }

  await execute('DELETE FROM accounts WHERE id = ?', [accountId]);
}
