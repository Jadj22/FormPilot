import Dexie, { type Table } from 'dexie';
import {
  decryptJSON,
  deriveKey,
  encryptJSON,
  randomBytes,
  toBase64,
  fromBase64,
} from './crypto';
import { emptyVault, type VaultData } from './types';

interface WrappedKey {
  iv: string;
  data: string;
}

interface VaultRow {
  id: number;
  kekSalt: string;
  wrappedKey: string;
  recoverySalt: string | null;
  recoveryWrappedKey: string | null;
  iv: string;
  data: string;
}

class VaultDB extends Dexie {
  vault!: Table<VaultRow, number>;

  constructor() {
    super('formpilot');
    this.version(1).stores({ vault: 'id' });
  }
}

const db = new VaultDB();
const VAULT_ID = 1;

let sessionKey: CryptoKey | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

export const AUTO_LOCK_MINUTES = 15;

async function wrapKey(wrappingKey: CryptoKey, keyRaw: Uint8Array): Promise<WrappedKey> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    wrappingKey,
    keyRaw as unknown as BufferSource,
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

async function unwrapKey(wrappingKey: CryptoKey, wrapped: WrappedKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(wrapped.iv) as unknown as BufferSource },
    wrappingKey,
    fromBase64(wrapped.data) as unknown as BufferSource,
  );
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function scheduleAutoLock(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(
    () => {
      sessionKey = null;
    },
    AUTO_LOCK_MINUTES * 60 * 1000,
  );
}

export async function isVaultInitialized(): Promise<boolean> {
  const row = await db.vault.get(VAULT_ID);
  return !!row;
}

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

export function lock(): void {
  sessionKey = null;
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = null;
}

function generateRecoveryKey(): string {
  const bytes = randomBytes(32);
  const b64 = toBase64(bytes);
  return b64.match(/.{1,4}/g)!.join('-');
}

export async function createVault(
  password: string,
): Promise<{ recoveryKey: string }> {
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const dekRaw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));

  const kekSalt = randomBytes(16);
  const kek = await deriveKey(password, kekSalt);
  const wrappedKey = await wrapKey(kek, dekRaw);

  const recoveryKey = generateRecoveryKey();
  const recoverySalt = randomBytes(16);
  const rek = await deriveKey(recoveryKey, recoverySalt);
  const recoveryWrappedKey = await wrapKey(rek, dekRaw);

  const { iv, data } = await encryptJSON(dek, emptyVault());
  await db.vault.put({
    id: VAULT_ID,
    kekSalt: toBase64(kekSalt),
    wrappedKey: JSON.stringify(wrappedKey),
    recoverySalt: toBase64(recoverySalt),
    recoveryWrappedKey: JSON.stringify(recoveryWrappedKey),
    iv,
    data,
  });
  sessionKey = dek;
  scheduleAutoLock();
  return { recoveryKey };
}

export async function unlockVault(password: string): Promise<boolean> {
  const row = await db.vault.get(VAULT_ID);
  if (!row) return false;
  const kek = await deriveKey(password, fromBase64(row.kekSalt));
  try {
    const dek = await unwrapKey(kek, JSON.parse(row.wrappedKey) as WrappedKey);
    sessionKey = dek;
    scheduleAutoLock();
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithRecoveryKey(recoveryKey: string): Promise<boolean> {
  const row = await db.vault.get(VAULT_ID);
  if (!row?.recoverySalt || !row.recoveryWrappedKey) return false;
  const rek = await deriveKey(recoveryKey.trim(), fromBase64(row.recoverySalt));
  try {
    const dek = await unwrapKey(rek, JSON.parse(row.recoveryWrappedKey) as WrappedKey);
    sessionKey = dek;
    scheduleAutoLock();
    return true;
  } catch {
    return false;
  }
}

export async function loadVault(): Promise<VaultData> {
  if (!sessionKey) throw new Error('Vault is locked');
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  scheduleAutoLock();
  return decryptJSON<VaultData>(sessionKey, { iv: row.iv, data: row.data });
}

export async function saveVault(data: VaultData): Promise<void> {
  if (!sessionKey) throw new Error('Vault is locked');
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  const { iv, data: encrypted } = await encryptJSON(sessionKey, data);
  await db.vault.put({ ...row, iv, data: encrypted });
  scheduleAutoLock();
}

export async function destroyVault(): Promise<void> {
  lock();
  await db.vault.clear();
}

export async function exportVault(): Promise<string> {
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  return JSON.stringify(
    {
      format: 'formpilot-vault',
      version: 2,
      kekSalt: row.kekSalt,
      wrappedKey: row.wrappedKey,
      iv: row.iv,
      data: row.data,
    },
    null,
    2,
  );
}

export async function importVault(json: string, password: string): Promise<boolean> {
  let parsed: {
    format?: string;
    kekSalt?: string;
    wrappedKey?: string;
    iv?: string;
    data?: string;
  };
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (
    parsed.format !== 'formpilot-vault' ||
    !parsed.kekSalt ||
    !parsed.wrappedKey ||
    !parsed.iv ||
    !parsed.data
  ) {
    return false;
  }
  const kek = await deriveKey(password, fromBase64(parsed.kekSalt));
  let dek: CryptoKey;
  try {
    dek = await unwrapKey(kek, JSON.parse(parsed.wrappedKey) as WrappedKey);
  } catch {
    return false;
  }
  sessionKey = dek;
  await db.vault.put({
    id: VAULT_ID,
    kekSalt: parsed.kekSalt,
    wrappedKey: parsed.wrappedKey,
    recoverySalt: null,
    recoveryWrappedKey: null,
    iv: parsed.iv,
    data: parsed.data,
  });
  scheduleAutoLock();
  return true;
}
