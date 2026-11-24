/**
 * Docsave cryptographic core.
 *
 * Pure TypeScript, no React Native imports, so it is unit-testable in Node.
 * Primitives come from the audited @noble libraries:
 *   - AES-256-GCM            @noble/ciphers
 *   - HKDF-SHA256, PBKDF2    @noble/hashes (PBKDF2 runs natively in the app)
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
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
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

// ── Key wrapping with a PIN ──────────────────────────────────────────────────
//
// v2 (current): KEK = PBKDF2-HMAC-SHA256(PIN, 128-bit salt, 600 000 iterations),
//               computed by the platform's native crypto (fast on phones).
// v1 (legacy):  KEK = scrypt(N=2^15, r=8, p=1) in JavaScript. Still accepted for
//               unlocking, then transparently re-wrapped as v2.
// The wrapped key additionally lives inside the Keychain / Android Keystore,
// so an attacker must defeat the secure hardware before an offline PIN search.

export const PBKDF2_ITERATIONS = 600_000;
const MIN_PBKDF2_ITERATIONS = 100_000;

/** Legacy scrypt parameters (v1 wrapped keys only). */
export type KdfParams = { N: number; r: number; p: number };

export type WrappedKeyV1 = {
  v: 1;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string; // base64
  nonce: string; // base64
  ct: string; // base64 (ciphertext || tag)
};

export type WrappedKeyV2 = {
  v: 2;
  kdf: 'pbkdf2-sha256';
  iter: number;
  salt: string;
  nonce: string;
  ct: string;
};

export type WrappedKey = WrappedKeyV1 | WrappedKeyV2;

type B64 = { encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array };

/** PBKDF2 provider: (pin, saltB64, iterations, length) → key (base64). */
type Pbkdf2Provider = (pin: string, saltB64: string, iterations: number, length: number) => Promise<string>;
let pbkdf2Provider: Pbkdf2Provider | null = null;

/** The app installs the native implementation at startup; tests use the JS fallback. */
export function setPbkdf2Provider(fn: Pbkdf2Provider | null): void {
  pbkdf2Provider = fn;
}

const WRAP_AAD = utf8('docsave/wrap/pin/v1');

async function deriveKekV2(pin: string, salt: Uint8Array, iterations: number, b64: B64): Promise<Uint8Array> {
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > 10_000_000) {
    throw new Error('Docsave crypto: KDF parameters out of the allowed range');
  }
  const password = pin.normalize('NFKC');
  if (pbkdf2Provider) {
    return b64.decode(await pbkdf2Provider(password, b64.encode(salt), iterations, KEY_BYTES));
  }
  return pbkdf2Async(sha256, utf8(password), salt, { c: iterations, dkLen: KEY_BYTES, asyncTick: 15 });
}

async function deriveKekV1(pin: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
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
  b64: B64,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<WrappedKeyV2> {
  assertKey(masterKey);
  const salt = randomBytes(16);
  const kek = await deriveKekV2(pin, salt, iterations, b64);
  try {
    const nonce = randomBytes(NONCE_BYTES);
    const ct = gcm(kek, nonce, WRAP_AAD).encrypt(masterKey);
    return {
      v: 2,
      kdf: 'pbkdf2-sha256',
      iter: iterations,
      salt: b64.encode(salt),
      nonce: b64.encode(nonce),
      ct: b64.encode(ct),
    };
  } finally {
    wipe(kek);
  }
}

/** True when a wrapped key uses an older or weaker format and should be re-wrapped. */
/**
 * Wraps the master key and keeps the derived PIN key in memory just long
 * enough to check the stored copy (`verify`), so the slow PBKDF2 step runs
 * once instead of twice. Always call `dispose` (it wipes the derived key).
 */
export async function wrapKeyWithPinVerifiable(
  masterKey: Uint8Array,
  pin: string,
  b64: B64,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<{ wrapped: WrappedKeyV2; verify: (stored: WrappedKey) => boolean; dispose: () => void }> {
  assertKey(masterKey);
  const salt = randomBytes(16);
  const kek = await deriveKekV2(pin, salt, iterations, b64);
  const nonce = randomBytes(NONCE_BYTES);
  const ct = gcm(kek, nonce, WRAP_AAD).encrypt(masterKey);
  const wrapped: WrappedKeyV2 = {
    v: 2,
    kdf: 'pbkdf2-sha256',
    iter: iterations,
    salt: b64.encode(salt),
    nonce: b64.encode(nonce),
    ct: b64.encode(ct),
  };
  return {
    wrapped,
    verify(stored) {
      // Same salt and rounds as written means this PIN derives exactly this key.
      if (stored?.v !== 2 || stored.kdf !== 'pbkdf2-sha256' || stored.salt !== wrapped.salt || stored.iter !== iterations) return false;
      try {
        const key = gcm(kek, b64.decode(stored.nonce), WRAP_AAD).decrypt(b64.decode(stored.ct));
        const same = constantTimeEqual(key, masterKey);
        wipe(key);
        return same;
      } catch {
        return false;
      }
    },
    dispose() {
      wipe(kek);
    },
  };
}

export function needsRewrap(w: WrappedKey): boolean {
  return w.v !== 2 || w.iter < PBKDF2_ITERATIONS;
}

/** Returns the master key, or throws TamperError when the PIN is wrong. */
export async function unwrapKeyWithPin(wrapped: WrappedKey, pin: string, b64: B64): Promise<Uint8Array> {
  let kek: Uint8Array;
  if (wrapped?.v === 2 && wrapped.kdf === 'pbkdf2-sha256') {
    kek = await deriveKekV2(pin, b64.decode(wrapped.salt), wrapped.iter, b64);
  } else if (wrapped?.v === 1 && wrapped.kdf === 'scrypt') {
    kek = await deriveKekV1(pin, b64.decode(wrapped.salt), wrapped);
  } else {
    throw new FormatError('Unsupported key wrapping format.');
  }
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

/** Test helper: create a legacy v1 (scrypt) wrapped key. */
export async function wrapKeyWithPinLegacyV1(
  masterKey: Uint8Array,
  pin: string,
  b64: B64,
  params: KdfParams = { N: 2 ** 14, r: 8, p: 1 },
): Promise<WrappedKeyV1> {
  const salt = randomBytes(16);
  const kek = await deriveKekV1(pin, salt, params);
  try {
    const nonce = randomBytes(NONCE_BYTES);
    const ct = gcm(kek, nonce, WRAP_AAD).encrypt(masterKey);
    return { v: 1, kdf: 'scrypt', ...params, salt: b64.encode(salt), nonce: b64.encode(nonce), ct: b64.encode(ct) };
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
