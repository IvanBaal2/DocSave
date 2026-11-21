import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PinPad } from '../../../src/components/PinPad';
import { Chip, Header, Screen, haptic } from '../../../src/components/ui';
import { validatePin } from '../../../src/crypto/core';
import { colors, spacing, type } from '../../../src/theme/theme';
import { useI18n } from '../../../src/i18n';
import { useVault } from '../../../src/vault/VaultContext';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePin() {
  const router = useRouter();
  const vault = useVault();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [value, setValue] = useState('');
  const [length, setLength] = useState(vault.meta?.pinLength ?? 6);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  function fail(msg: string) {
    setError(msg);
    setShake((s) => s + 1);
    setValue('');
  }

  async function complete(pin: string) {
    setError(null);
    if (step === 'current') {
      setBusy(true);
      const ok = await vault.verifyPin(pin).catch(() => false);
      setBusy(false);
      if (!ok) return fail(t('Incorrect PIN.'));
      setCurrent(pin);
      setValue('');
      return setStep('new');
    }
    if (step === 'new') {
      const problem = validatePin(pin);
      if (problem) return fail(t(problem));
      if (pin === current) return fail(t('Choose a different PIN.'));
      setNext(pin);
      setValue('');
      return setStep('confirm');
    }
    if (pin !== next) {
      setStep('new');
      return fail(t('PINs did not match. Enter the new PIN again.'));
    }
    setBusy(true);
    try {
      const ok = await vault.changePin(current, pin);
      if (!ok) throw new Error();
      haptic.success();
      router.back();
    } catch {
      setBusy(false);
      fail(t('The PIN could not be changed. Nothing was modified.'));
      setStep('current');
    }
  }

  const titles: Record<Step, string> = {
    current: t('Enter your current PIN'),
    new: t('Choose a new {n}-digit PIN', { n: length }),
    confirm: t('Confirm your new PIN'),
  };

  return (
    <Screen scroll={false}>
      <Header title={t('Change PIN')} />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <Text style={[type.h1, { textAlign: 'center' }]}>{titles[step]}</Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            {t('Your documents are not re-encrypted: only the key that protects them is re-sealed with the new PIN.')}
          </Text>
          {step === 'new' ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
              {[6, 8].map((n) => (
                <Chip key={n} label={t('{n} digits', { n })} selected={length === n} onPress={() => { setLength(n); setValue(''); }} />
              ))}
            </View>
          ) : null}
          <View style={{ minHeight: 28, justifyContent: 'center', marginTop: spacing.sm }}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[type.caption, { color: colors.danger }]}>{error ?? ''}</Text>
            )}
          </View>
        </View>
        <PinPad
          value={value}
          onChange={setValue}
          length={step === 'current' ? vault.meta?.pinLength ?? 6 : length}
          onComplete={complete}
          disabled={busy}
          errorSignal={shake}
        />
      </View>
    </Screen>
  );
}
