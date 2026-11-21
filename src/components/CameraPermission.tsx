/**
 * Camera permission handling for the document scanner.
 *
 *  - First use (never asked): the system permission dialog is shown once, automatically.
 *  - Denied, can ask again: explains why and offers "Allow camera" (user-initiated request only).
 *  - Permanently denied / disabled in system settings: "Open Settings" opens this app's
 *    Android App Info page (Linking.openSettings → Settings.ACTION_APPLICATION_DETAILS_SETTINGS
 *    with the package: URI; on iOS, the app's page in Settings). The permission is never
 *    changed programmatically.
 *  - On return to Docsave the permission is checked again; once granted, the camera opens
 *    automatically (the caller renders the camera as soon as `granted` is true).
 */
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../theme/theme';
import { useVault } from '../vault/VaultContext';
import { Button } from './ui';
import { useI18n } from '../i18n';

export type CameraAccess = 'checking' | 'granted' | 'ask' | 'denied' | 'blocked';

const RETURN_TIMEOUT_MS = 10 * 60_000;

/** Resolves when the app comes back to the foreground after leaving it (or after a timeout). */
function waitForReturn(): Promise<void> {
  return new Promise((resolve) => {
    let left = false;
    const done = () => {
      sub.remove();
      clearTimeout(timer);
      resolve();
    };
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') left = true;
      else if (left) done();
    });
    const timer = setTimeout(done, RETURN_TIMEOUT_MS);
  });
}

export function useCameraAccess() {
  const vault = useVault();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const autoAsked = useRef(false);

  const access: CameraAccess = !permission
    ? 'checking'
    : permission.granted
      ? 'granted'
      : permission.status === 'undetermined'
        ? 'ask'
        : permission.canAskAgain
          ? 'denied'
          : 'blocked';

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      await vault.runExternal(requestPermission);
    } finally {
      setRequesting(false);
    }
  }, [vault, requestPermission]);

  // First time only: show the system dialog without an extra tap. Never repeated automatically.
  useEffect(() => {
    if (access === 'ask' && !autoAsked.current) {
      autoAsked.current = true;
      void request();
    }
  }, [access, request]);

  // Re-check whenever Docsave returns to the foreground (e.g. from system settings).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const openSettings = useCallback(async () => {
    // Keep the vault unlocked while the user is in system settings, until they come back.
    await vault.runExternal(async () => {
      const back = waitForReturn();
      try {
        await Linking.openSettings();
      } catch {
        return;
      }
      await back;
    });
    await getPermission();
  }, [vault, getPermission]);

  return { access, requesting, request, openSettings, recheck: getPermission };
}

export function CameraPermissionScreen({
  access,
  requesting,
  onRequest,
  onOpenSettings,
  onImport,
  onCancel,
}: {
  access: Exclude<CameraAccess, 'granted'>;
  requesting: boolean;
  onRequest: () => void;
  onOpenSettings: () => void;
  onImport?: () => void;
  onCancel: () => void;
}) {
  const { t, direction } = useI18n();
  const blocked = access === 'blocked';
  const heading = blocked ? t('Camera Access Required') : t('Allow camera access');
  const message = blocked
    ? t('Docsave needs camera access to scan your documents. Camera permission is currently disabled. Please enable it in your device settings to continue.')
    : t('Docsave needs camera access to scan your documents. Photos are read and encrypted on this device and never leave it.');

  return (
    <SafeAreaView style={[styles.root, { direction }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.ring}>
            <Ionicons name="camera" size={44} color={colors.primaryBright} />
          </View>
          {blocked ? (
            <View style={styles.badge}>
              <Ionicons name="lock-closed" size={16} color="#FFF" />
            </View>
          ) : null}
        </View>

        <Text style={[type.h1, styles.center, { marginTop: spacing.xl }]} accessibilityRole="header">
          {heading}
        </Text>
        <Text style={[type.bodySecondary, styles.center, { marginTop: spacing.md }]}>{message}</Text>

        {blocked ? (
          <View style={styles.steps} accessibilityLabel={t('In Settings, open Permissions, then Camera, and choose Allow.')}>
            {[t('Tap Open Settings'), t('Open Permissions → Camera'), t('Choose “Allow”, then come back')].map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[type.body, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </View>
        ) : access === 'denied' ? (
          <Text style={[type.caption, styles.center, { marginTop: spacing.md }]}>
            {t('Camera access was not allowed. You can allow it now, or import an existing file instead.')}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {blocked ? (
          <Button
            title={t('Open Settings')}
            icon="settings-outline"
            onPress={onOpenSettings}
            accessibilityHint={t('Opens Docsave’s page in your device settings')}
          />
        ) : (
          <Button
            title={t('Allow camera')}
            icon="camera-outline"
            loading={requesting || access === 'checking'}
            onPress={onRequest}
          />
        )}
        {onImport ? (
          <Button
            title={t('Import a File Instead')}
            variant="secondary"
            icon="folder-open-outline"
            onPress={onImport}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
        <Button title={t('Cancel')} variant="ghost" onPress={onCancel} style={{ marginTop: spacing.xs }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { textAlign: 'center' },
  illustration: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  steps: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginEnd: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  stepNumText: { color: colors.primaryBright, fontWeight: '700', fontSize: 13 },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm },
});
