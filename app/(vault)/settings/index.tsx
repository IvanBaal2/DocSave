import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { Header, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { LANGUAGES, useI18n } from '../../../src/i18n';
import { readPrefs } from '../../../src/prefs';
import { useReauth } from '../../../src/security/ReauthProvider';
import { colors, spacing, type } from '../../../src/theme/theme';
import { autoLockLabel } from '../../../src/utils/format';
import { useVault } from '../../../src/vault/VaultContext';

/**
 * Settings home. Every function appears once: details live on the linked page.
 */
export default function SettingsHome() {
  const router = useRouter();
  const vault = useVault();
  const { authenticate } = useReauth();
  const { t, lang } = useI18n();
  const mode = vault.meta?.unlockMode ?? 'pin';
  const { biometrics } = vault;

  const unlockValue =
    mode === 'pin'
      ? t('PIN only')
      : mode === 'pin_and_bio'
        ? t('Two-factor')
        : biometrics.face && biometrics.fingerprint
          ? t('Face, fingerprint, PIN')
          : biometrics.face
            ? t('Face, PIN')
            : t('Fingerprint, PIN');

  const theme = readPrefs().theme ?? 'system';
  const themeLabel = theme === 'light' ? t('Light') : theme === 'dark' ? t('Dark') : t('System');

  async function openDanger(action: 'delete-all' | 'destroy') {
    if (await authenticate(t('Confirm to manage destructive actions'), { pinOnly: true })) {
      router.push({ pathname: '/settings/danger', params: { action } });
    }
  }

  return (
    <Screen>
      <Header title={t('Settings')} />

      <SectionTitle>{t('Security')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon={biometrics.face ? 'scan-outline' : 'finger-print-outline'}
          title={t('Unlock methods')}
          value={unlockValue}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'unlock' } })}
        />
        <SettingRow icon="keypad-outline" title={t('Change PIN')} onPress={() => router.push('/settings/change-pin')} />
        <SettingRow
          icon="timer-outline"
          title={t('Automatic lock')}
          value={autoLockLabel(vault.settings.autoLockSeconds)}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'autolock' } })}
        />
        <SettingRow
          icon="document-lock-outline"
          title={t('Document protection')}
          subtitle={t('Confirm before viewing, erase after failed PINs')}
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'access' } })}
        />
        <SettingRow
          icon="shield-checkmark-outline"
          title={t('Security status')}
          subtitle={t('How Docsave protects you')}
          onPress={() => router.push('/settings/protection')}
        />
        <SettingRow icon="lock-closed-outline" title={t('Lock now')} onPress={vault.lock} />
      </SettingsGroup>

      <SectionTitle>{t('General')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="language-outline"
          title={t('Language')}
          value={LANGUAGES.find((l) => l.code === lang)?.name}
          onPress={() => router.push('/settings/language')}
        />
        <SettingRow
          icon="contrast-outline"
          title={t('Appearance')}
          value={themeLabel}
          onPress={() => router.push('/settings/appearance')}
        />
        <SettingRow
          icon="notifications-outline"
          title={t('Reminders')}
          value={vault.settings.notificationsEnabled ? t('On') : t('Off')}
          onPress={() => router.push('/settings/notifications')}
        />
      </SettingsGroup>

      <SectionTitle>{t('Privacy')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="eye-off-outline"
          title={t('Privacy settings')}
          subtitle={t('Previews, notifications privacy, diagnostics')}
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingRow
          icon="hand-left-outline"
          title={t('Your privacy rights')}
          subtitle={t('Access, correct, export, delete, contact')}
          onPress={() => router.push('/settings/rights')}
        />
      </SettingsGroup>

      <SectionTitle>{t('About')}</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="information-circle-outline" title={t('About Docsave')} onPress={() => router.push('/settings/about')} />
        <SettingRow icon="document-text-outline" title={t('Terms & Conditions')} onPress={() => router.push('/settings/terms')} />
        <SettingRow icon="reader-outline" title={t('Privacy Policy')} onPress={() => router.push('/settings/privacy-policy')} />
      </SettingsGroup>

      <SectionTitle>{t('Danger zone')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="trash-outline"
          title={t('Delete all documents')}
          subtitle={t('Keeps your vault, PIN and settings')}
          danger
          onPress={() => openDanger('delete-all')}
        />
        <SettingRow
          icon="nuclear-outline"
          title={t('Permanently destroy vault')}
          subtitle={t('Erases keys, documents and settings')}
          danger
          onPress={() => openDanger('destroy')}
        />
      </SettingsGroup>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xxl, color: colors.textMuted }]}>
        Docsave {Constants.expoConfig?.version ?? ''} · {t('Your Documents. Your Device. Your Privacy.')}
      </Text>
    </Screen>
  );
}
