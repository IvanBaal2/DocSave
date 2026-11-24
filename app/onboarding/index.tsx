import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckRow } from '../../src/components/Checkbox';
import { BrandLogo, Button, FadeIn, Notice, Screen, type IconName } from '../../src/components/ui';
import { colors, gradients, spacing, type, fonts } from '../../src/theme/theme';
import { useOnboarding } from './_layout';
import { LANGUAGES, useI18n } from '../../src/i18n';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'lock-closed', title: 'Encrypted on your phone', body: 'AES-256-GCM before anything is saved' },
  { icon: 'phone-portrait', title: 'Stays on this device', body: 'No cloud sync and no Docsave servers' },
  { icon: 'person-remove', title: 'No account needed', body: 'No email, no sign-up, no advertising' },
];

/**
 * First screen. Before any vault exists the user must (1) understand that
 * there is no recovery and (2) explicitly accept the Terms & Conditions.
 * The accepted versions and the acceptance date are stored only on the device.
 */
export default function Welcome() {
  const router = useRouter();
  const ob = useOnboarding();
  const { t, lang } = useI18n();
  const ready = ob.recoveryAcknowledged && ob.termsAccepted;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.hero} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 520 }} />
      <Screen
        footer={
          <Button
            title={t('Get started')}
            icon="arrow-forward"
            disabled={!ready}
            onPress={() => {
              ob.set({ privacyAccepted: true });
              router.push('/onboarding/biometrics');
            }}
          />
        }
      >
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={() => router.push('/onboarding/language')}
            accessibilityRole="button"
            accessibilityLabel={t('Language')}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm }}
          >
            <Ionicons name="language-outline" size={18} color={colors.primaryBright} />
            <Text style={[type.caption, { color: colors.primaryBright, marginStart: 6, fontFamily: fonts.semibold }]}>
              {LANGUAGES.find((l) => l.code === lang)?.name}
            </Text>
          </Pressable>
        </View>
        <FadeIn style={{ alignItems: 'center', marginTop: spacing.xs }}>
          <BrandLogo size={220} />
          <Text style={[type.display, { textAlign: 'center', marginTop: spacing.lg, fontSize: 26 }]}>
            {t('Your Documents.')}{'\n'}{t('Your Device.')}{'\n'}
            <Text style={{ color: colors.primaryBright }}>{t('Your Privacy.')}</Text>
          </Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
            {t('A private, encrypted vault for your passport, ID cards, tickets and important papers.')}
          </Text>
        </FadeIn>

        <View style={{ marginTop: spacing.xl }}>
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={200 + i * 120}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.primaryBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={f.icon} size={20} color={colors.primaryBright} />
                </View>
                <View style={{ marginStart: spacing.lg, flex: 1 }}>
                  <Text style={type.h3}>{t(f.title)}</Text>
                  <Text style={type.caption}>{t(f.body)}</Text>
                </View>
              </View>
            </FadeIn>
          ))}
        </View>

        <Notice tone="danger" title={t('Important: there is no recovery')}>
          {t('Docsave has no account and no recovery service. If you forget your PIN, lose or reset this phone, or uninstall Docsave, your documents cannot be recovered by anyone. Keep your original documents.')}
        </Notice>
        <CheckRow
          checked={ob.recoveryAcknowledged}
          onChange={(v) => ob.set({ recoveryAcknowledged: v })}
          label={t('I understand that lost access means my documents cannot be recovered.')}
        />
        <CheckRow
          checked={ob.termsAccepted}
          onChange={(v) => ob.set({ termsAccepted: v })}
          label={t('I accept the Terms & Conditions and I have read the Privacy Policy.')}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md }}>
          <Text
            style={[type.caption, { color: colors.primaryBright }]}
            onPress={() => router.push('/onboarding/terms')}
            accessibilityRole="link"
          >
            {t('Read the Terms & Conditions')}
          </Text>
          <Text style={[type.caption, { marginHorizontal: spacing.sm }]}>·</Text>
          <Text
            style={[type.caption, { color: colors.primaryBright }]}
            onPress={() => router.push('/onboarding/privacy')}
            accessibilityRole="link"
          >
            {t('Read the Privacy Policy')}
          </Text>
        </View>
      </Screen>
    </View>
  );
}
