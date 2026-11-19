import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { Card, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { CONTACT } from '../../../src/content/legal';
import { openPrivacyContact } from '../../../src/content/contact';
import { spacing, type } from '../../../src/theme/theme';

/**
 * How to exercise data-protection rights in an app without accounts: almost
 * everything is done directly on the device, because the publisher does not
 * hold a copy of the vault.
 */
export default function PrivacyRights() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Your privacy rights" />
      <Notice tone="info" title="No account, nothing stored by us">
        Docsave has no user accounts and no servers. Your documents and their details exist only in the encrypted vault
        on this phone, so there is no remote account to access or delete. You can exercise your rights directly here.
      </Notice>

      <SectionTitle>Access and correct</SectionTitle>
      <Card>
        <Text style={type.bodySecondary}>
          Open any document to see everything Docsave stores about it (images, recognised details, notes and dates). Tap
          Edit to correct a name, a detail or a date.
        </Text>
      </Card>

      <SectionTitle>Export (portability)</SectionTitle>
      <Card>
        <Text style={type.bodySecondary}>
          Open a document and tap Export to save, print or send a copy using your phone's share menu. An exported copy is
          no longer protected by Docsave.
        </Text>
      </Card>

      <SectionTitle>Delete</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="document-outline" title="Delete one document" subtitle="Open it, then tap Delete" />
        <SettingRow
          icon="trash-outline"
          title="Delete all documents"
          danger
          onPress={() => router.push({ pathname: '/settings/danger', params: { action: 'delete-all' } })}
        />
        <SettingRow
          icon="nuclear-outline"
          title="Permanently destroy vault"
          subtitle="Erases keys, documents and settings"
          danger
          onPress={() => router.push({ pathname: '/settings/danger', params: { action: 'destroy' } })}
        />
      </SettingsGroup>
      <Text style={[type.caption, { marginTop: spacing.sm }]}>
        Uninstalling Docsave also removes the vault from this phone.
      </Text>

      <SectionTitle>Withdraw choices</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="notifications-outline" title="Reminders" onPress={() => router.push('/settings/notifications')} />
        <SettingRow icon="pulse-outline" title="Diagnostics" onPress={() => router.push('/settings/privacy')} />
        <SettingRow
          icon="finger-print-outline"
          title="Face / fingerprint unlock"
          onPress={() => router.push({ pathname: '/settings/security', params: { section: 'unlock' } })}
        />
      </SettingsGroup>

      <SectionTitle>Contact and complaints</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="mail-outline" title="Contact privacy support" subtitle={CONTACT} onPress={openPrivacyContact} />
        <SettingRow icon="document-text-outline" title="Privacy Policy" onPress={() => router.push('/settings/privacy-policy')} />
      </SettingsGroup>
      <Text style={[type.caption, { marginTop: spacing.sm }]}>
        If you believe your data-protection rights have not been respected, you can complain to the data-protection
        authority of the country where you live (in Spain: Agencia Española de Protección de Datos, www.aepd.es).
      </Text>
    </Screen>
  );
}
