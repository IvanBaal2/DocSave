/**
 * Key management on top of the platform secure enclave / keystore.
 *
 * expo-secure-store stores values in:
 *   iOS     – Keychain (kSecAttrAccessible…ThisDeviceOnly: never synced to
 *             iCloud Keychain and never restored onto another device)
 *   Android – AES key in the Android Keystore (hardware-backed / StrongBox
 *             where available) encrypting the value
 * With requireAuthentication the platform only releases the value after a
 * successful biometric check (iOS: biometryCurrentSet; Android: BiometricPrompt
 * with a Keystore key that is invalidated when biometrics change).
 *
 * Some Android devices (notably several Huawei models) report the biometric
 * status as "unknown", so the OS refuses biometric-bound Keystore keys. On such
 * devices Docsave falls back to a "device check": the key is stored
 * Keystore-encrypted and released after the OS biometric prompt succeeds. The
 * app tells the user which protection is active.
 *
 * Stored items (no document data ever lives here):
 *   ds.meta          VaultMeta (non-secret)
 *   ds.key.pin       master key wrapped with PBKDF2(PIN)        modes: pin, pin_or_bio
 *   ds.key.bio       master key, biometric-bound (hardware)     mode:  pin_or_bio
 *   ds.key.biosoft   master key, released after OS bio prompt   mode:  pin_or_bio (fallback)
 *   ds.key.pinbio    PIN-wrapped master key, biometric-bound    mode:  pin_and_bio (2FA)
 *   ds.attempts      failed-PIN counter + lockout timestamp
 *   ds.settings      user settings (non-secret)
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { b64 } from '../crypto/base64';
import {
  TamperError,
  generateMasterKey,
  needsRewrap,
  unwrapKeyWithPin,
  wipe,
  wrapKeyWithPin,
  type WrappedKey,
} from '../crypto/core';
import { DEFAULT_SETTINGS, type BioBinding, type Settings, type UnlockMode, type VaultMeta } from './types';

const K = {
  meta: 'ds.meta',
  pin: 'ds.key.pin',
  bio: 'ds.key.bio',
  bioSoft: 'ds.key.biosoft',
  pinBio: 'ds.key.pinbio',
  attempts: 'ds.attempts',
  settings: 'ds.settings',
} as const;

const PLAIN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const bioOptions = (prompt: string): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  authenticationPrompt: prompt,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

export const BIO_PROMPT = 'Unlock your Docsave vault';

export class BiometricKeyUnavailableError extends Error {
  constructor(message = 'Biometric key is unavailable. Biometrics may have changed on this device.') {
    super(message);
    this.name = 'BiometricKeyUnavailableError';
  }
}

export class BiometricCancelledError extends Error {
  constructor() {
    super('Biometric authentication was cancelled.');
    this.name = 'BiometricCancelledError';
  }
}

/** Thrown when an unlock mode cannot be enabled on this device. */
export class BiometricSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BiometricSetupError';
  }
}

export class VaultExistsError extends Error {
  constructor() {
    super('A vault already exists on this device. It was not changed.');
    this.name = 'VaultExistsError';
  }
}

function describe(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  // Strip native wrapper prefixes such as "Call to function ... has been rejected. → Caused by:"
  const caused = /Caused by:\s*(.+)$/s.exec(msg);
  return (caused ? caused[1] : msg).trim();
}

// ── Meta & settings ──────────────────────────────────────────────────────────

export async function readMeta(): Promise<VaultMeta | null> {
  const raw = await SecureStore.getItemAsync(K.meta, PLAIN);
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw) as VaultMeta;
    return meta?.version === 1 ? meta : null;
  } catch {
    return null;
  }
}

async function writeMeta(meta: VaultMeta): Promise<void> {
  await SecureStore.setItemAsync(K.meta, JSON.stringify(meta), PLAIN);
}

export async function readSettings(): Promise<Settings> {
  const raw = await SecureStore.getItemAsync(K.settings, PLAIN);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(s: Settings): Promise<void> {
  await SecureStore.setItemAsync(K.settings, JSON.stringify(s), PLAIN);
}

// ── Vault creation ───────────────────────────────────────────────────────────

/**
 * Creates the vault keys. The PIN-protected key is always created first, so
 * the vault never depends on biometrics succeeding. The requested biometric
 * mode is then applied; if the device refuses it, the vault stays usable with
 * the PIN and `biometricError` explains why.
 */
export async function createVaultKeys(params: {
  vaultId: string;
  pin: string;
  unlockMode: UnlockMode;
}): Promise<{ masterKey: Uint8Array; meta: VaultMeta; biometricError?: string }> {
  if (await readMeta()) throw new VaultExistsError();
  const masterKey = generateMasterKey();
  const meta: VaultMeta = {
    version: 1,
    vaultId: params.vaultId,
    createdAt: Date.now(),
    unlockMode: 'pin',
    pinLength: params.pin.length,
  };
  try {
    const wrapped = await wrapKeyWithPin(masterKey, params.pin, b64);
    await SecureStore.setItemAsync(K.pin, JSON.stringify(wrapped), PLAIN);
    await writeMeta(meta);
    await resetAttempts();
  } catch (e) {
    wipe(masterKey);
    await destroyAllKeys();
    throw new Error(`The secure key store refused to save the vault key: ${describe(e)}`);
  }
  if (params.unlockMode === 'pin') return { masterKey, meta };
  try {
    const updated = await applyUnlockMode(masterKey, params.pin, meta, params.unlockMode);
    return { masterKey, meta: updated };
  } catch (e) {
    return { masterKey, meta, biometricError: describe(e) };
  }
}

// ── Unlocking ────────────────────────────────────────────────────────────────

async function readWrapped(key: string, opts: SecureStore.SecureStoreOptions): Promise<WrappedKey | null> {
  const raw = await SecureStore.getItemAsync(key, opts);
  return raw ? (JSON.parse(raw) as WrappedKey) : null;
}

/** PIN unlock for 'pin' and 'pin_or_bio' modes. Throws TamperError on wrong PIN. */
export async function unlockWithPin(pin: string): Promise<Uint8Array> {
  const wrapped = await readWrapped(K.pin, PLAIN);
  if (!wrapped) throw new BiometricKeyUnavailableError('PIN key not found on this device.');
  const key = await unwrapKeyWithPin(wrapped, pin, b64);
  if (needsRewrap(wrapped)) {
    // Upgrade legacy / weaker key wrapping transparently (the PIN is correct here).
    try {
      await SecureStore.setItemAsync(K.pin, JSON.stringify(await wrapKeyWithPin(key, pin, b64)), PLAIN);
    } catch {
      // Keep the old wrapping; unlocking still works.
    }
  }
  return key;
}

function mapBioError(e: unknown): never {
  const msg = describe(e).toLowerCase();
  if (msg.includes('cancel')) throw new BiometricCancelledError();
  throw new BiometricKeyUnavailableError();
}

/** Biometric unlock for 'pin_or_bio' mode. */
export async function unlockWithBiometrics(binding: BioBinding = 'hardware'): Promise<Uint8Array> {
  let raw: string | null;
  if (binding === 'device-check') {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: BIO_PROMPT,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'weak',
    });
    if (!res.success) {
      if (res.error === 'user_cancel' || res.error === 'system_cancel' || res.error === 'user_fallback') {
        throw new BiometricCancelledError();
      }
      throw new BiometricKeyUnavailableError();
    }
    raw = await SecureStore.getItemAsync(K.bioSoft, PLAIN);
  } else {
    try {
      raw = await SecureStore.getItemAsync(K.bio, bioOptions(BIO_PROMPT));
    } catch (e) {
      mapBioError(e);
    }
  }
  if (!raw) throw new BiometricKeyUnavailableError();
  const key = b64.decode(raw);
  if (key.length !== 32) throw new BiometricKeyUnavailableError();
  return key;
}

/** 2FA step 1: biometric check releases the PIN-wrapped key. */
export async function fetchTwoFactorWrappedKey(): Promise<WrappedKey> {
  let wrapped: WrappedKey | null;
  try {
    wrapped = await readWrapped(K.pinBio, bioOptions(BIO_PROMPT));
  } catch (e) {
    mapBioError(e);
  }
  if (!wrapped) throw new BiometricKeyUnavailableError();
  return wrapped;
}

/** 2FA step 2: PIN unwraps the key released by step 1. */
export async function unlockTwoFactor(wrapped: WrappedKey, pin: string): Promise<Uint8Array> {
  return unwrapKeyWithPin(wrapped, pin, b64);
}

/**
 * Checks a PIN while the vault is unlocked (for confirmations). In 2FA mode the
 * PIN-wrapped key is behind biometrics, so the caller must supply it.
 */
export async function verifyPin(
  pin: string,
  masterKey: Uint8Array,
  mode: UnlockMode,
  cachedTwoFactorWrapped?: WrappedKey | null,
): Promise<boolean> {
  try {
    const wrapped =
      mode === 'pin_and_bio'
        ? cachedTwoFactorWrapped ?? (await fetchTwoFactorWrappedKey())
        : await readWrapped(K.pin, PLAIN);
    if (!wrapped) return false;
    const key = await unwrapKeyWithPin(wrapped, pin, b64);
    const same = key.length === masterKey.length && key.every((b, i) => b === masterKey[i]);
    wipe(key);
    return same;
  } catch (e) {
    if (e instanceof TamperError) return false;
    throw e;
  }
}

// ── Changing PIN / unlock mode ───────────────────────────────────────────────

/** Stores the keys for a mode. Returns how biometrics are bound (if used). */
async function storeForMode(masterKey: Uint8Array, pin: string, mode: UnlockMode): Promise<BioBinding | undefined> {
  const wrapped = JSON.stringify(await wrapKeyWithPin(masterKey, pin, b64));
  if (mode === 'pin_and_bio') {
    // Two-factor requires a hardware-bound biometric key; there is no fallback.
    try {
      await SecureStore.setItemAsync(K.pinBio, wrapped, bioOptions('Confirm to enable two-factor unlock'));
    } catch (e) {
      throw new BiometricSetupError(
        `This device does not allow biometric-protected keys (${describe(e)}). Two-factor unlock is not available; use "Fingerprint or PIN" or "PIN only".`,
      );
    }
    await SecureStore.deleteItemAsync(K.pin, PLAIN);
    await safeDelete(K.bio, bioOptions(BIO_PROMPT));
    await safeDelete(K.bioSoft, PLAIN);
    return 'hardware';
  }

  await SecureStore.setItemAsync(K.pin, wrapped, PLAIN);
  await safeDelete(K.pinBio, bioOptions(BIO_PROMPT));
  if (mode === 'pin') {
    await safeDelete(K.bio, bioOptions(BIO_PROMPT));
    await safeDelete(K.bioSoft, PLAIN);
    return undefined;
  }

  // mode === 'pin_or_bio'
  try {
    await SecureStore.setItemAsync(K.bio, b64.encode(masterKey), bioOptions('Confirm to enable biometric unlock'));
    await safeDelete(K.bioSoft, PLAIN);
    return 'hardware';
  } catch (e) {
    if (describe(e).toLowerCase().includes('cancel')) throw new BiometricCancelledError();
    // Device refuses biometric-bound keys: fall back to an OS biometric check
    // (face or fingerprint). Some phones report an "unknown" status yet show
    // the system prompt fine, so we simply try it.
    const check = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to enable face / fingerprint unlock',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'weak',
    });
    if (!check.success) {
      const reason =
        check.error === 'not_enrolled'
          ? 'No face or fingerprint is set up in this phone’s settings.'
          : check.error === 'not_available'
            ? 'This phone does not offer face or fingerprint to apps.'
            : check.error === 'user_cancel' || check.error === 'system_cancel'
              ? 'The face / fingerprint check was cancelled.'
              : `Biometric confirmation failed (${check.error}).`;
      throw new BiometricSetupError(reason);
    }
    await SecureStore.setItemAsync(K.bioSoft, b64.encode(masterKey), PLAIN);
    await safeDelete(K.bio, bioOptions(BIO_PROMPT));
    return 'device-check';
  }
}

export async function applyUnlockMode(
  masterKey: Uint8Array,
  pin: string,
  meta: VaultMeta,
  mode: UnlockMode,
): Promise<VaultMeta> {
  const binding = await storeForMode(masterKey, pin, mode);
  const updated: VaultMeta = { ...meta, unlockMode: mode, pinLength: pin.length, bioBinding: binding };
  await writeMeta(updated);
  return updated;
}

export async function changePin(masterKey: Uint8Array, newPin: string, meta: VaultMeta): Promise<VaultMeta> {
  return applyUnlockMode(masterKey, newPin, meta, meta.unlockMode);
}

// ── Brute-force protection ───────────────────────────────────────────────────

export type Attempts = { failed: number; lockedUntil: number };
export const MAX_ATTEMPTS_BEFORE_WIPE = 10;

export async function getAttempts(): Promise<Attempts> {
  const raw = await SecureStore.getItemAsync(K.attempts, PLAIN);
  if (!raw) return { failed: 0, lockedUntil: 0 };
  try {
    return JSON.parse(raw) as Attempts;
  } catch {
    return { failed: 0, lockedUntil: 0 };
  }
}

/** 5 free attempts, then 30 s, 1 min, 2 min … capped at 1 hour. */
export function lockoutMsFor(failed: number): number {
  if (failed < 5) return 0;
  return Math.min(30_000 * 2 ** (failed - 5), 60 * 60_000);
}

export async function recordFailedAttempt(): Promise<Attempts> {
  const cur = await getAttempts();
  const failed = cur.failed + 1;
  const next = { failed, lockedUntil: Date.now() + lockoutMsFor(failed) };
  await SecureStore.setItemAsync(K.attempts, JSON.stringify(next), PLAIN);
  return next;
}

export async function resetAttempts(): Promise<void> {
  await SecureStore.setItemAsync(K.attempts, JSON.stringify({ failed: 0, lockedUntil: 0 }), PLAIN);
}

// ── Destruction (crypto-shredding) ───────────────────────────────────────────

async function safeDelete(key: string, opts: SecureStore.SecureStoreOptions): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, opts);
  } catch {
    // Item absent or already invalidated.
  }
}

/** Deletes every key. Without the master key, all vault ciphertext is unrecoverable. */
export async function destroyAllKeys(): Promise<void> {
  for (const key of Object.values(K)) {
    await safeDelete(key, PLAIN);
    await safeDelete(key, bioOptions(BIO_PROMPT));
  }
}
