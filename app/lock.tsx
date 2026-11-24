import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '../src/components/PinPad';
import { haptic } from '../src/components/ui';
import { colors, spacing, type } from '../src/theme/theme';
import { MAX_ATTEMPTS_BEFORE_WIPE } from '../src/vault/keyManager';
import { useVault } from '../src/vault/VaultContext';
import { useI18n } from '../src/i18n';

export default function LockScreen() {
  const vault = useVault();
  const { t, direction } = useI18n();
  const bioLabel = t(vault.biometrics.label);
  const mode = vault.meta?.unlockMode ?? 'pin';
  const pinLength = vault.meta?.pinLength ?? 6;
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [usePin, setUsePin] = useState(false);
  const [shake, setShake] = useState(0);
  const [now, setNow] = useState(Date.now());
  const autoPrompted = useRef(false);

  const lockedUntil = vault.attempts.lockedUntil;
  const lockedOut = lockedUntil > now;

  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedOut]);

  const tryBiometrics = useCallback(async () => {
    if (busy) return;
    setMessage(null);
    const res = await vault.unlockWithBiometrics();
    if (!res.ok && res.error) setMessage(res.error);
    if (res.ok) haptic.success();
  }, [busy, vault]);

  useEffect(() => {
    if (autoPrompted.current || mode === 'pin' || !vault.biometrics.enrolled || lockedOut) return;
    autoPrompted.current = true;
    const timer = setTimeout(tryBiometrics, 350);
    return () => clearTimeout(timer);
  }, [mode, vault.biometrics.enrolled, lockedOut, tryBiometrics]);

  async function submit(value: string) {
    setBusy(true);
    setMessage(null);
    const res = await vault.unlockWithPin(value);
    setBusy(false);
    setPin('');
    if (res.ok) {
      haptic.success();
      return;
    }
    setShake((s) => s + 1);
    setNow(Date.now());
    setMessage(res.error);
  }

  function forgotPin() {
    Alert.alert(
      t('Forgot your PIN?'),
      `${t('Docsave has no recovery system. Without your PIN your documents cannot be decrypted by anyone.')}

${t('The only option is to permanently destroy this vault and start again with an empty one.')}`,
      [
        { text: t('Keep trying'), style: 'cancel' },
        {
          text: t('Destroy vault…'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(t('Permanently destroy vault?'), t('All documents will be erased forever. This cannot be undone.'), [
              { text: t('Cancel'), style: 'cancel' },
              { text: t('Destroy everything'), style: 'destructive', onPress: () => vault.destroyVault() },
            ]),
        },
      ],
    );
  }

  const needBiometricStep = mode === 'pin_and_bio' && !vault.twoFactorPending;
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const failed = vault.attempts.failed;

  // Face / fingerprint first; the PIN pad appears only when asked for (or when biometrics are off).
  const biometricFirst = (mode === 'pin_or_bio' && vault.biometrics.enrolled && !usePin) || needBiometricStep;
  const faceFirst = vault.biometrics.face;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl }}>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <Text style={[type.display, { fontSize: 28, marginTop: spacing.xl }]}>Docsave</Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm, color: colors.textMuted }]}>
            {needBiometricStep
              ? t('Step 1 of 2: verify with {method}', { method: bioLabel })
              : mode === 'pin_and_bio'
                ? t('Step 2 of 2: enter your PIN')
                : biometricFirst
                  ? t('Your vault is locked')
                  : t('Enter your PIN to decrypt your documents')}
          </Text>
          <View style={{ minHeight: 44, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={[type.caption, { marginTop: 4 }]}>{t('Verifying…')}</Text>
              </>
            ) : lockedOut ? (
              <Text style={[type.caption, { color: colors.warning, textAlign: 'center' }]}>
                {t('Too many attempts. Try again in {time}', { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` })}
              </Text>
            ) : message ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{message}</Text>
            ) : failed > 0 ? (
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {failed === 1 ? t('1 failed attempt') : t('{count} failed attempts', { count: failed })}
                {vault.settings.wipeAfterFailedAttempts ? ` · ${t('vault erases after {count}', { count: MAX_ATTEMPTS_BEFORE_WIPE })}` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {biometricFirst ? (
          <View style={{ paddingHorizontal: 28, alignItems: 'center' }}>
            <Pressable
              onPress={tryBiometrics}
              disabled={busy || lockedOut}
              accessibilityRole="button"
              accessibilityLabel={t('Unlock with {method}', { method: bioLabel })}
              style={({ pressed }) => [styles.bioRing, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Ionicons name={faceFirst ? 'scan-outline' : 'finger-print-outline'} size={64} color={colors.primaryBright} />
            </Pressable>
            <Text style={[type.h3, { fontSize: 17, marginTop: 18 }]}>{faceFirst ? t('Look at your phone') : t('Touch the fingerprint sensor')}</Text>
            <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: 6, color: colors.textMuted, maxWidth: 280 }]}>
              {faceFirst && vault.biometrics.fingerprint
                ? t('Face first, then fingerprint if your face is not recognised.')
                : t('Tap the circle if the check does not start.')}
            </Text>
          </View>
        ) : (
          <PinPad
            value={pin}
            onChange={setPin}
            length={pinLength}
            onComplete={submit}
            disabled={busy || lockedOut}
            errorSignal={shake}
            leftAction={
              mode === 'pin_or_bio' && vault.biometrics.enrolled
                ? { icon: vault.biometrics.icon, label: t('Unlock with {method}', { method: bioLabel }), onPress: tryBiometrics }
                : undefined
            }
          />
        )}

        <View style={{ paddingHorizontal: 28, alignItems: 'center' }}>
          {biometricFirst && !needBiometricStep ? (
            <Pressable onPress={() => setUsePin(true)} accessibilityRole="button" style={styles.pinButton}>
              <Text style={[type.button, { color: '#9FD9C4' }]}>{t('Enter PIN instead')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={forgotPin} accessibilityRole="button" style={{ padding: spacing.md }}>
            <Text style={[type.caption, { color: colors.textMuted }]}>{t('Forgot PIN?')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bioRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#12294A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButton: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
