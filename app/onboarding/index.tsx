import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useOnboarding } from './_layout';
import { BrandLogo, Button, FadeIn, Screen, type IconName } from '../../src/components/ui';
import { colors, gradients, spacing, type } from '../../src/theme/theme';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'lock-closed', title: 'Military-grade encryption', body: 'AES-256-GCM on every document' },
  { icon: 'phone-portrait', title: 'Stays on this device', body: 'No cloud, no servers, no uploads' },
  { icon: 'person-remove', title: 'No account needed', body: 'No email, no sign-up, no tracking' },
];

export default function Welcome() {
  const router = useRouter();
  const ob = useOnboarding();
  const start = () => {
    // Continuing records agreement to the Terms and Privacy Policy linked below.
    ob.set({ termsAccepted: true, privacyAccepted: true, recoveryAcknowledged: true });
    router.push('/onboarding/biometrics');
  };
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.hero} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 520 }} />
      <Screen
        footer={
          <View>
            <Button title="Get started" icon="arrow-forward" onPress={start} />
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
              By continuing you agree to the{' '}
              <Text style={{ color: colors.primaryBright }} onPress={() => router.push('/onboarding/terms')} accessibilityRole="link">
                Terms & Conditions
              </Text>{' '}
              and{' '}
              <Text style={{ color: colors.primaryBright }} onPress={() => router.push('/onboarding/privacy')} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        }
      >
        <FadeIn style={{ alignItems: 'center', marginTop: spacing.md }}>
          <BrandLogo size={250} />
          <Text style={[type.display, { textAlign: 'center', marginTop: spacing.lg, fontSize: 26 }]}>
            Your Documents.{'\n'}Your Device.{'\n'}
            <Text style={{ color: colors.primaryBright }}>Your Privacy.</Text>
          </Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
            A private, encrypted vault for your passport, ID cards, tickets and important papers.
          </Text>
        </FadeIn>
        <View style={{ marginTop: spacing.xxl }}>
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
                <View style={{ marginLeft: spacing.lg, flex: 1 }}>
                  <Text style={type.h3}>{f.title}</Text>
                  <Text style={type.caption}>{f.body}</Text>
                </View>
              </View>
            </FadeIn>
          ))}
        </View>
      </Screen>
    </View>
  );
}
