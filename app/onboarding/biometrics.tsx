import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Header, Notice, PulseShield, Screen, StepDots } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import type { UnlockMode } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

export default function Biometrics() {
  const router = useRouter();
  const ob = useOnboarding();
  const { biometrics } = useVault();
  const usable = biometrics.available && biometrics.enrolled;

  const options: { mode: UnlockMode; title: string; body: string; recommended?: boolean }[] = [
    {
      mode: 'pin_or_bio',
      title: `${biometrics.label} or PIN`,
      body: `Unlock quickly with ${biometrics.label}. Your PIN always works as a fallback.`,
      recommended: true,
    },
    {
      mode: 'pin_and_bio',
      title: `Two-factor: ${biometrics.label} + PIN`,
      body: `Maximum security: both are required every time. If your enrolled biometrics change, the vault becomes permanently inaccessible.`,
    },
    { mode: 'pin', title: 'PIN only', body: 'Biometrics are not used.' },
  ];

  const selected = usable ? ob.unlockMode : 'pin';

  return (
    <Screen
      footer={
        <Button
          title="Create my vault"
          icon="lock-closed"
          onPress={() => {
            ob.set({ unlockMode: selected });
            router.push('/onboarding/finish');
          }}
        />
      }
    >
      <Header title="Biometric unlock" right={<StepDots step={7} total={ONBOARDING_STEPS} />} />
      <View style={{ alignItems: 'center' }}>
        <PulseShield size={72} />
        <Text style={[type.bodySecondary, { textAlign: 'center', marginBottom: spacing.lg }]}>
          {biometrics.label} is verified by your phone's secure hardware. Docsave never sees your biometric data.
        </Text>
      </View>
      {!usable ? (
        <Notice tone="warning" title={`${biometrics.label} not available`}>
          {biometrics.available
            ? `Set up ${biometrics.label} in your device settings to use it with Docsave. You can enable it later in Docsave settings.`
            : 'This device has no supported biometric hardware. Your vault will be protected by your PIN.'}
        </Notice>
      ) : (
        options.map((o) => {
          const active = selected === o.mode;
          return (
            <Pressable
              key={o.mode}
              onPress={() => ob.set({ unlockMode: o.mode })}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: 'row',
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
                marginBottom: spacing.md,
              }}
            >
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? colors.primaryBright : colors.textMuted}
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={type.h3}>
                  {o.title}
                  {o.recommended ? <Text style={{ color: colors.primaryBright, fontSize: 12 }}>  RECOMMENDED</Text> : null}
                </Text>
                <Text style={[type.bodySecondary, { marginTop: 4 }]}>{o.body}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
