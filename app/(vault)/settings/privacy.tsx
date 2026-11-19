import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Share } from 'react-native';
import { Button, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { spacing } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';
import { autoLockLabel } from '../../../src/utils/format';

export default function PrivacySettings() {
  const router = useRouter();
  const vault = useVault();
  const { settings, biometrics } = vault;
  const mode = vault.meta?.unlockMode ?? 'pin';

  async function shareDiagnostics() {
    // Contains no document names, notes, dates or content.
    const report = [
      'Docsave diagnostics report',
      `App version: ${Constants.expoConfig?.version ?? 'unknown'}`,
      `Platform: ${Platform.OS} ${String(Platform.Version)}`,
      `Unlock mode: ${mode}`,
      `Biometric hardware: ${biometrics.available ? 'yes' : 'no'}, enrolled: ${biometrics.enrolled ? 'yes' : 'no'}`,
      `Device integrity: ${vault.integrity.compromised ? 'indicators found' : 'ok'}${vault.integrity.emulator ? ' (emulator)' : ''}`,
      `Integrity indicators: ${vault.integrity.reasons.join(', ') || 'none'}`,
      `Document count: ${vault.index.documents.length}`,
      `Custom folders: ${vault.index.customCategories.length}`,
      `Auto-lock: ${settings.autoLockSeconds}s, previews hidden: ${settings.hideSensitivePreviews}`,
    ].join('\n');
    await vault.runExternal(() => Share.share({ message: report, title: 'Docsave diagnostics' }));
  }

  return (
    <Screen>
      <Header title="Privacy settings" />

      <SectionTitle>Access</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon={biometrics.icon}
          title="Biometric authentication"
          subtitle={
            mode === 'pin'
              ? `Off — unlock with PIN only. ${biometrics.label} data never leaves the secure hardware.`
              : `On (${mode === 'pin_and_bio' ? 'two-factor' : `${biometrics.label} or PIN`}). Docsave only learns whether verification succeeded.`
          }
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'unlock' } })}
        />
        <SettingRow
          icon="timer-outline"
          title="Automatic locking"
          subtitle="Erases the decryption key from memory when the app is left"
          value={autoLockLabel(settings.autoLockSeconds)}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'autolock' } })}
        />
      </SettingsGroup>

      <SectionTitle>Screen privacy</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="eye-off-outline"
          title="Hide sensitive previews"
          subtitle={
            Platform.OS === 'android'
              ? 'Blank the app in Recents and block screenshots and screen recording'
              : 'Blur the app in the app switcher and hide content from screen recording'
          }
          toggle={settings.hideSensitivePreviews}
          onToggle={(v) => vault.updateSettings({ hideSensitivePreviews: v })}
        />
      </SettingsGroup>
      {!settings.hideSensitivePreviews ? (
        <Notice tone="warning">
          Document content may now appear in the app switcher and in screenshots, which other apps or cloud photo
          backups could access.
        </Notice>
      ) : null}

      <SectionTitle>Notification privacy</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="notifications-off-outline"
          title="Generic notification text"
          subtitle={
            settings.notificationDetail === 'generic'
              ? '"A document in your vault needs your attention."'
              : '"An identity document expires in 30 days." (category only — never names or numbers)'
          }
          toggle={settings.notificationDetail === 'generic'}
          onToggle={(v) => vault.updateSettings({ notificationDetail: v ? 'generic' : 'category' })}
        />
        <SettingRow
          icon="notifications-outline"
          title="Reminder settings"
          value={settings.notificationsEnabled ? 'On' : 'Off'}
          onPress={() => router.push('/settings/notifications')}
        />
      </SettingsGroup>

      <SectionTitle>Diagnostics</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="pulse-outline"
          title="Diagnostics sharing"
          subtitle="Off by default. Docsave has no analytics and sends nothing automatically."
          toggle={settings.diagnosticsEnabled}
          onToggle={(v) => vault.updateSettings({ diagnosticsEnabled: v })}
        />
      </SettingsGroup>
      {settings.diagnosticsEnabled ? (
        <>
          <Notice tone="info">
            You can create a short technical report (app and OS version, security check results, document count) and
            share it yourself via your device's share menu. It never contains document names, notes, dates or content.
          </Notice>
          <Button title="Share diagnostics report" variant="secondary" icon="share-outline" onPress={shareDiagnostics} style={{ marginTop: spacing.sm }} />
        </>
      ) : null}

      <Notice tone="success" title="What Docsave never does">
        No account, no cloud upload, no backups, no advertising, no trackers, no analytics, no third-party sharing.
      </Notice>
    </Screen>
  );
}
