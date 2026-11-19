import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Button, Chip, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { reminderText, requestPermission, sendTestNotification } from '../../../src/notifications/scheduler';
import { colors, radius, spacing, type } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';

const LEAD_DAYS = [7, 14, 30, 60, 90];

export default function NotificationSettings() {
  const vault = useVault();
  const { settings } = vault;
  const [busy, setBusy] = useState(false);
  const preview = reminderText('identity', settings.reminderLeadDays, settings.notificationDetail);

  async function toggleMaster(on: boolean) {
    if (!on) return vault.updateSettings({ notificationsEnabled: false });
    setBusy(true);
    const granted = await vault.runExternal(requestPermission);
    setBusy(false);
    if (!granted) {
      Alert.alert('Notifications are blocked', 'Allow notifications for Docsave in your device settings to receive reminders.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    vault.updateSettings({ notificationsEnabled: true });
  }

  const on = settings.notificationsEnabled;
  const withDates = vault.index.documents.filter((d) => d.expiryDate).length;

  return (
    <Screen>
      <Header title="Push notifications" />
      <SettingsGroup>
        <SettingRow
          icon="notifications-outline"
          title="Allow reminders"
          subtitle="Local reminders scheduled on this device only"
          toggle={on}
          onToggle={toggleMaster}
          disabled={busy}
        />
      </SettingsGroup>

      <SectionTitle>Reminder types</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="globe-outline"
          title="Passport & ID expiry"
          subtitle="6 months, lead time, 7 days and on the day"
          toggle={settings.identityReminders}
          onToggle={(v) => vault.updateSettings({ identityReminders: v })}
          disabled={!on}
        />
        <SettingRow
          icon="airplane-outline"
          title="Travel reminders"
          subtitle="7 days and 1 day before a travel document's date"
          toggle={settings.travelReminders}
          onToggle={(v) => vault.updateSettings({ travelReminders: v })}
          disabled={!on}
        />
        <SettingRow
          icon="alarm-outline"
          title="Other document expiry"
          subtitle="Lead time and on the day"
          toggle={settings.expiryReminders}
          onToggle={(v) => vault.updateSettings({ expiryReminders: v })}
          disabled={!on}
        />
      </SettingsGroup>

      <SectionTitle>Remind me before expiry</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', opacity: on ? 1 : 0.5 }}>
        {LEAD_DAYS.map((d) => (
          <Chip
            key={d}
            label={`${d} days`}
            selected={settings.reminderLeadDays === d}
            onPress={() => on && vault.updateSettings({ reminderLeadDays: d })}
          />
        ))}
      </View>
      <Text style={[type.caption, { marginTop: spacing.xs }]}>
        {withDates} document{withDates === 1 ? ' has' : 's have'} an expiry or travel date.
      </Text>

      <SectionTitle>Preview</SectionTitle>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityLabel={`Notification preview: ${preview.title}. ${preview.body}`}
      >
        <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={20} color="#03140D" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={type.h3}>{preview.title}</Text>
          <Text style={[type.bodySecondary, { marginTop: 2 }]}>{preview.body}</Text>
        </View>
      </View>
      {on ? (
        <Button
          title="Send a test notification"
          variant="secondary"
          icon="paper-plane-outline"
          onPress={() => sendTestNotification(settings)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <Notice tone="success" title="Private by design">
        Notifications never include document names, passport or ID numbers, notes or any document content. Change
        the wording in Privacy settings. No push server is used: reminders are created and delivered on this device.
      </Notice>
    </Screen>
  );
}
