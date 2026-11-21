import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Button, Header, Notice, PulseShield, Screen, StepDots } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme/theme';
import { useVault } from '../../src/vault/VaultContext';
import { useI18n } from '../../src/i18n';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

/** Step 1: face / fingerprint first, so the vault opens without typing a PIN. */
export default function Biometrics() {
  const router = useRouter();
  const ob = useOnboarding();
  const { biometrics } = useVault();
  const usable = biometrics.available;
  const { t } = useI18n();

  const choose = (useBiometrics: boolean) => {
    ob.set({ unlockMode: useBiometrics ? 'pin_or_bio' : 'pin' });
    router.push('/onboarding/pin');
  };

  return (
    <Screen
      footer={
        usable ? (
          <View>
            <Button title={t('Use face or fingerprint')} icon={biometrics.icon} onPress={() => choose(true)} />
            <Button title={t('Not now, use a PIN only')} variant="ghost" onPress={() => choose(false)} style={{ marginTop: spacing.sm }} />
          </View>
        ) : (
          <Button title={t('Continue')} onPress={() => choose(false)} />
        )
      }
    >
      <Header title={t('Quick unlock')} right={<StepDots step={1} total={ONBOARDING_STEPS} />} />
      <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
        <PulseShield size={96} />
        <Text style={[type.h1, { textAlign: 'center', marginTop: spacing.lg }]}>
          {usable ? t('Open Docsave with your face or fingerprint') : t('Protect Docsave with a PIN')}
        </Text>
        <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
          {usable
            ? t('No typing needed. Docsave asks for face recognition first, then fingerprint. Your phone checks it: Docsave never sees your face or fingerprint.')
            : t('This phone has no face or fingerprint sensor that apps can use. You will unlock Docsave with a PIN.')}
        </Text>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        {[
          { icon: 'flash-outline' as const, text: 'Opens in a second, every time' },
          { icon: 'shield-checkmark-outline' as const, text: 'Verified by your phone’s secure hardware' },
          { icon: 'keypad-outline' as const, text: 'A backup PIN (next step) works if the sensor ever fails' },
        ].map((r) => (
          <View key={r.text} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Ionicons name={r.icon} size={20} color={colors.primaryBright} />
            <Text style={[type.body, { marginStart: spacing.md, flex: 1 }]}>{t(r.text)}</Text>
          </View>
        ))}
      </View>

      {usable && !biometrics.enrolled ? (
        <Notice tone="info">
          {t('Set up a face or fingerprint in your phone settings first, or continue. Docsave will ask your phone when you finish.')}
        </Notice>
      ) : null}
    </Screen>
  );
}
