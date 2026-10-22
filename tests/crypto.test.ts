import { describe, expect, it } from 'vitest';
import {
  decryptJSON,
  deriveKey,
  encryptJSON,
  fromBase64,
  randomBytes,
  toBase64,
} from '~/lib/crypto';

describe('crypto', () => {
  it('roundtrips base64', () => {
    const bytes = randomBytes(32);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('derives a usable AES-GCM key', async () => {
    const key = await deriveKey('motdepasse', randomBytes(16));
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('encrypts and decrypts JSON', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('secret-password', salt);
    const payload = { hello: 'world', nested: { n: 42 } };
    const blob = await encryptJSON(key, payload);
    expect(blob.iv).not.toEqual(blob.data);
    const decrypted = await decryptJSON<typeof payload>(key, blob);
    expect(decrypted).toEqual(payload);
  });

  it('fails to decrypt with a wrong key', async () => {
    const key1 = await deriveKey('password-a', randomBytes(16));
    const key2 = await deriveKey('password-b', randomBytes(16));
    const blob = await encryptJSON(key1, { secret: true });
    await expect(decryptJSON(key2, blob)).rejects.toThrow();
  });
});
