import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, FadeIn, Notice, PulseShield, Screen, StepDots } from '../../src/components/ui';
import { PRIVACY, TERMS } from '../../src/content/legal';
import { colors, spacing, type } from '../../src/theme/theme';
import { useVault } from '../../src/vault/VaultContext';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

const STEPS = [
  'Generating a random 256-bit encryption key',
  'Deriving a key-encryption key from your PIN (scrypt)',
  'Sealing the key in secure hardware',
  'Creating your encrypted vault',
];

export default function Finish() {
  const router = useRouter();
  const ob = useOnboarding();
  const vault = useVault();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const ready = ob.recoveryAcknowledged && ob.termsAccepted && ob.privacyAccepted && !!ob.pin;

  async function run() {
    if (!ob.pin) return;
    setError(null);
    setProgress(1);
    const ticker = setInterval(() => setProgress((p) => Math.min(p + 1, STEPS.length - 1)), 450);
    try {
      await vault.initializeVault({
        pin: ob.pin,
        unlockMode: ob.unlockMode,
        termsVersion: TERMS.version,
        privacyVersion: PRIVACY.version,
      });
      setProgress(STEPS.length);
      ob.set({ pin: null }); // drop the PIN from memory
      // The route guard now switches to the private dashboard automatically.
    } catch (e) {
      setError(
        `The vault could not be created: ${(e as Error).message}. If you cancelled the ${vault.biometrics.label} prompt, try again or choose "PIN only".`,
      );
      setProgress(0);
    } finally {
      clearInterval(ticker);
    }
  }

  useEffect(() => {
    if (ready && !started.current) {
      started.current = true;
      run();
    }
  }, [ready]);

  if (!ready) {
    return (
      <Screen>
        <Notice tone="warning" title="Setup incomplete">
          Please complete every setup step before your vault can be created.
        </Notice>
        <Button title="Back to start" onPress={() => router.replace('/onboarding')} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        error ? (
          <View>
            <Button title="Try again" onPress={run} />
            <Button title="Change unlock method" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
          </View>
        ) : undefined
      }
    >
      <View style={{ alignItems: 'flex-end' }}>
        <StepDots step={8} total={ONBOARDING_STEPS} />
      </View>
      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <PulseShield size={96} />
        <Text style={[type.h1, { marginTop: spacing.lg }]}>Securing your vault</Text>
      </View>
      <View style={{ marginTop: spacing.xxl }}>
        {STEPS.map((s, i) => {
          const done = progress > i + 1 || progress === STEPS.length;
          const active = progress === i + 1 && progress !== STEPS.length;
          return (
            <FadeIn key={s} delay={i * 100}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                <View style={{ width: 28, alignItems: 'center' }}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryBright} />
                  ) : active ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
                <Text style={[type.body, { marginLeft: spacing.md, flex: 1, color: done || active ? colors.text : colors.textMuted }]}>
                  {s}
                </Text>
              </View>
            </FadeIn>
          );
        })}
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Screen>
  );
}
