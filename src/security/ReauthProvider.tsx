import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '../components/PinPad';
import { LogoMark } from '../components/ui';
import { colors, spacing, type } from '../theme/theme';
import { useVault } from '../vault/VaultContext';
import { useI18n } from '../i18n';

type Options = {
  /** Require the PIN even if biometrics are enabled (destructive actions). */
  pinOnly?: boolean;
};

type ReauthValue = {
  /** Biometrics (if enabled) or PIN. Resolves true when the user is verified. */
  authenticate(reason: string, options?: Options): Promise<boolean>;
  /** Asks for the PIN, verifies it, and returns it (needed to re-wrap keys), or null. */
  requestPin(reason: string): Promise<string | null>;
};

const Ctx = createContext<ReauthValue | null>(null);
const MAX_MODAL_ATTEMPTS = 5;

export function ReauthProvider({ children }: { children: React.ReactNode }) {
  const vault = useVault();
  const { t, direction } = useI18n();
  const [request, setRequest] = useState<{ reason: string } | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const resolver = useRef<((pin: string | null) => void) | null>(null);
  const failures = useRef(0);

  const finish = useCallback((result: string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
    setPin('');
    setError(null);
    failures.current = 0;
  }, []);

  const requestPin = useCallback((reason: string) => {
    resolver.current?.(null); // cancel any previous pending request
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setRequest({ reason });
    });
  }, []);

  const authenticate = useCallback(
    async (reason: string, options?: Options) => {
      const mode = vault.meta?.unlockMode ?? 'pin';
      if (!options?.pinOnly && mode !== 'pin' && vault.biometrics.enrolled) {
        const res = await vault.runExternal(() =>
          LocalAuthentication.authenticateAsync({
            promptMessage: reason,
            cancelLabel: t('Use PIN'),
            disableDeviceFallback: true,
            // 'weak' also allows face unlock on Android phones whose face sensor is class 2.
            biometricsSecurityLevel: vault.meta?.bioBinding === 'device-check' ? 'weak' : 'strong',
          }),
        );
        if (res.success) {
          vault.markAuthenticated();
          return true;
        }
        if (res.error === 'user_cancel' || res.error === 'system_cancel' || res.error === 'app_cancel') {
          return false;
        }
        // 'user_fallback', lockout, not available… → fall back to the PIN.
      }
      return (await requestPin(reason)) != null;
    },
    [vault, requestPin],
  );

  async function submit(value: string) {
    setBusy(true);
    try {
      const ok = await vault.verifyPin(value);
      if (ok) return finish(value);
      failures.current += 1;
      setShake((s) => s + 1);
      setPin('');
      if (failures.current >= MAX_MODAL_ATTEMPTS) {
        finish(null);
        vault.lock();
        return;
      }
      setError(t('Incorrect PIN. {count} attempts left before the vault locks.', { count: MAX_MODAL_ATTEMPTS - failures.current }));
    } catch {
      setError(t('Verification failed.'));
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Ctx.Provider value={{ authenticate, requestPin }}>
      {children}
      <Modal visible={!!request} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => finish(null)}>
        <SafeAreaView style={[styles.modal, { direction }]}>
          <View style={styles.top}>
            <LogoMark size={52} />
            <Text style={[type.h2, { marginTop: spacing.lg, textAlign: 'center' }]}>{t('Confirm it is you')}</Text>
            <Text style={[type.bodySecondary, { marginTop: spacing.sm, textAlign: 'center' }]}>{request?.reason}</Text>
            <View style={{ height: 36, marginTop: spacing.md, justifyContent: 'center' }}>
              {busy ? (
                <ActivityIndicator color={colors.primary} />
              ) : error ? (
                <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{error}</Text>
              ) : null}
            </View>
          </View>
          <PinPad
            value={pin}
            onChange={setPin}
            length={vault.meta?.pinLength ?? 6}
            onComplete={submit}
            disabled={busy}
            errorSignal={shake}
          />
          <Pressable onPress={() => finish(null)} accessibilityRole="button" style={styles.cancel}>
            <Text style={[type.button, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </Ctx.Provider>
  );
}

export function useReauth(): ReauthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReauth must be used inside <ReauthProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', paddingVertical: spacing.xl },
  top: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  cancel: { alignSelf: 'center', padding: spacing.lg },
});
