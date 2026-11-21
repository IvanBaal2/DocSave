import Constants from 'expo-constants';
import React from 'react';
import { Platform, Share } from 'react-native';
import { Button, Notice, Screen, SectionTitle, SettingRow, SettingsGroup, Header } from '../../../src/components/ui';
import { useI18n } from '../../../src/i18n';
import { useReauth } from '../../../src/security/ReauthProvider';
import { spacing } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';

export default function PrivacySettings() {
  const vault = useVault();
  const { t } = useI18n();
  const { authenticate } = useReauth();
  const { settings, biometrics } = vault;
  const mode = vault.meta?.unlockMode ?? 'pin';

  async function shareDiagnostics() {
    // Technical report (kept in English for support). Contains no document names, notes, dates or content.
    const report = [
      'Docsave diagnostics report',
      `App version: ${Constants.expoConfig?.version ?? 'unknown'}`,
      `Platform: ${Platform.OS} ${String(Platform.Version)}`,
      `Unlock mode: ${mode}`,
      `Biometric hardware: ${biometrics.available ? 'yes' : 'no'}, enrolled: ${biometrics.enrolled ? 'yes' : 'no'}, face: ${biometrics.face ? 'yes' : 'no'}, fingerprint: ${biometrics.fingerprint ? 'yes' : 'no'}`,
      `Device integrity: ${vault.integrity.compromised ? 'indicators found' : 'ok'}${vault.integrity.emulator ? ' (emulator)' : ''}`,
      `Integrity indicators: ${vault.integrity.reasons.join(', ') || 'none'}`,
      `Document count: ${vault.index.documents.length}`,
      `Auto-lock: ${settings.autoLockSeconds}s, previews hidden: ${settings.hideSensitivePreviews}`,
    ].join('\n');
    await vault.runExternal(() => Share.share({ message: report, title: 'Docsave diagnostics' }));
  }

  return (
    <Screen>
      <Header title={t('Privacy settings')} />

      <SectionTitle>{t('Screen privacy')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="eye-off-outline"
          title={t('Hide sensitive previews')}
          subtitle={
            Platform.OS === 'android'
              ? t('Blank the app in Recents and block screenshots and screen recording')
              : t('Blur the app in the app switcher and hide content from screen recording')
          }
          toggle={settings.hideSensitivePreviews}
          onToggle={async (v) => {
            if (!v && !(await authenticate(t('Confirm to change a security setting'), { pinOnly: true }))) return;
            vault.updateSettings({ hideSensitivePreviews: v });
          }}
        />
      </SettingsGroup>
      {!settings.hideSensitivePreviews ? (
        <Notice tone="warning">
          {t(
            'Document content may now appear in the app switcher and in screenshots, which other apps or cloud photo backups could access.',
          )}
        </Notice>
      ) : null}

      <SectionTitle>{t('Notification privacy')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="notifications-off-outline"
          title={t('Generic notification text')}
          subtitle={
            settings.notificationDetail === 'generic'
              ? t('“A document in your vault needs your attention.”')
              : t('“An identity document expires in 30 days.” (category only, never names or numbers)')
          }
          toggle={settings.notificationDetail === 'generic'}
          onToggle={(v) => vault.updateSettings({ notificationDetail: v ? 'generic' : 'category' })}
        />
      </SettingsGroup>

      <SectionTitle>{t('Diagnostics')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="pulse-outline"
          title={t('Diagnostics sharing')}
          subtitle={t('Off by default. Docsave has no analytics and sends nothing automatically.')}
          toggle={settings.diagnosticsEnabled}
          onToggle={(v) => vault.updateSettings({ diagnosticsEnabled: v })}
        />
      </SettingsGroup>
      {settings.diagnosticsEnabled ? (
        <>
          <Notice tone="info">
            {t(
              'You can create a short technical report (app and system version, security check results, document count) and share it yourself through your phone’s share menu. It never contains document names, notes, dates or content.',
            )}
          </Notice>
          <Button
            title={t('Share diagnostics report')}
            variant="secondary"
            icon="share-outline"
            onPress={shareDiagnostics}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : null}

      <Notice tone="success" title={t('What Docsave never does')}>
        {t('No account, no cloud upload, no backups, no advertising, no trackers, no analytics, no third-party sharing.')}
      </Notice>
    </Screen>
  );
}
