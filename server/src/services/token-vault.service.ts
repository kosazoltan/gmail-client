import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import logger from '../utils/logger.js';
import { execute, queryOne } from '../db/index.js';

const SERVICE_NAME = 'ZMail';
const ALGORITHM = 'aes-256-gcm';
const MARKER = '__TOKEN_IN_VAULT__';
/** Régi (géphez kötött) kulcs — helyi fejlesztés; PaaS-on hostname változáskor elromlik. */
const SCRYPT_SALT_LEGACY = 'zmail-token-vault';
/** Stabil kulcs — csak ENCRYPTION_KEY-ből; Render / újraindítás után is ugyanaz. */
const SCRYPT_SALT_STABLE = 'zmail-token-vault-v2';

function getFallbackFilePath(): string {
  const fromEnv = process.env.ZMAIL_TOKEN_VAULT_FILE?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  return path.resolve(process.cwd(), '.secure', 'token-vault.enc.json');
}

const FALLBACK_FILE = getFallbackFilePath();

type KeytarModule = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
};

export interface OAuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

interface FallbackVaultShape {
  [email: string]: {
    accessToken: string;
    refreshToken: string;
    updatedAt: number;
  };
}

let keytarRef: KeytarModule | null = null;
let keytarLoadTried = false;
let warnedUnstableVault = false;
let loggedDbVaultMode = false;

/**
 * Neon / Postgres tároló: újraindítás és efemér disk után is megmarad a refresh token.
 * - ZMAIL_USE_DB_TOKEN_VAULT=1 → be
 * - ZMAIL_USE_DB_TOKEN_VAULT=0 → ki
 * - Render (RENDER=true) alapértelmezés: BE (fájl nélkül gyakran elvesznek a tokenek)
 */
export function useDatabaseTokenVault(): boolean {
  if (process.env.ZMAIL_USE_DB_TOKEN_VAULT === '0') return false;
  if (process.env.ZMAIL_USE_DB_TOKEN_VAULT === '1') return true;
  return process.env.RENDER === 'true';
}

function logDbVaultOnce(): void {
  if (loggedDbVaultMode) return;
  loggedDbVaultMode = true;
  if (useDatabaseTokenVault()) {
    logger.info(
      'TokenVault: PostgreSQL (oauth_token_store) + ENCRYPTION_KEY — OAuth tokenek újraindítás után is megmaradnak',
    );
  }
}

function normalizeVaultEmail(accountEmail: string): string {
  return accountEmail.toLowerCase().trim();
}

/** Production: ENCRYPTION_KEY (min. 16 karakter) → kulcs NEM függ hostnévtől (Render újraindítás OK). */
function getStableVaultKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY?.trim();
  if (!key || key.length < 16) return null;
  return crypto.scryptSync(key, SCRYPT_SALT_STABLE, 32);
}

/** Régi viselkedés: hostname + user + platform + ENCRYPTION_KEY — helyi gépen maradhat. */
function getLegacyMachineBoundKey(): Buffer {
  const secret = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    process.env.ENCRYPTION_KEY || '',
  ].join('|');
  return crypto.scryptSync(secret, SCRYPT_SALT_LEGACY, 32);
}

/** Íráshoz: ha van stabil kulcs, azt használjuk (PaaS). */
function getPrimaryEncryptionKey(): Buffer {
  const stable = getStableVaultKey();
  if (stable) return stable;
  return getLegacyMachineBoundKey();
}

function encryptTokenBlob(pair: OAuthTokenPair, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const payload = JSON.stringify({
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
  });
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptTokenBlob(raw: string, key: Buffer): OAuthTokenPair | null {
  try {
    const [ivHex, authTagHex, encrypted] = raw.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let json = decipher.update(encrypted, 'hex', 'utf8');
    json += decipher.final('utf8');
    const parsed = JSON.parse(json) as { accessToken?: string; refreshToken?: string };
    if (parsed?.accessToken && parsed?.refreshToken) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    return null;
  }
  return null;
}

async function saveTokensDb(accountEmail: string, tokenPair: OAuthTokenPair): Promise<void> {
  const normalized = normalizeVaultEmail(accountEmail);
  const key = getPrimaryEncryptionKey();
  const ciphertext = encryptTokenBlob(tokenPair, key);
  const now = Date.now();
  await execute(
    `INSERT INTO oauth_token_store (account_email, ciphertext, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (account_email) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = EXCLUDED.updated_at`,
    [normalized, ciphertext, now],
  );
}

async function getTokensDb(accountEmail: string): Promise<OAuthTokenPair | null> {
  const normalized = normalizeVaultEmail(accountEmail);
  const row = await queryOne<{ ciphertext: string }>(
    'SELECT ciphertext FROM oauth_token_store WHERE account_email = ?',
    [normalized],
  );
  if (!row?.ciphertext) return null;

  const stable = getStableVaultKey();
  let pair = decryptTokenBlob(row.ciphertext, getPrimaryEncryptionKey());
  if (!pair && stable) {
    pair = decryptTokenBlob(row.ciphertext, getLegacyMachineBoundKey());
  }
  return pair;
}

async function deleteTokensDb(accountEmail: string): Promise<void> {
  const normalized = normalizeVaultEmail(accountEmail);
  await execute('DELETE FROM oauth_token_store WHERE account_email = ?', [normalized]);
}

function decryptVaultFileContents(raw: string, key: Buffer): FallbackVaultShape | null {
  try {
    const [ivHex, authTagHex, encrypted] = raw.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let json = decipher.update(encrypted, 'hex', 'utf8');
    json += decipher.final('utf8');

    return JSON.parse(json) as FallbackVaultShape;
  } catch {
    return null;
  }
}

async function loadKeytar(): Promise<KeytarModule | null> {
  if (keytarLoadTried) return keytarRef;
  keytarLoadTried = true;

  // Render / Docker: nincs libsecret — a natív modul betöltése felesleges zaj + ERR_DLOPEN_FAILED
  if (process.env.RENDER === 'true' || process.env.ZMAIL_SKIP_KEYTAR === '1') {
    logger.info('TokenVault: keytar kihagyva (PaaS / ZMAIL_SKIP_KEYTAR), AES fájl vault');
    return keytarRef;
  }

  try {
    const mod = await import('keytar');
    const m = (mod.default || mod) as KeytarModule;
    if (
      typeof m?.setPassword === 'function' &&
      typeof m?.getPassword === 'function' &&
      typeof m?.deletePassword === 'function'
    ) {
      keytarRef = m;
      logger.info('TokenVault: keytar backend active');
    }
  } catch (err) {
    const e = err as Error & { code?: string };
    logger.warn(
      `TokenVault: keytar nem elérhető (${e.code || 'unknown'}: ${e.message}), AES fájl vault`,
    );
  }

  return keytarRef;
}

async function readFallbackVault(): Promise<FallbackVaultShape> {
  if (process.env.RENDER === 'true' && !getStableVaultKey() && !warnedUnstableVault) {
    warnedUnstableVault = true;
    logger.warn(
      'TokenVault: ENCRYPTION_KEY hiányzik vagy rövid (<16) — újraindításkor a vault elveszhet. Állíts be ENCRYPTION_KEY-t!',
    );
  }

  let raw: string;
  try {
    raw = await fs.readFile(FALLBACK_FILE, 'utf8');
  } catch {
    return {};
  }

  const stable = getStableVaultKey();
  if (stable) {
    const data = decryptVaultFileContents(raw, stable);
    if (data && Object.keys(data).length > 0) return data;
    // Migráció: korábban géphez kötött kulccsal titkolt fájl
    const legacy = decryptVaultFileContents(raw, getLegacyMachineBoundKey());
    if (legacy && Object.keys(legacy).length > 0) {
      logger.info(
        'TokenVault: legacy gépi kulcsról migrálás stabil ENCRYPTION_KEY kulcsra (újraírás mentéskor)',
      );
      return legacy;
    }
    return {};
  }

  const legacyOnly = decryptVaultFileContents(raw, getLegacyMachineBoundKey());
  return legacyOnly && Object.keys(legacyOnly).length > 0 ? legacyOnly : {};
}

async function writeFallbackVault(data: FallbackVaultShape): Promise<void> {
  await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });

  const key = getPrimaryEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  await fs.writeFile(FALLBACK_FILE, `${iv.toString('hex')}:${authTag}:${encrypted}`, 'utf8');
}

async function saveFallback(accountEmail: string, tokenPair: OAuthTokenPair): Promise<void> {
  const current = await readFallbackVault();
  const key = normalizeVaultEmail(accountEmail);
  current[key] = {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    updatedAt: Date.now(),
  };
  await writeFallbackVault(current);
}

async function getFallback(accountEmail: string): Promise<OAuthTokenPair | null> {
  const current = await readFallbackVault();
  const norm = normalizeVaultEmail(accountEmail);
  const found = current[norm] ?? current[accountEmail];
  if (!found) return null;
  return {
    accessToken: found.accessToken,
    refreshToken: found.refreshToken,
  };
}

async function deleteFallback(accountEmail: string): Promise<void> {
  const current = await readFallbackVault();
  const norm = normalizeVaultEmail(accountEmail);
  if (!current[norm] && !current[accountEmail]) return;
  delete current[norm];
  delete current[accountEmail];
  await writeFallbackVault(current);
}

function parseLegacyToken(raw: string): OAuthTokenPair | null {
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
    if (parsed?.accessToken && parsed?.refreshToken) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    // noop
  }
  return null;
}

export async function saveTokens(accountEmail: string, tokenPair: OAuthTokenPair): Promise<void> {
  logDbVaultOnce();
  const useDb = useDatabaseTokenVault();
  const keytar = await loadKeytar();

  if (useDb) {
    try {
      await saveTokensDb(accountEmail, tokenPair);
    } catch (err) {
      logger.error('TokenVault: oauth_token_store mentés sikertelen:', err);
      throw err;
    }
  }

  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, accountEmail, JSON.stringify(tokenPair));
    return;
  }

  await saveFallback(accountEmail, tokenPair);
}

export async function getTokens(accountEmail: string): Promise<OAuthTokenPair | null> {
  logDbVaultOnce();
  const useDb = useDatabaseTokenVault();

  if (useDb) {
    try {
      const fromDb = await getTokensDb(accountEmail);
      if (fromDb) return fromDb;
    } catch (err) {
      logger.warn('TokenVault: oauth_token_store olvasás sikertelen, fallback:', err);
    }
  }

  const keytar = await loadKeytar();

  if (keytar) {
    const value = await keytar.getPassword(SERVICE_NAME, accountEmail);
    if (!value) return null;
    const pair = parseLegacyToken(value);
    if (pair && useDb) {
      try {
        await saveTokensDb(accountEmail, pair);
        logger.info(`TokenVault: keytar → oauth_token_store migráció (${accountEmail})`);
      } catch (e) {
        logger.warn('TokenVault: keytar→DB migráció sikertelen:', e);
      }
    }
    return pair;
  }

  const fromFile = await getFallback(accountEmail);
  if (fromFile && useDb) {
    try {
      await saveTokensDb(accountEmail, fromFile);
      logger.info(`TokenVault: fájl vault → oauth_token_store migráció (${accountEmail})`);
    } catch (e) {
      logger.warn('TokenVault: fájl→DB migráció sikertelen:', e);
    }
  }
  return fromFile;
}

export async function deleteTokens(accountEmail: string): Promise<void> {
  logDbVaultOnce();
  const useDb = useDatabaseTokenVault();
  if (useDb) {
    try {
      await deleteTokensDb(accountEmail);
    } catch (err) {
      logger.warn('TokenVault: oauth_token_store törlés:', err);
    }
  }

  const keytar = await loadKeytar();
  if (keytar) {
    await keytar.deletePassword(SERVICE_NAME, accountEmail);
    return;
  }
  await deleteFallback(accountEmail);
}

export function getVaultMarker(): string {
  return MARKER;
}

export function isVaultMarker(value: string | null | undefined): boolean {
  return value === MARKER;
}
