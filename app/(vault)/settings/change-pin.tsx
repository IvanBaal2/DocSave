import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { PinPad } from '../../../src/components/PinPad';
import { Chip, Header, Screen, haptic } from '../../../src/components/ui';
import { validatePin } from '../../../src/crypto/core';
import { colors, spacing, type } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePin() {
  const router = useRouter();
  const vault = useVault();
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
      if (!ok) return fail('Incorrect PIN.');
      setCurrent(pin);
      setValue('');
      return setStep('new');
    }
    if (step === 'new') {
      const problem = validatePin(pin);
      if (problem) return fail(problem);
      if (pin === current) return fail('Choose a different PIN.');
      setNext(pin);
      setValue('');
      return setStep('confirm');
    }
    if (pin !== next) {
      setStep('new');
      return fail('PINs did not match. Enter the new PIN again.');
    }
    setBusy(true);
    try {
      const ok = await vault.changePin(current, pin);
      if (!ok) throw new Error();
      haptic.success();
      router.back();
    } catch {
      setBusy(false);
      fail('The PIN could not be changed. Nothing was modified.');
      setStep('current');
    }
  }

  const titles: Record<Step, string> = {
    current: 'Enter your current PIN',
    new: `Choose a new ${length}-digit PIN`,
    confirm: 'Confirm your new PIN',
  };

  return (
    <Screen scroll={false}>
      <Header title="Change PIN" />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <Text style={[type.h1, { textAlign: 'center' }]}>{titles[step]}</Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            Your documents are not re-encrypted: only the key that protects them is re-sealed with the new PIN.
          </Text>
          {step === 'new' ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
              {[6, 8].map((n) => (
                <Chip key={n} label={`${n} digits`} selected={length === n} onPress={() => { setLength(n); setValue(''); }} />
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
