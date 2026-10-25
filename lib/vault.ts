import Dexie, { type Table } from 'dexie';
import { type VaultData, type LearnedMapping, emptyVault } from './types';

export interface VaultRow {
  id: number;
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

let sessionProfile: VaultRow | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

export const AUTO_LOCK_MINUTES = 15;

export async function getKeepUnlocked(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(KEEP_UNLOCKED_KEY);
    return (result as Record<string, unknown>)[KEEP_UNLOCKED_KEY] === true;
  } catch {
    return false;
  }
}

export async function setKeepUnlocked(value: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [KEEP_UNLOCKED_KEY]: value });
  } catch {
    // ignore (non-Chrome environments)
  }
}

export async function isVaultInitialized(): Promise<boolean> {
  const row = await db.vault.get(VAULT_ID);
  return !!row;
}

export async function tryRestoreSession(): Promise<void> {
  const keepUnlocked = await getKeepUnlocked();
  if (keepUnlocked) {
    const initialized = await isVaultInitialized();
    if (initialized) {
      const row = await db.vault.get(VAULT_ID);
      if (row) {
        sessionProfile = row;
      }
    } else {
      scheduleAutoLock();
    }
  }
}

export function isUnlocked(): boolean {
  return sessionProfile !== null;
}

export function lock(): void {
  sessionProfile = null;
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = null;
}

export async function unlockVault(_password?: string): Promise<boolean> {
  // In the simplified vault, unlock is always successful if the vault is initialized.
  // The password is accepted for backwards compatibility but no crypto is used.
  const initialized = await isVaultInitialized();
  if (initialized) {
    try {
      const row = await db.vault.get(VAULT_ID);
      if (row) {
        sessionProfile = row;
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export async function unlockWithRecoveryKey(recoveryKey: string): Promise<boolean> {
  // In the simplified vault, unlock with recovery key is always successful if the vault is initialized.
  const initialized = await isVaultInitialized();
  if (initialized) {
    try {
      const row = await db.vault.get(VAULT_ID);
      if (row) {
        sessionProfile = row;
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function generateRandomString(length: number = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateRecoveryKey(): string {
  return generateRandomString().match(/.{1,4}/g)!.join('-');
}

export async function createVault(): Promise<{ recoveryKey: string }> {
  const already = await isVaultInitialized();
  if (already) {
    const row = await db.vault.get(VAULT_ID);
    if (!row) throw new Error('Vault not initialized');
    const recoveryKey = generateRecoveryKey();
    return { recoveryKey };
  }
  const recoveryKey = generateRecoveryKey();
  await db.vault.put({ id: VAULT_ID, data: JSON.stringify(emptyVault()) });
  sessionProfile = (await db.vault.get(VAULT_ID)) ?? null;
  return { recoveryKey };
}

export async function loadVault(): Promise<VaultData> {
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  return row.data ? JSON.parse(row.data) as VaultData : emptyVault();
}

export async function saveVault(data: VaultData): Promise<void> {
  if (!sessionProfile) throw new Error('Vault is locked');
  const row = await db.vault.get(VAULT_ID);
  if (!row) throw new Error('Vault not initialized');
  await db.vault.put({ ...row, data: JSON.stringify(data) });
  const keepUnlocked = await getKeepUnlocked();
  if (!keepUnlocked) scheduleAutoLock();
}

export async function addLearnedMappings(newMappings: LearnedMapping[]): Promise<void> {
  if (newMappings.length === 0) return;
  const vault = await loadVault();
  const existing = vault.learnedMappings ?? [];
  const merged = [...existing];
  for (const m of newMappings) {
    const idx = merged.findIndex(
      (e: LearnedMapping) => e.hostname === m.hostname && e.fieldSignature === m.fieldSignature,
    );
    if (idx >= 0) merged[idx] = m;
    else merged.push(m);
  }
  vault.learnedMappings = merged;
  await saveVault(vault);
}

export async function removeLearnedMapping(id: string): Promise<void> {
  const vault = await loadVault();
  vault.learnedMappings = (vault.learnedMappings ?? []).filter((m: LearnedMapping) => m.id !== id);
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
      data: row.data,
    },
    null,
    2,
  );
}

export async function importVault(json: string): Promise<boolean> {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (parsed?.format !== 'formpilot-vault' || typeof parsed.data !== 'string') {
    return false;
  }
  // Dexie put() renvoie la clé, pas la ligne : on construit la ligne nous-mêmes.
  const row: VaultRow = { id: VAULT_ID, data: parsed.data };
  await db.vault.put(row);
  sessionProfile = row;
  return true;
}

function scheduleAutoLock(): void {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    sessionProfile = null;
  }, AUTO_LOCK_MINUTES * 60 * 1000);
}