import { argon2id } from 'hash-wasm';

const te = new TextEncoder();
const td = new TextDecoder();

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 32 * 1024,
  hashLength: 32,
} as const;

export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const hash = await argon2id({
    password,
    salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySize,
    hashLength: ARGON2_PARAMS.hashLength,
    outputType: 'binary',
  });
  return crypto.subtle.importKey(
    'raw',
    hash as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBlob {
  iv: string;
  data: string;
  salt: string;
}

export async function encryptJSON(
  key: CryptoKey,
  value: unknown,
): Promise<{ iv: string; data: string }> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    te.encode(JSON.stringify(value)) as unknown as BufferSource,
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptJSON<T>(
  key: CryptoKey,
  blob: { iv: string; data: string },
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) as unknown as BufferSource },
    key,
    fromBase64(blob.data) as unknown as BufferSource,
  );
  return JSON.parse(td.decode(plaintext)) as T;
}
