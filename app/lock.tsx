import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '../src/components/PinPad';
import { Button, Logo, haptic } from '../src/components/ui';
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
    const timer = setTimeout(tryBiometrics, 120); // just enough for the screen to appear first
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl }}>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <Logo size={44} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl }}>
            <Ionicons name="lock-closed" size={16} color={colors.primaryBright} />
            <Text style={[type.h2, { marginStart: 8 }]}>{t('Vault locked')}</Text>
          </View>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            {needBiometricStep
              ? t('Step 1 of 2: verify with {method}', { method: bioLabel })
              : mode === 'pin_and_bio'
                ? t('Step 2 of 2: enter your PIN')
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
                {vault.settings.wipeAfterFailedAttempts
                  ? ` · ${t('vault erases after {count}', { count: MAX_ATTEMPTS_BEFORE_WIPE })}`
                  : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {needBiometricStep ? (
          <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
            <Pressable
              onPress={tryBiometrics}
              accessibilityRole="button"
              accessibilityLabel={t('Verify with {method}', { method: bioLabel })}
              style={({ pressed }) => ({
                width: 120,
                height: 120,
                borderRadius: 60,
                borderWidth: 1,
                borderColor: colors.primaryBorder,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Ionicons name={vault.biometrics.icon} size={54} color={colors.primaryBright} />
            </Pressable>
            <Button
              title={t('Verify with {method}', { method: bioLabel })}
              onPress={tryBiometrics}
              style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
            />
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

        <Pressable onPress={forgotPin} accessibilityRole="button" style={{ alignSelf: 'center', padding: spacing.md }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{t('Forgot PIN?')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
