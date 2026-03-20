import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import logger from '../utils/logger.js';

const SERVICE_NAME = 'ZMail';
const FALLBACK_FILE = path.resolve(process.cwd(), '.secure', 'token-vault.enc.json');
const ALGORITHM = 'aes-256-gcm';
const MARKER = '__TOKEN_IN_VAULT__';

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

function getMachineKey(): Buffer {
  const secret = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    process.env.ENCRYPTION_KEY || '',
  ].join('|');
  return crypto.scryptSync(secret, 'zmail-token-vault', 32);
}

async function loadKeytar(): Promise<KeytarModule | null> {
  if (keytarLoadTried) return keytarRef;
  keytarLoadTried = true;

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
    logger.warn('TokenVault: keytar nem elérhető, AES fallback használatban', err);
  }

  return keytarRef;
}

async function readFallbackVault(): Promise<FallbackVaultShape> {
  try {
    const raw = await fs.readFile(FALLBACK_FILE, 'utf8');
    const [ivHex, authTagHex, encrypted] = raw.split(':');
    if (!ivHex || !authTagHex || !encrypted) return {};

    const decipher = crypto.createDecipheriv(ALGORITHM, getMachineKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let json = decipher.update(encrypted, 'hex', 'utf8');
    json += decipher.final('utf8');

    return JSON.parse(json) as FallbackVaultShape;
  } catch {
    return {};
  }
}

async function writeFallbackVault(data: FallbackVaultShape): Promise<void> {
  await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getMachineKey(), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  await fs.writeFile(FALLBACK_FILE, `${iv.toString('hex')}:${authTag}:${encrypted}`, 'utf8');
}

async function saveFallback(accountEmail: string, tokenPair: OAuthTokenPair): Promise<void> {
  const current = await readFallbackVault();
  current[accountEmail] = {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    updatedAt: Date.now(),
  };
  await writeFallbackVault(current);
}

async function getFallback(accountEmail: string): Promise<OAuthTokenPair | null> {
  const current = await readFallbackVault();
  const found = current[accountEmail];
  if (!found) return null;
  return {
    accessToken: found.accessToken,
    refreshToken: found.refreshToken,
  };
}

async function deleteFallback(accountEmail: string): Promise<void> {
  const current = await readFallbackVault();
  if (!current[accountEmail]) return;
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
  const keytar = await loadKeytar();
  const payload = JSON.stringify(tokenPair);

  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, accountEmail, payload);
    return;
  }

  await saveFallback(accountEmail, tokenPair);
}

export async function getTokens(accountEmail: string): Promise<OAuthTokenPair | null> {
  const keytar = await loadKeytar();

  if (keytar) {
    const value = await keytar.getPassword(SERVICE_NAME, accountEmail);
    if (!value) return null;
    return parseLegacyToken(value);
  }

  return getFallback(accountEmail);
}

export async function deleteTokens(accountEmail: string): Promise<void> {
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
