import Dexie, { type Table } from 'dexie';
import {
  decryptJSON,
  deriveKey,
  encryptJSON,
  randomBytes,
  toBase64,
  fromBase64,
} from './crypto';
import { emptyVault, migrateVault, type LearnedMapping, type VaultData } from './types';

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
const KEEP_UNLOCKED_KEY = 'formpilot_keepUnlocked';

let sessionKey: CryptoKey | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

export const AUTO_LOCK_MINUTES = 15;

// ── Keep-unlocked preference ──────────────────────────────────────────────────

/** Read the "keep unlocked" flag from browser.storage.local (non-blocking). */
export async function getKeepUnlocked(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(KEEP_UNLOCKED_KEY);
    return (result as Record<string, unknown>)[KEEP_UNLOCKED_KEY] === true;
  } catch {
    return false;
  }
}

/** Persist the "keep unlocked" flag. */
export async function setKeepUnlocked(value: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [KEEP_UNLOCKED_KEY]: value });
  } catch {
    // ignore (non-Chrome environments)
  }
}

// ── Persisted session key (keep-unlocked mode) ───────────────────────────────

/**
 * When keepUnlocked is true we persist the raw DEK in chrome.storage.local.
 * This is a deliberate security trade-off: the key is accessible to any
 * extension code but NOT to web pages or other extensions.
 */
const PERSISTED_KEY_KEY = 'formpilot_sessionKeyRaw';

async function persistSessionKey(key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const b64 = toBase64(new Uint8Array(raw as ArrayBuffer));
  await browser.storage.local.set({ [PERSISTED_KEY_KEY]: b64 });
}

async function loadPersistedSessionKey(): Promise<CryptoKey | null> {
  try {
    const result = await browser.storage.local.get(PERSISTED_KEY_KEY);
    const b64: string | undefined = (result as Record<string, unknown>)[PERSISTED_KEY_KEY] as string | undefined;
    if (!b64) return null;
    return crypto.subtle.importKey('raw', fromBase64(b64) as unknown as BufferSource, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    return null;
  }
}

async function clearPersistedSessionKey(): Promise<void> {
  try {
    await browser.storage.local.remove(PERSISTED_KEY_KEY);
  } catch {
    // ignore
  }
}

// ── Key wrapping helpers ──────────────────────────────────────────────────────

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

// ── Auto-lock ─────────────────────────────────────────────────────────────────

function scheduleAutoLock(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(
    () => {
      sessionKey = null;
    },
    AUTO_LOCK_MINUTES * 60 * 1000,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

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
  clearPersistedSessionKey();
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

  const keepUnlocked = await getKeepUnlocked();
  if (keepUnlocked) {
    await persistSessionKey(dek);
  } else {
    scheduleAutoLock();
  }

  return { recoveryKey };
}

export async function unlockVault(password: string): Promise<boolean> {
  const row = await db.vault.get(VAULT_ID);
  if (!row) return false;
  const kek = await deriveKey(password, fromBase64(row.kekSalt));
  try {
    const dek = await unwrapKey(kek, JSON.parse(row.wrappedKey) as WrappedKey);
    sessionKey = dek;

    const keepUnlocked = await getKeepUnlocked();
    if (keepUnlocked) {
      await persistSessionKey(dek);
    } else {
      scheduleAutoLock();
    }

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

    const keepUnlocked = await getKeepUnlocked();
    if (keepUnlocked) {
      await persistSessionKey(dek);
    } else {
      scheduleAutoLock();
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Try to restore the session key from chrome.storage.local (keepUnlocked mode).
 * Call this at startup before isUnlocked() to transparently resume the session.
 */
export async function tryRestoreSession(): Promise<boolean> {
  if (sessionKey) return true;
  const keepUnlocked = await getKeepUnlocked();
  if (!keepUnlocked) return false;
  const key = await loadPersistedSessionKey();
  if (!key) return false;
  sessionKey = key;
  return true;
}

export async function loadVault(): Promise<VaultData> {
  if (!sessionKey) throw new Error('Vault is locked');
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');

  const keepUnlocked = await getKeepUnlocked();
  if (!keepUnlocked) scheduleAutoLock();

  const raw = await decryptJSON<VaultData>(sessionKey, { iv: row.iv, data: row.data });
  return migrateVault(raw as Parameters<typeof migrateVault>[0]);
}

export async function saveVault(data: VaultData): Promise<void> {
  if (!sessionKey) throw new Error('Vault is locked');
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  const { iv, data: encrypted } = await encryptJSON(sessionKey, data);
  await db.vault.put({ ...row, iv, data: encrypted });

  const keepUnlocked = await getKeepUnlocked();
  if (!keepUnlocked) scheduleAutoLock();
}

/**
 * Upsert a batch of learned mappings into the vault.
 * If a mapping with the same (hostname, fieldSignature) already exists it is replaced.
 */
export async function addLearnedMappings(newMappings: LearnedMapping[]): Promise<void> {
  if (newMappings.length === 0) return;
  const vault = await loadVault();
  const existing = vault.learnedMappings ?? [];
  const merged = [...existing];
  for (const m of newMappings) {
    const idx = merged.findIndex(
      (e) => e.hostname === m.hostname && e.fieldSignature === m.fieldSignature,
    );
    if (idx >= 0) merged[idx] = m;
    else merged.push(m);
  }
  vault.learnedMappings = merged;
  await saveVault(vault);
}

/** Remove a single learned mapping by its id. */
export async function removeLearnedMapping(id: string): Promise<void> {
  const vault = await loadVault();
  vault.learnedMappings = (vault.learnedMappings ?? []).filter((m) => m.id !== id);
  await saveVault(vault);
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

  const keepUnlocked = await getKeepUnlocked();
  if (keepUnlocked) {
    await persistSessionKey(dek);
  } else {
    scheduleAutoLock();
  }

  return true;
}
