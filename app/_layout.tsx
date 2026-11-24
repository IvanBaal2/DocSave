import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { clearLastCrash, readLastCrash } from '../modules/docsave-security';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorScreen, installGlobalErrorHandler } from '../src/components/ErrorScreen';
import { IntegrityWarning } from '../src/components/IntegrityWarning';
import { PrivacyShield } from '../src/security/PrivacyShield';
import { ReauthProvider } from '../src/security/ReauthProvider';
import { useI18n } from '../src/i18n';
import { colors } from '../src/theme/theme';
import { VaultProvider, useVault } from '../src/vault/VaultContext';

installGlobalErrorHandler();
// Keep the native launch screen until the vault state is known (no second loading screen).
SplashScreen.preventAutoHideAsync().catch(() => {});

/** expo-router renders this instead of crashing when a screen throws. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen error={error} retry={() => void retry()} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <VaultProvider>
        <ReauthProvider>
          <RootNavigator />
          <PrivacyShield />
        </ReauthProvider>
      </VaultProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, touch, integrity, integrityAcknowledged } = useVault();
  const { direction, t } = useI18n();

  // If the app closed unexpectedly last time, show the technical reason once
  // so it can be reported (contains no document data).
  useEffect(() => {
    const report = readLastCrash();
    if (!report) return;
    clearLastCrash();
    const firstLines = report.split('\n').filter(Boolean).slice(0, 14).join('\n');
    setTimeout(
      () =>
        Alert.alert(
          t('Docsave closed unexpectedly last time'),
          `${t('Please send a photo of this message to support. Your documents are safe.')}\n\n${firstLines}`,
        ),
      800,
    );
  }, []);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, direction }}
      onStartShouldSetResponderCapture={() => {
        touch(); // reset the inactivity auto-lock timer on any touch
        return false;
      }}
    >
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {/* Route guards: decrypted screens only exist while the vault is unlocked. */}
        <Stack.Protected guard={status === 'unlocked'}>
          <Stack.Screen name="(vault)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="lock" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'uninitialized'}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {integrity.compromised && !integrityAcknowledged ? <IntegrityWarning /> : null}
    </View>
  );
}
