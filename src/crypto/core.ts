/**
 * Docsave cryptographic core.
 *
 * Pure TypeScript, no React Native imports, so it is unit-testable in Node.
 * Primitives come from the audited @noble libraries:
 *   - AES-256-GCM            @noble/ciphers
 *   - HKDF-SHA256, scrypt    @noble/hashes
 *
 * Randomness is injected (see setRandomSource) so the app uses the platform
 * CSPRNG (expo-crypto → SecRandomCopyBytes / SecureRandom) and tests use Node's.
 *
 * ── Encrypted blob format (v1) ─────────────────────────────────────────────
 *   offset  size  field
 *   0       4     magic "DSV1"
 *   4       12    random 96-bit GCM nonce
 *   16      n+16  AES-256-GCM ciphertext || 128-bit tag
 *
 *   key = HKDF-SHA256(ikm = vault master key, salt = "docsave/v1",
 *                     info = "docsave/blob/" + objectId, 32 bytes)
 *   aad = "docsave/aad/v1/" + objectId
 *
 * A per-object key plus object-bound AAD means a blob cannot be swapped for
 * another (e.g. passport ↔ ticket) without the authentication tag failing.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
const MAGIC = new Uint8Array([0x44, 0x53, 0x56, 0x31]); // "DSV1"
const HEADER_BYTES = MAGIC.length + NONCE_BYTES;

const enc = new TextEncoder();
const dec = new TextDecoder();

export class TamperError extends Error {
  constructor(message = 'Integrity check failed: data was modified or the key is wrong.') {
    super(message);
    this.name = 'TamperError';
  }
}

export class FormatError extends Error {
  constructor(message = 'Not a Docsave encrypted object.') {
    super(message);
    this.name = 'FormatError';
  }
}

// ── Randomness ───────────────────────────────────────────────────────────────

type RandomSource = (n: number) => Uint8Array;
let randomSource: RandomSource | null = null;

/** Must be called once at startup with a CSPRNG. */
export function setRandomSource(fn: RandomSource): void {
  randomSource = fn;
}

export function randomBytes(n: number): Uint8Array {
  if (!randomSource) throw new Error('Docsave crypto: no secure random source configured');
  const out = randomSource(n);
  if (!(out instanceof Uint8Array) || out.length !== n) {
    throw new Error('Docsave crypto: random source returned invalid output');
  }
  // Defensive: refuse an all-zero buffer for anything key/nonce sized.
  if (n >= 12 && out.every((b) => b === 0)) throw new Error('Docsave crypto: RNG failure');
  return out;
}

export function generateMasterKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const utf8 = (s: string): Uint8Array => enc.encode(s);
export const fromUtf8 = (b: Uint8Array): string => dec.decode(b);

/** Best-effort zeroisation of key material held in JS memory. */
export function wipe(...bufs: (Uint8Array | null | undefined)[]): void {
  for (const b of bufs) if (b) b.fill(0);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function assertKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) {
    throw new Error('Docsave crypto: key must be 32 bytes (AES-256)');
  }
}

function assertObjectId(id: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Docsave crypto: invalid object id');
}

/** Per-object subkey: HKDF-SHA256(masterKey, info = "docsave/blob/<id>"). */
export function deriveObjectKey(masterKey: Uint8Array, objectId: string): Uint8Array {
  assertKey(masterKey);
  assertObjectId(objectId);
  return hkdf(sha256, masterKey, utf8('docsave/v1'), utf8(`docsave/blob/${objectId}`), KEY_BYTES);
}

// ── Object (file / index) encryption ────────────────────────────────────────

export function encryptObject(masterKey: Uint8Array, objectId: string, plaintext: Uint8Array): Uint8Array {
  const key = deriveObjectKey(masterKey, objectId);
  try {
    const nonce = randomBytes(NONCE_BYTES);
    const ct = gcm(key, nonce, utf8(`docsave/aad/v1/${objectId}`)).encrypt(plaintext);
    const out = new Uint8Array(HEADER_BYTES + ct.length);
    out.set(MAGIC, 0);
    out.set(nonce, MAGIC.length);
    out.set(ct, HEADER_BYTES);
    return out;
  } finally {
    wipe(key);
  }
}

export function decryptObject(masterKey: Uint8Array, objectId: string, blob: Uint8Array): Uint8Array {
  if (blob.length < HEADER_BYTES + TAG_BYTES) throw new FormatError('Encrypted object is truncated.');
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) throw new FormatError();
  }
  const key = deriveObjectKey(masterKey, objectId);
  try {
    const nonce = blob.subarray(MAGIC.length, HEADER_BYTES);
    const ct = blob.subarray(HEADER_BYTES);
    return gcm(key, nonce, utf8(`docsave/aad/v1/${objectId}`)).decrypt(ct);
  } catch (e) {
    if (e instanceof FormatError) throw e;
    throw new TamperError();
  } finally {
    wipe(key);
  }
}

export function encryptJson(masterKey: Uint8Array, objectId: string, value: unknown): Uint8Array {
  return encryptObject(masterKey, objectId, utf8(JSON.stringify(value)));
}

export function decryptJson<T>(masterKey: Uint8Array, objectId: string, blob: Uint8Array): T {
  const plain = decryptObject(masterKey, objectId, blob);
  try {
    return JSON.parse(fromUtf8(plain)) as T;
  } finally {
    wipe(plain);
  }
}

// ── Key wrapping with a PIN (scrypt KEK) ─────────────────────────────────────

export type KdfParams = { N: number; r: number; p: number };

/**
 * scrypt N=2^15, r=8, p=1 (32 MiB). The wrapped key additionally sits inside
 * the hardware-backed Keychain / Keystore, so an attacker must defeat the
 * secure element before even starting an offline PIN search.
 */
export const DEFAULT_KDF: KdfParams = { N: 2 ** 15, r: 8, p: 1 };

export type WrappedKey = {
  v: 1;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string; // base64
  nonce: string; // base64
  ct: string; // base64 (ciphertext || tag)
};

const WRAP_AAD = utf8('docsave/wrap/pin/v1');

async function deriveKek(pin: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  if (params.N < 2 ** 14 || params.N > 2 ** 20 || params.r < 8 || params.p < 1) {
    throw new Error('Docsave crypto: KDF parameters out of the allowed range');
  }
  return scryptAsync(utf8(pin.normalize('NFKC')), salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: KEY_BYTES,
    asyncTick: 15,
    maxmem: 2 ** 27,
  });
}

export async function wrapKeyWithPin(
  masterKey: Uint8Array,
  pin: string,
  b64: { encode: (b: Uint8Array) => string },
  params: KdfParams = DEFAULT_KDF,
): Promise<WrappedKey> {
  assertKey(masterKey);
  const salt = randomBytes(16);
  const kek = await deriveKek(pin, salt, params);
  try {
    const nonce = randomBytes(NONCE_BYTES);
    const ct = gcm(kek, nonce, WRAP_AAD).encrypt(masterKey);
    return {
      v: 1,
      kdf: 'scrypt',
      ...params,
      salt: b64.encode(salt),
      nonce: b64.encode(nonce),
      ct: b64.encode(ct),
    };
  } finally {
    wipe(kek);
  }
}

/** Returns the master key, or throws TamperError when the PIN is wrong. */
export async function unwrapKeyWithPin(
  wrapped: WrappedKey,
  pin: string,
  b64: { decode: (s: string) => Uint8Array },
): Promise<Uint8Array> {
  if (wrapped?.v !== 1 || wrapped.kdf !== 'scrypt') throw new FormatError('Unsupported key wrapping format.');
  const kek = await deriveKek(pin, b64.decode(wrapped.salt), wrapped);
  try {
    const key = gcm(kek, b64.decode(wrapped.nonce), WRAP_AAD).decrypt(b64.decode(wrapped.ct));
    assertKey(key);
    return key;
  } catch {
    throw new TamperError('Incorrect PIN.');
  } finally {
    wipe(kek);
  }
}

// ── PIN policy ───────────────────────────────────────────────────────────────

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'Use digits only.';
  if (pin.length < 6) return 'Use at least 6 digits.';
  if (pin.length > 12) return 'Use at most 12 digits.';
  if (/^(\d)\1+$/.test(pin)) return 'Avoid repeating the same digit.';
  const digits = pin.split('').map(Number);
  const asc = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  const desc = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
  if (asc || desc) return 'Avoid sequences like 123456.';
  const common = ['121212', '112233', '123123', '654321', '696969', '159753', '200000', '520520'];
  if (common.includes(pin)) return 'This PIN is too common.';
  return null;
}
