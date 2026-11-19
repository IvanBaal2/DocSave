import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '../src/components/PinPad';
import { Button, Logo, haptic } from '../src/components/ui';
import { colors, spacing, type } from '../src/theme/theme';
import { MAX_ATTEMPTS_BEFORE_WIPE } from '../src/vault/keyManager';
import { useVault } from '../src/vault/VaultContext';

export default function LockScreen() {
  const vault = useVault();
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
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
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
    const t = setTimeout(tryBiometrics, 350);
    return () => clearTimeout(t);
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
      'Forgot your PIN?',
      'Docsave has no recovery system. Without your PIN your documents cannot be decrypted by anyone.\n\nThe only option is to permanently destroy this vault and start again with an empty one.',
      [
        { text: 'Keep trying', style: 'cancel' },
        {
          text: 'Destroy vault…',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Permanently destroy vault?', 'All documents will be erased forever. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Destroy everything', style: 'destructive', onPress: () => vault.destroyVault() },
            ]),
        },
      ],
    );
  }

  const needBiometricStep = mode === 'pin_and_bio' && !vault.twoFactorPending;
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const failed = vault.attempts.failed;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl }}>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <Logo size={44} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl }}>
            <Ionicons name="lock-closed" size={16} color={colors.primaryBright} />
            <Text style={[type.h2, { marginLeft: 8 }]}>Vault locked</Text>
          </View>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            {needBiometricStep
              ? `Step 1 of 2: verify with ${vault.biometrics.label}`
              : mode === 'pin_and_bio'
                ? 'Step 2 of 2: enter your PIN'
                : 'Enter your PIN to decrypt your documents'}
          </Text>
          <View style={{ minHeight: 44, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={[type.caption, { marginTop: 4 }]}>Verifying…</Text>
              </>
            ) : lockedOut ? (
              <Text style={[type.caption, { color: colors.warning, textAlign: 'center' }]}>
                Too many attempts. Try again in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
              </Text>
            ) : message ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{message}</Text>
            ) : failed > 0 ? (
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {failed} failed attempt{failed === 1 ? '' : 's'}
                {vault.settings.wipeAfterFailedAttempts
                  ? ` · vault erases after ${MAX_ATTEMPTS_BEFORE_WIPE}`
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
              accessibilityLabel={`Verify with ${vault.biometrics.label}`}
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
              title={`Verify with ${vault.biometrics.label}`}
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
                ? { icon: vault.biometrics.icon, label: `Unlock with ${vault.biometrics.label}`, onPress: tryBiometrics }
                : undefined
            }
          />
        )}

        <Pressable onPress={forgotPin} accessibilityRole="button" style={{ alignSelf: 'center', padding: spacing.md }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>Forgot PIN?</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
