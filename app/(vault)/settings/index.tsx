import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Text, View } from 'react-native';
import { Header, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { openPrivacyContact } from '../../../src/content/contact';
import { useReauth } from '../../../src/security/ReauthProvider';
import { colors, spacing, type } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';
import { autoLockLabel } from '../../../src/utils/format';
import Constants from 'expo-constants';

export default function SettingsHome() {
  const router = useRouter();
  const vault = useVault();
  const { authenticate, requestPin } = useReauth();
  const mode = vault.meta?.unlockMode ?? 'pin';
  const bioOn = mode !== 'pin';
  const { biometrics } = vault;

  async function toggleBiometrics(on: boolean) {
    const pin = await requestPin(on ? `Enter your PIN to enable ${biometrics.label}` : `Enter your PIN to disable ${biometrics.label}`);
    if (!pin) return;
    try {
      await vault.setUnlockMode(on ? 'pin_or_bio' : 'pin', pin, true);
    } catch (e) {
      Alert.alert('Not changed', (e as Error)?.message || 'The face / fingerprint check did not complete.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Screen>
      <Header title="Settings" />

      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon={biometrics.icon}
          title={biometrics.label}
          subtitle={
            !biometrics.available
              ? 'Not available on this phone'
              : mode === 'pin_and_bio'
                ? `Two-factor: ${biometrics.label} + PIN`
                : bioOn
                  ? 'On — unlock without typing your PIN'
                  : 'Off — tap to unlock without typing your PIN'
          }
          toggle={bioOn}
          onToggle={toggleBiometrics}
          disabled={!biometrics.available && !bioOn}
        />
        <SettingRow
          icon="lock-open-outline"
          title="Unlock method"
          value={mode === 'pin' ? 'PIN' : mode === 'pin_and_bio' ? 'Two-factor' : 'Biometric or PIN'}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'unlock' } })}
        />
        <SettingRow icon="keypad-outline" title="Change PIN" onPress={() => router.push('/settings/change-pin')} />
        <SettingRow
          icon="timer-outline"
          title="Automatic lock"
          value={autoLockLabel(vault.settings.autoLockSeconds)}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'autolock' } })}
        />
        <SettingRow
          icon="document-lock-outline"
          title="Document protection"
          subtitle="Confirm before viewing, erase after failed PINs"
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'access' } })}
        />
        <SettingRow icon="lock-closed-outline" title="Lock now" subtitle="Close the vault immediately" onPress={vault.lock} />
        <SettingRow
          icon="shield-checkmark-outline"
          title="How Docsave protects you"
          onPress={() => router.push('/settings/protection')}
        />
      </SettingsGroup>

      <SectionTitle>Privacy</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="eye-off-outline"
          title="Privacy settings"
          subtitle="Previews, notifications privacy, diagnostics"
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingRow
          icon="hand-left-outline"
          title="Your privacy rights"
          subtitle="Access, correct, export, delete"
          onPress={() => router.push('/settings/rights')}
        />
        <SettingRow icon="mail-outline" title="Contact privacy support" onPress={openPrivacyContact} />
        <SettingRow
          icon="notifications-outline"
          title="Push notifications"
          value={vault.settings.notificationsEnabled ? 'On' : 'Off'}
          onPress={() => router.push('/settings/notifications')}
        />
      </SettingsGroup>

      <SectionTitle>About</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="document-text-outline" title="Terms & Conditions" onPress={() => router.push('/settings/terms')} />
        <SettingRow icon="hand-left-outline" title="Privacy Policy" onPress={() => router.push('/settings/privacy-policy')} />
        <SettingRow icon="information-circle-outline" title="About Docsave" onPress={() => router.push('/settings/about')} />
      </SettingsGroup>

      <SectionTitle>Danger zone</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="trash-outline"
          title="Delete all documents"
          subtitle="Keeps your vault, PIN and settings"
          danger
          onPress={async () => {
            if (await authenticate('Confirm to manage destructive actions', { pinOnly: true })) {
              router.push({ pathname: '/settings/danger', params: { action: 'delete-all' } });
            }
          }}
        />
        <SettingRow
          icon="nuclear-outline"
          title="Permanently destroy vault"
          subtitle="Erases keys, documents and settings"
          danger
          onPress={async () => {
            if (await authenticate('Confirm to manage destructive actions', { pinOnly: true })) {
              router.push({ pathname: '/settings/danger', params: { action: 'destroy' } });
            }
          }}
        />
      </SettingsGroup>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xxl, color: colors.textMuted }]}>
        Docsave {Constants.expoConfig?.version ?? ''} · Your Documents. Your Device. Your Privacy.
      </Text>
    </Screen>
    </View>
  );
}
