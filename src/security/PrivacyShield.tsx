import * as ScreenCapture from 'expo-screen-capture';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../components/ui';
import { colors, spacing, type } from '../theme/theme';
import { t } from '../i18n';
import { useVault } from '../vault/VaultContext';

const KEY = 'docsave-privacy';

/**
 * - Android: FLAG_SECURE blocks screenshots/recording and blanks the Recents thumbnail.
 * - iOS: blurs the app-switcher snapshot and hides content from screen recording.
 * - Both: an opaque overlay covers the UI whenever the app is not active, so the
 *   snapshot the OS takes for the app switcher never contains a document.
 */
export function PrivacyShield() {
  const { settings } = useVault();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const enabled = settings.hideSensitivePreviews;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (enabled) {
          await ScreenCapture.preventScreenCaptureAsync(KEY);
          if (Platform.OS === 'ios') await ScreenCapture.enableAppSwitcherProtectionAsync(0.95);
        } else {
          await ScreenCapture.allowScreenCaptureAsync(KEY);
          if (Platform.OS === 'ios') await ScreenCapture.disableAppSwitcherProtectionAsync();
        }
      } catch {
        // Not available in this environment (e.g. Expo Go / web).
      }
    })();
  }, [enabled]);

  if (!enabled || active) return null;
  return (
    <View style={styles.shield} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Logo size={48} />
      <Text style={[type.caption, { marginTop: spacing.lg }]}>{t('Content hidden for your privacy')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shield: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
});
