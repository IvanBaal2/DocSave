import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { Header, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
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
      await vault.setUnlockMode(on ? 'pin_or_bio' : 'pin', pin);
    } catch {
      // Biometric prompt cancelled – mode unchanged.
    }
  }

  return (
    <Screen>
      <Header title="Settings" />

      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="shield-checkmark-outline"
          title="Security settings"
          subtitle="Unlock method, re-authentication, device checks"
          onPress={() => router.push('/settings/security')}
        />
        <SettingRow icon="keypad-outline" title="Change PIN" onPress={() => router.push('/settings/change-pin')} />
        <SettingRow
          icon={biometrics.icon}
          title={biometrics.label}
          subtitle={
            !biometrics.enrolled
              ? 'Not set up on this device'
              : mode === 'pin_and_bio'
                ? `Two-factor: ${biometrics.label} + PIN`
                : bioOn
                  ? 'Enabled'
                  : 'Disabled'
          }
          toggle={bioOn}
          onToggle={toggleBiometrics}
          disabled={!biometrics.enrolled && !bioOn}
        />
        <SettingRow
          icon="timer-outline"
          title="Automatic lock"
          value={autoLockLabel(vault.settings.autoLockSeconds)}
          onPress={() => router.push('/settings/security')}
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
          icon="notifications-outline"
          title="Push notifications"
          value={vault.settings.notificationsEnabled ? 'On' : 'Off'}
          onPress={() => router.push('/settings/notifications')}
        />
        <SettingRow icon="albums-outline" title="Folders & categories" onPress={() => router.push('/categories')} />
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
  );
}
