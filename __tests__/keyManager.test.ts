import { randomBytes as nodeRandomBytes } from 'crypto';

// In-memory stand-in for the Keychain / Keystore. Biometric-gated items live in
// a separate namespace, like expo-secure-store's auth / no-auth services.
const mockStore = new Map<string, string>();
const mockNs = (k: string, o?: { requireAuthentication?: boolean }) => `${o?.requireAuthentication ? 'auth' : 'plain'}:${k}`;
let mockBiometric: 'ok' | 'cancel' | 'invalidated' | 'unsupported' = 'ok';
let mockOsCheck = true;

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => (mockOsCheck ? { success: true } : { success: false, error: 'user_cancel' })),
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 2,
  getItemAsync: jest.fn(async (k: string, o?: { requireAuthentication?: boolean }) => {
    if (o?.requireAuthentication) {
      if (mockBiometric === 'cancel') throw new Error('User canceled the operation');
      if (mockBiometric === 'invalidated') throw new Error('Key permanently invalidated');
    }
    return mockStore.get(mockNs(k, o)) ?? null;
  }),
  setItemAsync: jest.fn(async (k: string, v: string, o?: { requireAuthentication?: boolean }) => {
    if (o?.requireAuthentication && mockBiometric === 'unsupported') {
      // What some Huawei devices report via expo-secure-store:
      throw new Error("Call to function 'ExpoSecureStore.setValueWithKeyAsync' has been rejected. → Caused by: Could not authenticate the user: Biometric authentication status is unknown");
    }
    mockStore.set(mockNs(k, o), v);
  }),
  deleteItemAsync: jest.fn(async (k: string, o?: { requireAuthentication?: boolean }) => {
    mockStore.delete(mockNs(k, o));
  }),
}));

import { TamperError, setRandomSource } from '../src/crypto/core';
import * as Keys from '../src/vault/keyManager';

// Use the minimum allowed scrypt cost in tests to keep them fast.
jest.mock('../src/crypto/core', () => {
  const actual = jest.requireActual('../src/crypto/core');
  return {
    ...actual,
    wrapKeyWithPin: (k: Uint8Array, pin: string, b64: unknown) => actual.wrapKeyWithPin(k, pin, b64, 100_000),
    wrapKeyWithPinVerifiable: (k: Uint8Array, pin: string, b64: unknown) => actual.wrapKeyWithPinVerifiable(k, pin, b64, 100_000),
  };
});

jest.setTimeout(60_000); // real PBKDF2 in JavaScript (the app runs it natively)
beforeAll(() => setRandomSource((n) => new Uint8Array(nodeRandomBytes(n))));
beforeEach(() => {
  mockStore.clear();
  mockBiometric = 'ok';
  mockOsCheck = true;
});

const eq = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

describe('vault key lifecycle', () => {
  test('PIN-only vault: correct PIN unlocks, wrong PIN is rejected', async () => {
    const { masterKey, meta } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin' });
    expect(meta.unlockMode).toBe('pin');
    expect(eq(await Keys.unlockWithPin('480317'), masterKey)).toBe(true);
    await expect(Keys.unlockWithPin('480318')).rejects.toThrow(TamperError);
  });

  test('the raw master key is never stored without biometric protection', async () => {
    const { masterKey } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    const b64key = Buffer.from(masterKey).toString('base64');
    for (const [k, v] of mockStore) {
      if (k.startsWith('plain:')) expect(v.includes(b64key)).toBe(false);
    }
    expect(mockStore.get('auth:ds.key.bio')).toBe(b64key);
  });

  test('biometric-or-PIN vault unlocks with biometrics; cancel is reported', async () => {
    const { masterKey } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    expect(eq(await Keys.unlockWithBiometrics(), masterKey)).toBe(true);
    mockBiometric = 'cancel';
    await expect(Keys.unlockWithBiometrics()).rejects.toThrow(Keys.BiometricCancelledError);
    // PIN still works as fallback
    expect(eq(await Keys.unlockWithPin('480317'), masterKey)).toBe(true);
  });

  test('two-factor vault needs biometrics AND PIN', async () => {
    const { masterKey } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_and_bio' });
    expect(mockStore.has('plain:ds.key.pin')).toBe(false); // PIN alone is not enough
    expect(mockStore.has('auth:ds.key.bio')).toBe(false); // biometrics alone is not enough
    const wrapped = await Keys.fetchTwoFactorWrappedKey();
    await expect(Keys.unlockTwoFactor(wrapped, '000000')).rejects.toThrow(TamperError);
    expect(eq(await Keys.unlockTwoFactor(wrapped, '480317'), masterKey)).toBe(true);
  });

  test('two-factor vault becomes inaccessible when biometrics change (no recovery)', async () => {
    await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_and_bio' });
    mockBiometric = 'invalidated';
    await expect(Keys.fetchTwoFactorWrappedKey()).rejects.toThrow(Keys.BiometricKeyUnavailableError);
  });

  test('changing the PIN keeps the same master key and invalidates the old PIN', async () => {
    const { masterKey, meta } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin' });
    await Keys.changePin(masterKey, '73920154', meta);
    await expect(Keys.unlockWithPin('480317')).rejects.toThrow(TamperError);
    expect(eq(await Keys.unlockWithPin('73920154'), masterKey)).toBe(true);
    expect((await Keys.readMeta())?.pinLength).toBe(8);
  });

  test('switching unlock modes removes keys of the previous mode', async () => {
    const { masterKey, meta } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    const m2 = await Keys.applyUnlockMode(masterKey, '480317', meta, 'pin');
    expect(m2.unlockMode).toBe('pin');
    expect(mockStore.has('auth:ds.key.bio')).toBe(false);
  });

  test('verifyPin accepts only the right PIN', async () => {
    const { masterKey } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin' });
    expect(await Keys.verifyPin('480317', masterKey, 'pin')).toBe(true);
    expect(await Keys.verifyPin('111222', masterKey, 'pin')).toBe(false);
  });

  test('key loss: after destroying keys nothing can unlock', async () => {
    await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    await Keys.destroyAllKeys();
    expect(mockStore.size).toBe(0);
    expect(await Keys.readMeta()).toBeNull();
    await expect(Keys.unlockWithPin('480317')).rejects.toThrow();
    await expect(Keys.unlockWithBiometrics()).rejects.toThrow(Keys.BiometricKeyUnavailableError);
  });
});

describe('devices that refuse biometric-bound keys (e.g. some Huawei phones)', () => {
  test('vault creation still succeeds and falls back to an OS biometric check', async () => {
    mockBiometric = 'unsupported';
    const { masterKey, meta, biometricError } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    expect(biometricError).toBeUndefined();
    expect(meta.unlockMode).toBe('pin_or_bio');
    expect(meta.bioBinding).toBe('device-check');
    expect(eq(await Keys.unlockWithBiometrics('device-check'), masterKey)).toBe(true);
    expect(eq(await Keys.unlockWithPin('480317'), masterKey)).toBe(true);
  });

  test('if the OS biometric check is declined, the vault is created with PIN only and explains why', async () => {
    mockBiometric = 'unsupported';
    mockOsCheck = false;
    const { masterKey, meta, biometricError } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_or_bio' });
    expect(meta.unlockMode).toBe('pin');
    expect(biometricError).toMatch(/cancelled/);
    expect(eq(await Keys.unlockWithPin('480317'), masterKey)).toBe(true);
    expect(mockStore.has('plain:ds.key.biosoft')).toBe(false);
  });

  test('two-factor is refused with a clear message (no weak fallback)', async () => {
    mockBiometric = 'unsupported';
    const { meta, biometricError } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin_and_bio' });
    expect(meta.unlockMode).toBe('pin');
    expect(biometricError).toMatch(/Two-factor unlock is not available/);
    expect(biometricError).toMatch(/status is unknown/);
  });

  test('an existing vault is never overwritten', async () => {
    await Keys.createVaultKeys({ vaultId: 'v1', pin: '480317', unlockMode: 'pin' });
    await expect(Keys.createVaultKeys({ vaultId: 'v2', pin: '111999', unlockMode: 'pin' })).rejects.toThrow(Keys.VaultExistsError);
    expect((await Keys.readMeta())?.vaultId).toBe('v1');
  });
});

describe('brute-force protection', () => {
  test('lockout schedule', () => {
    expect([0, 1, 4].map(Keys.lockoutMsFor)).toEqual([0, 0, 0]);
    expect(Keys.lockoutMsFor(5)).toBe(30_000);
    expect(Keys.lockoutMsFor(6)).toBe(60_000);
    expect(Keys.lockoutMsFor(7)).toBe(120_000);
    expect(Keys.lockoutMsFor(50)).toBe(3_600_000);
  });

  test('failed attempts are counted and persisted; reset clears them', async () => {
    for (let i = 0; i < 5; i++) await Keys.recordFailedAttempt();
    const a = await Keys.getAttempts();
    expect(a.failed).toBe(5);
    expect(a.lockedUntil).toBeGreaterThan(Date.now());
    await Keys.resetAttempts();
    expect((await Keys.getAttempts()).failed).toBe(0);
  });
});

describe('real PBKDF2 provider (like the native module)', () => {
  const { pbkdf2Sync } = require('crypto');
  const { setPbkdf2Provider } = jest.requireActual('../src/crypto/core');
  beforeAll(() =>
    setPbkdf2Provider(async (pin: string, salt: string, iter: number, len: number) =>
      pbkdf2Sync(pin, Buffer.from(salt, 'base64'), iter, len, 'sha256').toString('base64'),
    ),
  );
  afterAll(() => setPbkdf2Provider(null));

  test('creating a vault with face / fingerprint runs the slow PIN derivation only once', async () => {
    let calls = 0;
    setPbkdf2Provider(async (pin: string, salt: string, iter: number, len: number) => {
      calls++;
      return pbkdf2Sync(pin, Buffer.from(salt, 'base64'), iter, len, 'sha256').toString('base64');
    });
    const { masterKey, meta } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '482915', unlockMode: 'pin_or_bio' });
    expect(meta.unlockMode).toBe('pin_or_bio');
    expect(calls).toBe(1);
    // switching face / fingerprint off and on keeps the PIN key: no derivation at all
    calls = 0;
    const off = await Keys.applyUnlockMode(masterKey, '482915', meta, 'pin', false);
    await Keys.applyUnlockMode(masterKey, '482915', off, 'pin_or_bio', false);
    expect(calls).toBe(0);
    expect(eq(await Keys.unlockWithPin('482915'), masterKey)).toBe(true);
    setPbkdf2Provider(async (pin: string, salt: string, iter: number, len: number) =>
      pbkdf2Sync(pin, Buffer.from(salt, 'base64'), iter, len, 'sha256').toString('base64'),
    );
  });

  test('create → lock → unlock with the same PIN, repeatedly, across mode changes', async () => {
    const { masterKey, meta } = await Keys.createVaultKeys({ vaultId: 'v1', pin: '482915', unlockMode: 'pin' });
    for (let i = 0; i < 3; i++) expect(eq(await Keys.unlockWithPin('482915'), masterKey)).toBe(true);
    mockBiometric = 'unsupported';
    const m2 = await Keys.applyUnlockMode(masterKey, '482915', meta, 'pin_or_bio');
    expect(m2.bioBinding).toBe('device-check');
    expect(eq(await Keys.unlockWithPin('482915'), masterKey)).toBe(true);
    const m3 = await Keys.applyUnlockMode(masterKey, '482915', m2, 'pin');
    expect(eq(await Keys.unlockWithPin('482915'), masterKey)).toBe(true);
    await Keys.changePin(masterKey, '73920154', m3);
    expect(eq(await Keys.unlockWithPin('73920154'), masterKey)).toBe(true);
    await expect(Keys.unlockWithPin('482915')).rejects.toThrow();
  });
});
