import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Button, Chip, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { reminderText, requestPermission, sendTestNotification } from '../../../src/notifications/scheduler';
import { colors, radius, spacing, type } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';
import { useI18n } from '../../../src/i18n';

const LEAD_DAYS = [7, 14, 30, 60, 90];

export default function NotificationSettings() {
  const vault = useVault();
  const { t } = useI18n();
  const { settings } = vault;
  const [busy, setBusy] = useState(false);
  const preview = reminderText('identity', settings.reminderLeadDays, settings.notificationDetail);

  async function toggleMaster(on: boolean) {
    if (!on) return vault.updateSettings({ notificationsEnabled: false });
    setBusy(true);
    const granted = await vault.runExternal(requestPermission);
    setBusy(false);
    if (!granted) {
      Alert.alert(t('Notifications are blocked'), t('Allow notifications for Docsave in your device settings to receive reminders.'), [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    vault.updateSettings({ notificationsEnabled: true });
  }

  const on = settings.notificationsEnabled;
  const withDates = vault.index.documents.filter((d) => d.expiryDate).length;

  return (
    <Screen>
      <Header title={t('Reminders')} />
      <SettingsGroup>
        <SettingRow
          icon="notifications-outline"
          title={t('Allow reminders')}
          subtitle={t('Local reminders scheduled on this device only')}
          toggle={on}
          onToggle={toggleMaster}
          disabled={busy}
        />
      </SettingsGroup>

      <SectionTitle>{t('Reminder types')}</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="globe-outline"
          title={t('Passport & ID expiry')}
          subtitle={t('6 months, lead time, 7 days and on the day')}
          toggle={settings.identityReminders}
          onToggle={(v) => vault.updateSettings({ identityReminders: v })}
          disabled={!on}
        />
        <SettingRow
          icon="airplane-outline"
          title={t('Travel reminders')}
          subtitle={t('7 days and 1 day before a travel document’s date')}
          toggle={settings.travelReminders}
          onToggle={(v) => vault.updateSettings({ travelReminders: v })}
          disabled={!on}
        />
        <SettingRow
          icon="alarm-outline"
          title={t('Other document expiry')}
          subtitle={t('Lead time and on the day')}
          toggle={settings.expiryReminders}
          onToggle={(v) => vault.updateSettings({ expiryReminders: v })}
          disabled={!on}
        />
      </SettingsGroup>

      <SectionTitle>{t('Remind me before expiry')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', opacity: on ? 1 : 0.5 }}>
        {LEAD_DAYS.map((d) => (
          <Chip
            key={d}
            label={t('{n} days', { n: d })}
            selected={settings.reminderLeadDays === d}
            onPress={() => on && vault.updateSettings({ reminderLeadDays: d })}
          />
        ))}
      </View>
      <Text style={[type.caption, { marginTop: spacing.xs }]}>
        {withDates === 1 ? t('1 document has an expiry or travel date.') : t('{count} documents have an expiry or travel date.', { count: withDates })}
      </Text>

      <SectionTitle>{t('Preview')}</SectionTitle>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityLabel={`${t('Preview')}: ${preview.title}. ${preview.body}`}
      >
        <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={20} color="#03140D" />
        </View>
        <View style={{ flex: 1, marginStart: spacing.md }}>
          <Text style={type.h3}>{preview.title}</Text>
          <Text style={[type.bodySecondary, { marginTop: 2 }]}>{preview.body}</Text>
        </View>
      </View>
      {on ? (
        <Button
          title={t('Send a test notification')}
          variant="secondary"
          icon="paper-plane-outline"
          onPress={() => sendTestNotification(settings)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <Notice tone="success" title={t('Private by design')}>
        {t('Notifications never include document names, passport or ID numbers, notes or any document content. Change the wording in Privacy settings. No push server is used: reminders are created and delivered on this device.')}
      </Notice>
    </Screen>
  );
}
