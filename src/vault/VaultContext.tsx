import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { NativeSecurity, checkIntegrity, type IntegrityReport } from '../../modules/docsave-security';
import { TamperError, setPbkdf2Provider, setRandomSource, wipe, type WrappedKey } from '../crypto/core';
import { sniffMime } from '../security/importers';
import { cancelAllReminders, rescheduleReminders } from '../notifications/scheduler';
import { purgeTempFiles } from '../security/secureTemp';
import * as Keys from './keyManager';
import * as Store from './storage';
import {
  DEFAULT_SETTINGS,
  type CustomCategory,
  type DocumentRecord,
  type NewDocumentInput,
  type Settings,
  type UnlockMode,
  type VaultIndex,
  type VaultMeta,
} from './types';

setRandomSource((n) => Crypto.getRandomBytes(n));
// PBKDF2 for PIN keys runs in the platform's native crypto (fast and constant-time).
const nativeSecurity = NativeSecurity;
if (nativeSecurity) setPbkdf2Provider((pin, salt, iter, len) => nativeSecurity.pbkdf2Sha256(pin, salt, iter, len));

export type SetupResult = { biometricError?: string };

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked';

export type UnlockResult =
  | { ok: true }
  | { ok: false; error: string; lockedUntil?: number; needPin?: boolean; destroyed?: boolean };

export type BiometricInfo = {
  available: boolean;
  enrolled: boolean;
  label: string; // "Face ID", "Fingerprint", …
  icon: 'scan-outline' | 'finger-print-outline';
};

type VaultContextValue = {
  status: VaultStatus;
  meta: VaultMeta | null;
  settings: Settings;
  index: VaultIndex;
  integrity: IntegrityReport;
  integrityAcknowledged: boolean;
  acknowledgeIntegrity(): void;
  biometrics: BiometricInfo;
  attempts: Keys.Attempts;
  /** Two-factor step 1 completed; waiting for the PIN. */
  twoFactorPending: boolean;

  /** Creates the vault. The UI then shows confirmation and calls enterVault(). */
  initializeVault(p: { pin: string; unlockMode: UnlockMode; termsVersion: string; privacyVersion: string }): Promise<SetupResult>;
  /** Opens the dashboard after setup confirmation. */
  enterVault(): void;
  unlockWithPin(pin: string): Promise<UnlockResult>;
  unlockWithBiometrics(): Promise<UnlockResult>;
  lock(): void;

  addDocument(input: NewDocumentInput): Promise<DocumentRecord>;
  updateDocument(
    id: string,
    patch: Partial<Pick<DocumentRecord, 'name' | 'notes' | 'expiryDate' | 'categoryId' | 'docType' | 'fields' | 'description'>>,
  ): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  /** Decrypts a page in memory and returns it as base64. */
  readPage(pageId: string): Promise<string>;
  addCategory(name: string, icon: string): Promise<CustomCategory>;
  deleteCategory(id: string): Promise<void>;
  deleteAllDocuments(): Promise<void>;
  destroyVault(): Promise<void>;

  verifyPin(pin: string): Promise<boolean>;
  changePin(currentPin: string, newPin: string): Promise<boolean>;
  /** Pass verified=true when the PIN was just checked (avoids a second slow key derivation). */
  setUnlockMode(mode: UnlockMode, pin: string, verified?: boolean): Promise<boolean>;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  /** Run a system UI flow (picker, camera permission…) without triggering auto-lock. */
  runExternal<T>(fn: () => Promise<T>): Promise<T>;
  /** Record a successful re-authentication (grace period for the document viewer). */
  markAuthenticated(): void;
  recentlyAuthenticated(withinMs?: number): boolean;
  /** Reset the foreground inactivity timer. */
  touch(): void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

const IDLE_LOCK_MS = 5 * 60_000;
const MAX_EXTERNAL_MS = 10 * 60_000;
const AUTH_GRACE_MS = 60_000;

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [index, setIndex] = useState<VaultIndex>(Store.emptyIndex());
  const [integrity, setIntegrity] = useState<IntegrityReport>({ compromised: false, emulator: false, reasons: [] });
  const [integrityAcknowledged, setIntegrityAcknowledged] = useState(false);
  const [attempts, setAttempts] = useState<Keys.Attempts>({ failed: 0, lockedUntil: 0 });
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [biometrics, setBiometrics] = useState<BiometricInfo>({
    available: false,
    enrolled: false,
    label: 'Biometrics',
    icon: 'finger-print-outline',
  });

  // Secret material lives only in refs, never in React state or props.
  const masterKey = useRef<Uint8Array | null>(null);
  const twoFactorWrapped = useRef<WrappedKey | null>(null);
  const indexRef = useRef<VaultIndex>(index);
  const settingsRef = useRef<Settings>(settings);
  const metaRef = useRef<VaultMeta | null>(meta);
  const statusRef = useRef<VaultStatus>(status);
  const backgroundAt = useRef<number | null>(null);
  const externalSince = useRef<number | null>(null);
  const externalDepth = useRef(0);
  const lastActivity = useRef(Date.now());
  const lastAuthAt = useRef(0);

  indexRef.current = index;
  settingsRef.current = settings;
  metaRef.current = meta;
  statusRef.current = status;

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      purgeTempFiles();
      setIntegrity(checkIntegrity());
      refreshBiometrics(); // not awaited: never delays the unlock screen
      const [m, s, a] = await Promise.all([Keys.readMeta(), Keys.readSettings(), Keys.getAttempts()]);
      setSettings(s);
      setAttempts(a);
      if (m) {
        const storedId = Store.readVaultId();
        if (storedId !== m.vaultId) {
          // Keys survived without their vault (e.g. iOS keeps Keychain items after
          // an uninstall). They protect nothing any more: discard them.
          await Keys.destroyAllKeys();
          setSettings({ ...DEFAULT_SETTINGS });
          setStatus('uninitialized');
          return;
        }
        Store.reassertBackupExclusion();
        setMeta(m);
        setStatus('locked');
      } else {
        setStatus('uninitialized');
      }
    })().catch(() => setStatus('uninitialized'));
  }, []);

  async function refreshBiometrics() {
    try {
      const [hw, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const ios = Platform.OS === 'ios';
      setBiometrics({
        available: hw,
        enrolled,
        label: ios ? (face ? 'Face ID' : 'Touch ID') : face && finger ? 'Face or fingerprint' : face ? 'Face unlock' : 'Fingerprint',
        icon: face && (ios || !finger) ? 'scan-outline' : 'finger-print-outline',
      });
    } catch {
      // Leave defaults (unavailable).
    }
  }

  // ── Locking ────────────────────────────────────────────────────────────────
  const lock = useCallback(() => {
    wipe(masterKey.current);
    masterKey.current = null;
    twoFactorWrapped.current = null;
    lastAuthAt.current = 0;
    setTwoFactorPending(false);
    setIndex(Store.emptyIndex());
    if (statusRef.current === 'unlocked') setStatus('locked');
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundAt.current = Date.now();
        if (
          statusRef.current === 'unlocked' &&
          externalDepth.current === 0 &&
          settingsRef.current.autoLockSeconds === 0
        ) {
          lock();
        }
      } else if (next === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        lastActivity.current = Date.now();
        refreshBiometrics();
        if (statusRef.current !== 'unlocked' || since == null) return;
        const external = externalDepth.current > 0;
        const externalTooLong = external && externalSince.current != null && Date.now() - externalSince.current > MAX_EXTERNAL_MS;
        const elapsed = Date.now() - since;
        if ((!external && elapsed >= settingsRef.current.autoLockSeconds * 1000) || externalTooLong) {
          lock();
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    const timer = setInterval(() => {
      if (
        statusRef.current === 'unlocked' &&
        externalDepth.current === 0 &&
        AppState.currentState === 'active' &&
        Date.now() - lastActivity.current > Math.max(IDLE_LOCK_MS, settingsRef.current.autoLockSeconds * 1000)
      ) {
        lock();
      }
    }, 15_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [lock]);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  const runExternal = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    externalDepth.current += 1;
    if (externalDepth.current === 1) externalSince.current = Date.now();
    try {
      return await fn();
    } finally {
      externalDepth.current -= 1;
      if (externalDepth.current === 0) externalSince.current = null;
      lastActivity.current = Date.now();
    }
  }, []);

  // ── Unlock ─────────────────────────────────────────────────────────────────
  async function completeUnlock(key: Uint8Array): Promise<UnlockResult> {
    let idx: VaultIndex;
    try {
      idx = await Store.readIndex(key);
    } catch (e) {
      wipe(key);
      return {
        ok: false,
        error:
          e instanceof TamperError
            ? 'Vault integrity check failed. The vault files were modified or damaged.'
            : 'The vault could not be opened.',
      };
    }
    masterKey.current = key;
    await Keys.resetAttempts();
    setAttempts({ failed: 0, lockedUntil: 0 });
    Store.sweepOrphans(idx);
    purgeTempFiles();
    setIndex(idx);
    setTwoFactorPending(false);
    lastActivity.current = Date.now();
    lastAuthAt.current = Date.now();
    setStatus('unlocked');
    rescheduleReminders(idx.documents, settingsRef.current).catch(() => {});
    return { ok: true };
  }

  function compromisedBlock(): UnlockResult | null {
    if (settingsRef.current.blockOnCompromisedDevice && integrity.compromised) {
      return {
        ok: false,
        error: 'This device shows signs of being rooted or jailbroken. Your security settings block unlocking on such devices.',
      };
    }
    return null;
  }

  const destroyVault = useCallback(async () => {
    wipe(masterKey.current);
    masterKey.current = null;
    twoFactorWrapped.current = null;
    await cancelAllReminders().catch(() => {});
    await Keys.destroyAllKeys();
    Store.destroyVaultStorage();
    purgeTempFiles();
    setIndex(Store.emptyIndex());
    setMeta(null);
    setSettings({ ...DEFAULT_SETTINGS });
    setAttempts({ failed: 0, lockedUntil: 0 });
    setTwoFactorPending(false);
    setStatus('uninitialized');
  }, []);

  async function handleWrongPin(): Promise<UnlockResult> {
    const a = await Keys.recordFailedAttempt();
    setAttempts(a);
    if (settingsRef.current.wipeAfterFailedAttempts && a.failed >= Keys.MAX_ATTEMPTS_BEFORE_WIPE) {
      await destroyVault();
      return {
        ok: false,
        destroyed: true,
        error: `Too many incorrect PIN attempts. As configured, the vault has been permanently erased.`,
      };
    }
    return { ok: false, error: 'Incorrect PIN.', lockedUntil: a.lockedUntil };
  }

  const unlockWithPin = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      const blocked = compromisedBlock();
      if (blocked) return blocked;
      const a = await Keys.getAttempts();
      if (a.lockedUntil > Date.now()) {
        return { ok: false, error: 'Too many attempts. Please wait.', lockedUntil: a.lockedUntil };
      }
      const mode = metaRef.current?.unlockMode ?? 'pin';
      try {
        let key: Uint8Array;
        if (mode === 'pin_and_bio') {
          const wrapped = twoFactorWrapped.current;
          if (!wrapped) return { ok: false, error: `Verify with ${biometrics.label} first.` };
          key = await Keys.unlockTwoFactor(wrapped, pin);
        } else {
          key = await Keys.unlockWithPin(pin);
        }
        return await completeUnlock(key);
      } catch (e) {
        if (e instanceof TamperError) return handleWrongPin();
        return { ok: false, error: (e as Error).message || 'Unlock failed.' };
      }
    },
    [biometrics.label, integrity],
  );

  const unlockWithBiometrics = useCallback(async (): Promise<UnlockResult> => {
    const blocked = compromisedBlock();
    if (blocked) return blocked;
    const mode = metaRef.current?.unlockMode ?? 'pin';
    try {
      if (mode === 'pin_or_bio') {
        const binding = metaRef.current?.bioBinding ?? 'hardware';
        return await runExternal(async () => completeUnlock(await Keys.unlockWithBiometrics(binding)));
      }
      if (mode === 'pin_and_bio') {
        twoFactorWrapped.current = await runExternal(() => Keys.fetchTwoFactorWrappedKey());
        setTwoFactorPending(true);
        return { ok: false, needPin: true, error: '' };
      }
      return { ok: false, error: 'Biometric unlock is not enabled.' };
    } catch (e) {
      if (e instanceof Keys.BiometricCancelledError) return { ok: false, error: '' };
      if (e instanceof Keys.BiometricKeyUnavailableError) {
        return {
          ok: false,
          error:
            mode === 'pin_and_bio'
              ? 'The biometric key is no longer available (biometrics changed on this device). Two-factor vaults cannot be recovered without it.'
              : `${biometrics.label} is unavailable. Use your PIN.`,
        };
      }
      return { ok: false, error: 'Biometric unlock failed.' };
    }
  }, [biometrics.label, integrity, runExternal]);

  // ── Setup ──────────────────────────────────────────────────────────────────
  const initializeVault = useCallback(
    async (p: { pin: string; unlockMode: UnlockMode; termsVersion: string; privacyVersion: string }): Promise<SetupResult> => {
      // Never overwrite an existing vault: only orphaned storage (keys gone) may be replaced.
      const existingMeta = await Keys.readMeta();
      if (existingMeta && Store.vaultStorageExists()) throw new Keys.VaultExistsError();
      const vaultId = Store.newId();
      try {
        Store.createVaultStorage(vaultId, { replaceOrphan: !existingMeta });
      } catch (e) {
        throw new Error(`Docsave could not create its private storage folder: ${(e as Error).message}`);
      }
      let created: Awaited<ReturnType<typeof Keys.createVaultKeys>>;
      try {
        created = await runExternal(() => Keys.createVaultKeys({ vaultId, pin: p.pin, unlockMode: p.unlockMode }));
      } catch (e) {
        Store.destroyVaultStorage(); // roll back: no half-created vault
        throw e;
      }
      const { masterKey: key, meta: m, biometricError } = created;
      const s: Settings = {
        ...DEFAULT_SETTINGS,
        acceptedTermsVersion: p.termsVersion,
        acceptedPrivacyVersion: p.privacyVersion,
      };
      const idx = Store.emptyIndex();
      try {
        await Keys.writeSettings(s);
        Store.writeIndex(key, idx);
        // Prove the vault round-trips before declaring it ready.
        await Store.readIndex(key);
      } catch (e) {
        wipe(key);
        await Keys.destroyAllKeys();
        Store.destroyVaultStorage();
        throw new Error(`The encrypted index could not be created: ${(e as Error).message}`);
      }
      setSettings(s);
      setMeta(m);
      masterKey.current = key;
      twoFactorWrapped.current = null;
      setIndex(idx);
      lastActivity.current = Date.now();
      lastAuthAt.current = Date.now();
      return { biometricError };
    },
    [runExternal],
  );

  const enterVault = useCallback(() => {
    if (!masterKey.current) return;
    lastActivity.current = Date.now();
    setStatus('unlocked');
  }, []);

  // ── Documents ──────────────────────────────────────────────────────────────
  function requireKey(): Uint8Array {
    if (!masterKey.current) throw new Error('Vault is locked.');
    return masterKey.current;
  }

  function persist(next: VaultIndex) {
    Store.writeIndex(requireKey(), next);
    indexRef.current = next;
    setIndex(next);
    rescheduleReminders(next.documents, settingsRef.current).catch(() => {});
  }

  const addDocument = useCallback(async (input: NewDocumentInput) => {
    const key = requireKey();
    const now = Date.now();
    const written: string[] = [];
    try {
      const pages = [];
      for (const p of input.pages) {
        const id = Store.newId();
        written.push(id);
        const { size, head } = await Store.writeBlob(key, id, p);
        pages.push({ id, label: p.label, mimeType: sniffMime(head, p.mimeType), size });
      }
      const doc: DocumentRecord = {
        id: Store.newId(),
        name: input.name.trim() || 'Untitled document',
        categoryId: input.categoryId,
        docType: input.docType,
        notes: input.notes?.trim() || undefined,
        expiryDate: input.expiryDate || undefined,
        fields: input.fields?.length ? input.fields : undefined,
        description: input.description?.trim() || undefined,
        pages,
        createdAt: now,
        updatedAt: now,
      };
      persist({ ...indexRef.current, documents: [doc, ...indexRef.current.documents] });
      return doc;
    } catch (e) {
      written.forEach(Store.deleteBlob);
      throw e;
    }
  }, []);

  const updateDocument = useCallback<VaultContextValue['updateDocument']>(async (id, patch) => {
    const docs = indexRef.current.documents.map((d) =>
      d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d,
    );
    persist({ ...indexRef.current, documents: docs });
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const doc = indexRef.current.documents.find((d) => d.id === id);
    if (!doc) return;
    persist({ ...indexRef.current, documents: indexRef.current.documents.filter((d) => d.id !== id) });
    doc.pages.forEach((p) => Store.deleteBlob(p.id));
  }, []);

  const readPage = useCallback(async (pageId: string) => Store.readBlob(requireKey(), pageId), []);

  const addCategory = useCallback(async (name: string, icon: string) => {
    const cat: CustomCategory = { id: `c_${Store.newId()}`, name: name.trim(), icon, createdAt: Date.now() };
    persist({ ...indexRef.current, customCategories: [...indexRef.current.customCategories, cat] });
    return cat;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    // Documents in a removed folder move to "Other Documents" – nothing is deleted.
    persist({
      ...indexRef.current,
      customCategories: indexRef.current.customCategories.filter((c) => c.id !== id),
      documents: indexRef.current.documents.map((d) =>
        d.categoryId === id ? { ...d, categoryId: 'other', docType: undefined } : d,
      ),
    });
  }, []);

  const deleteAllDocuments = useCallback(async () => {
    persist({ ...indexRef.current, documents: [] });
    Store.deleteAllBlobs();
    purgeTempFiles();
  }, []);

  // ── Security settings ──────────────────────────────────────────────────────
  const verifyPin = useCallback(async (pin: string) => {
    const key = masterKey.current;
    const m = metaRef.current;
    if (!key || !m) return false;
    if (m.unlockMode === 'pin_and_bio' && !twoFactorWrapped.current) {
      twoFactorWrapped.current = await runExternal(() => Keys.fetchTwoFactorWrappedKey());
    }
    const ok = await Keys.verifyPin(pin, key, m.unlockMode, twoFactorWrapped.current);
    if (ok) lastAuthAt.current = Date.now();
    return ok;
  }, [runExternal]);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!(await verifyPin(currentPin))) return false;
    const m = await runExternal(() => Keys.changePin(requireKey(), newPin, metaRef.current!));
    twoFactorWrapped.current = null;
    setMeta(m);
    return true;
  }, [verifyPin, runExternal]);

  const setUnlockMode = useCallback(async (mode: UnlockMode, pin: string, verified = false) => {
    if (!verified && !(await verifyPin(pin))) return false;
    const m = await runExternal(() => Keys.applyUnlockMode(requireKey(), pin, metaRef.current!, mode));
    twoFactorWrapped.current = null;
    setMeta(m);
    return true;
  }, [verifyPin, runExternal]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    await Keys.writeSettings(next);
    const notifKeys: (keyof Settings)[] = [
      'notificationsEnabled', 'expiryReminders', 'identityReminders', 'travelReminders', 'reminderLeadDays', 'notificationDetail',
    ];
    if (notifKeys.some((k) => k in patch)) {
      if (next.notificationsEnabled && statusRef.current === 'unlocked') {
        await rescheduleReminders(indexRef.current.documents, next).catch(() => {});
      } else if (!next.notificationsEnabled) {
        await cancelAllReminders().catch(() => {});
      }
    }
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      meta,
      settings,
      index,
      integrity,
      integrityAcknowledged,
      acknowledgeIntegrity: () => setIntegrityAcknowledged(true),
      biometrics,
      attempts,
      twoFactorPending,
      initializeVault,
      enterVault,
      unlockWithPin,
      unlockWithBiometrics,
      lock,
      addDocument,
      updateDocument,
      deleteDocument,
      readPage,
      addCategory,
      deleteCategory,
      deleteAllDocuments,
      destroyVault,
      verifyPin,
      changePin,
      setUnlockMode,
      updateSettings,
      runExternal,
      markAuthenticated: () => {
        lastAuthAt.current = Date.now();
      },
      recentlyAuthenticated: (withinMs = AUTH_GRACE_MS) => Date.now() - lastAuthAt.current < withinMs,
      touch,
    }),
    [
      status, meta, settings, index, integrity, integrityAcknowledged, biometrics, attempts, twoFactorPending,
      initializeVault, enterVault, unlockWithPin, unlockWithBiometrics, lock, addDocument, updateDocument, deleteDocument,
      readPage, addCategory, deleteCategory, deleteAllDocuments, destroyVault, verifyPin, changePin,
      setUnlockMode, updateSettings, runExternal, touch,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>');
  return ctx;
}
