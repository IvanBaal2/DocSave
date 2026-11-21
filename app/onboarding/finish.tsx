import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, FadeIn, Notice, PulseShield, Screen, StepDots, haptic } from '../../src/components/ui';
import { PRIVACY, TERMS } from '../../src/content/legal';
import { colors, spacing, type } from '../../src/theme/theme';
import { useVault, type SetupResult } from '../../src/vault/VaultContext';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';
import { useI18n } from '../../src/i18n';

const STEPS = [
  'Generating a random 256-bit encryption key',
  'Protecting it with your PIN (PBKDF2-SHA256, 600,000 rounds)',
  'Sealing the key in the secure hardware key store',
  'Creating and verifying your encrypted vault',
];

export default function Finish() {
  const router = useRouter();
  const ob = useOnboarding();
  const vault = useVault();
  const { t } = useI18n();
  const bioLabel = t(vault.biometrics.label);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const started = useRef(false);

  const ready = ob.recoveryAcknowledged && ob.termsAccepted && ob.privacyAccepted && !!ob.pin;

  async function run() {
    if (!ob.pin) return;
    setError(null);
    setProgress(1);
    const ticker = setInterval(() => setProgress((p) => Math.min(p + 1, STEPS.length)), 350);
    try {
      const r = await vault.initializeVault({
        pin: ob.pin,
        unlockMode: ob.unlockMode,
        termsVersion: TERMS.version,
        privacyVersion: PRIVACY.version,
      });
      clearInterval(ticker);
      setProgress(STEPS.length + 1);
      ob.set({ pin: null }); // drop the PIN from memory
      haptic.success();
      setResult(r);
    } catch (e) {
      clearInterval(ticker);
      setProgress(0);
      setError((e as Error).message || t('Unknown error'));
    }
  }

  useEffect(() => {
    if (ready && !started.current) {
      started.current = true;
      run();
    }
  }, [ready]);

  if (!ready && !result) {
    return (
      <Screen>
        <Notice tone="warning" title={t('Setup incomplete')}>
          {t('Please complete every setup step before your vault can be created.')}
        </Notice>
        <Button title={t('Back to start')} onPress={() => router.replace('/onboarding')} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const done = !!result;
  const wanted = ob.unlockMode;

  return (
    <Screen
      footer={
        done ? (
          <Button title={t('Open my vault')} icon="arrow-forward" onPress={vault.enterVault} />
        ) : error ? (
          <View>
            <Button title={t('Try again')} onPress={run} />
            <Button title={t('Change unlock method')} variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
          </View>
        ) : undefined
      }
    >
      <View style={{ alignItems: 'flex-end' }}>
        <StepDots step={3} total={ONBOARDING_STEPS} />
      </View>
      <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
        <PulseShield size={92} />
        <Text style={[type.h1, { marginTop: spacing.md, textAlign: 'center' }]}>
          {done ? t('Your vault is ready') : error ? t('Vault not created') : t('Securing your vault')}
        </Text>
        {done ? (
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
            {t('Your encrypted vault was created and verified on this device.')}
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: spacing.xl }}>
        {STEPS.map((s, i) => {
          const isDone = progress > i + 1;
          const active = progress === i + 1;
          return (
            <FadeIn key={s} delay={i * 80}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                <View style={{ width: 28, alignItems: 'center' }}>
                  {isDone ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryBright} />
                  ) : active && !error ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
                <Text style={[type.body, { marginStart: spacing.md, flex: 1, color: isDone || active ? colors.text : colors.textMuted }]}>
                  {t(s)}
                </Text>
              </View>
            </FadeIn>
          );
        })}
      </View>

      {done && result?.biometricError ? (
        <Notice tone="warning" title={t('{method} could not be enabled', { method: bioLabel })}>
          {`${t('Your vault is protected by your PIN. This phone did not allow face or fingerprint protection:')} ${result.biometricError} ${t('You can try again later in Settings → Unlock methods.')}`}
        </Notice>
      ) : done && wanted !== 'pin' && vault.meta?.bioBinding === 'device-check' ? (
        <Notice tone="info" title={t('{method} enabled (device check)', { method: bioLabel })}>
          {t('This phone does not support biometric-bound keys, so Docsave uses the system face or fingerprint check to release a key stored in the Android Keystore. Your PIN always works too.')}
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" title={t('What went wrong')}>
          {`${error}\n\n${t('Nothing was saved, so you can safely try again.')}`}
        </Notice>
      ) : null}
    </Screen>
  );
}
