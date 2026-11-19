import { randomBytes as nodeRandomBytes } from 'crypto';
import {
  PBKDF2_ITERATIONS,
  needsRewrap,
  wrapKeyWithPinLegacyV1,
  FormatError,
  TamperError,
  decryptJson,
  decryptObject,
  deriveObjectKey,
  encryptJson,
  encryptObject,
  generateMasterKey,
  setRandomSource,
  unwrapKeyWithPin,
  validatePin,
  wrapKeyWithPin,
} from '../src/crypto/core';
import { b64 } from '../src/crypto/base64';

beforeAll(() => {
  setRandomSource((n) => new Uint8Array(nodeRandomBytes(n)));
});

const FAST_ITER = 100_000; // minimum accepted; the app uses 600 000 natively

describe('AES-256-GCM object encryption', () => {
  test('round-trips arbitrary binary data', () => {
    const key = generateMasterKey();
    const data = new Uint8Array(nodeRandomBytes(256 * 1024));
    const blob = encryptObject(key, 'page_1', data);
    expect(Buffer.from(decryptObject(key, 'page_1', blob)).equals(Buffer.from(data))).toBe(true);
  });

  test('ciphertext does not contain the plaintext and uses the DSV1 header', () => {
    const key = generateMasterKey();
    const secret = new TextEncoder().encode('PASSPORT NUMBER X1234567 '.repeat(20));
    const blob = encryptObject(key, 'p', secret);
    expect(Buffer.from(blob.subarray(0, 4)).toString()).toBe('DSV1');
    expect(Buffer.from(blob).includes(Buffer.from('X1234567'))).toBe(false);
    expect(blob.length).toBe(secret.length + 4 + 12 + 16);
  });

  test('same plaintext encrypts differently every time (random nonce)', () => {
    const key = generateMasterKey();
    const data = new Uint8Array([1, 2, 3]);
    const a = encryptObject(key, 'x', data);
    const b = encryptObject(key, 'x', data);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test('tampering with any ciphertext byte is detected', () => {
    const key = generateMasterKey();
    const blob = encryptObject(key, 'doc', new Uint8Array(nodeRandomBytes(1000)));
    for (const pos of [4, 10, 16, 500, blob.length - 1]) {
      const bad = blob.slice();
      bad[pos] ^= 0x01;
      expect(() => decryptObject(key, 'doc', bad)).toThrow(TamperError);
    }
  });

  test('truncation and bad header are rejected', () => {
    const key = generateMasterKey();
    const blob = encryptObject(key, 'doc', new Uint8Array(100));
    expect(() => decryptObject(key, 'doc', blob.slice(0, 20))).toThrow(FormatError);
    expect(() => decryptObject(key, 'doc', blob.slice(0, blob.length - 1))).toThrow(TamperError);
    const badMagic = blob.slice();
    badMagic[0] = 0;
    expect(() => decryptObject(key, 'doc', badMagic)).toThrow(FormatError);
  });

  test('a blob cannot be swapped to a different object id', () => {
    const key = generateMasterKey();
    const blob = encryptObject(key, 'passport_front', new Uint8Array([9, 9, 9]));
    expect(() => decryptObject(key, 'ticket_1', blob)).toThrow(TamperError);
  });

  test('wrong key (key loss) cannot decrypt', () => {
    const blob = encryptObject(generateMasterKey(), 'doc', new Uint8Array([1, 2, 3, 4]));
    expect(() => decryptObject(generateMasterKey(), 'doc', blob)).toThrow(TamperError);
  });

  test('per-object keys differ and are deterministic', () => {
    const key = generateMasterKey();
    const k1 = deriveObjectKey(key, 'a');
    expect(Buffer.from(k1).equals(Buffer.from(deriveObjectKey(key, 'a')))).toBe(true);
    expect(Buffer.from(k1).equals(Buffer.from(deriveObjectKey(key, 'b')))).toBe(false);
  });

  test('rejects invalid keys and ids', () => {
    expect(() => encryptObject(new Uint8Array(16), 'a', new Uint8Array(1))).toThrow();
    expect(() => encryptObject(generateMasterKey(), '../etc', new Uint8Array(1))).toThrow();
  });

  test('JSON helpers round-trip the vault index', () => {
    const key = generateMasterKey();
    const index = { version: 1, documents: [{ id: 'd1', name: 'Passport' }] };
    expect(decryptJson(key, '__index__', encryptJson(key, '__index__', index))).toEqual(index);
  });
});

describe('PIN key wrapping (PBKDF2-SHA256 + AES-GCM)', () => {
  test('correct PIN unwraps the master key', async () => {
    const key = generateMasterKey();
    const wrapped = await wrapKeyWithPin(key, '482915', b64, FAST_ITER);
    expect(wrapped.ct).not.toContain(b64.encode(key));
    const out = await unwrapKeyWithPin(wrapped, '482915', b64);
    expect(Buffer.from(out).equals(Buffer.from(key))).toBe(true);
  });

  test('wrong PIN is rejected', async () => {
    const wrapped = await wrapKeyWithPin(generateMasterKey(), '482915', b64, FAST_ITER);
    await expect(unwrapKeyWithPin(wrapped, '482916', b64)).rejects.toThrow(TamperError);
  });

  test('tampered wrapped key is rejected', async () => {
    const wrapped = await wrapKeyWithPin(generateMasterKey(), '482915', b64, FAST_ITER);
    const ct = b64.decode(wrapped.ct);
    ct[0] ^= 1;
    await expect(unwrapKeyWithPin({ ...wrapped, ct: b64.encode(ct) }, '482915', b64)).rejects.toThrow(
      TamperError,
    );
  });

  test('downgraded KDF parameters are refused', async () => {
    const wrapped = await wrapKeyWithPin(generateMasterKey(), '482915', b64, FAST_ITER);
    await expect(unwrapKeyWithPin({ ...wrapped, iter: 1000 }, '482915', b64)).rejects.toThrow();
  });

  test('default is PBKDF2-SHA256 with 600 000 iterations (OWASP)', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    const w = await wrapKeyWithPin(generateMasterKey(), '482915', b64, FAST_ITER);
    expect(w.v).toBe(2);
    expect(w.kdf).toBe('pbkdf2-sha256');
    expect(needsRewrap(w)).toBe(true); // below the default → upgraded on next unlock
  });

  test('legacy v1 (scrypt) keys still unlock and are flagged for upgrade', async () => {
    const key = generateMasterKey();
    const legacy = await wrapKeyWithPinLegacyV1(key, '482915', b64);
    expect(needsRewrap(legacy)).toBe(true);
    expect(Buffer.from(await unwrapKeyWithPin(legacy, '482915', b64)).equals(Buffer.from(key))).toBe(true);
    await expect(unwrapKeyWithPin(legacy, '000000', b64)).rejects.toThrow(TamperError);
  });
});

describe('PIN policy', () => {
  test.each([
    ['12345', 'short'],
    ['111111', 'repeated'],
    ['123456', 'ascending'],
    ['987654', 'descending'],
    ['12a456', 'non-digit'],
    ['1234567890123', 'too long'],
  ])('rejects %s (%s)', (pin) => {
    expect(validatePin(pin)).not.toBeNull();
  });

  test('accepts a reasonable PIN', () => {
    expect(validatePin('480317')).toBeNull();
    expect(validatePin('90517264')).toBeNull();
  });
});

describe('RNG guard', () => {
  test('refuses an all-zero random source', () => {
    setRandomSource((n) => new Uint8Array(n));
    expect(() => generateMasterKey()).toThrow(/RNG failure/);
    setRandomSource((n) => new Uint8Array(nodeRandomBytes(n)));
  });
});
