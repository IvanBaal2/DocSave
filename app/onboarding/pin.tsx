import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { PinPad } from '../../src/components/PinPad';
import { Chip, Header, Screen, StepDots } from '../../src/components/ui';
import { validatePin } from '../../src/crypto/core';
import { colors, spacing, type } from '../../src/theme/theme';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

export default function CreatePin() {
  const router = useRouter();
  const ob = useOnboarding();
  const [length, setLength] = useState(6);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  function fail(msg: string) {
    setError(msg);
    setShake((s) => s + 1);
    setValue('');
  }

  function complete(pin: string) {
    if (!first) {
      const problem = validatePin(pin);
      if (problem) return fail(problem);
      setFirst(pin);
      setValue('');
      setError(null);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      return fail('PINs did not match. Start again.');
    }
    ob.set({ pin });
    setFirst(null);
    setValue('');
    router.push('/onboarding/finish');
  }

  return (
    <Screen scroll={false}>
      <Header title="Backup PIN" right={<StepDots step={2} total={ONBOARDING_STEPS} />} />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xl }}>
        <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
          <Text style={[type.h1, { textAlign: 'center' }]}>{first ? 'Confirm your backup PIN' : `Choose a ${length}-digit backup PIN`}</Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            {ob.unlockMode === 'pin' ? 'You will use this PIN to open Docsave.' : 'You will normally use your face or fingerprint. This PIN is your backup if the sensor fails or changes.'} It cannot be recovered or reset, so choose one you will remember.
          </Text>
          {!first ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
              {[6, 8].map((n) => (
                <Chip
                  key={n}
                  label={`${n} digits`}
                  selected={length === n}
                  onPress={() => {
                    setLength(n);
                    setValue('');
                  }}
                />
              ))}
            </View>
          ) : null}
          <Text style={[type.caption, { color: colors.danger, marginTop: spacing.sm, minHeight: 18 }]}>{error ?? ''}</Text>
        </View>
        <PinPad value={value} onChange={setValue} length={length} onComplete={complete} errorSignal={shake} />
      </View>
    </Screen>
  );
}
