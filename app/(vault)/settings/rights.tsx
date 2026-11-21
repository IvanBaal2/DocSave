import React from 'react';
import { Text } from 'react-native';
import { Card, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { openPrivacyContact } from '../../../src/content/contact';
import { CONTACT } from '../../../src/content/legal';
import { useI18n } from '../../../src/i18n';
import { spacing, type } from '../../../src/theme/theme';

/**
 * How to exercise data-protection rights in an app without accounts. The
 * actions themselves live in one place each (document page, Settings), so this
 * page explains where to find them instead of repeating the buttons.
 */
export default function PrivacyRights() {
  const { t } = useI18n();
  const items: [string, string][] = [
    ['Access and correct', 'Open any document to see everything Docsave stores about it. Tap Edit to correct a name, a detail or a date.'],
    ['Export (portability)', 'Open a document and tap Export to save, print or send a copy using your phone’s share menu. An exported copy is no longer protected by Docsave.'],
    ['Delete', 'Open a document and tap Delete, or use Delete all documents or Permanently destroy vault at the bottom of Settings. Uninstalling Docsave also removes the vault from this phone.'],
    ['Withdraw choices', 'Reminders, diagnostics and face or fingerprint unlock can be turned off at any time in Settings.'],
  ];
  return (
    <Screen>
      <Header title={t('Your privacy rights')} />
      <Notice tone="info" title={t('No account, nothing stored by us')}>
        {t(
          'Docsave has no user accounts and no servers. Your documents and their details exist only in the encrypted vault on this phone, so you exercise your rights directly here.',
        )}
      </Notice>

      {items.map(([title, body]) => (
        <React.Fragment key={title}>
          <SectionTitle>{t(title)}</SectionTitle>
          <Card>
            <Text style={type.bodySecondary}>{t(body)}</Text>
          </Card>
        </React.Fragment>
      ))}

      <SectionTitle>{t('Contact and complaints')}</SectionTitle>
      <SettingsGroup>
        <SettingRow icon="mail-outline" title={t('Contact privacy support')} subtitle={CONTACT} onPress={openPrivacyContact} />
      </SettingsGroup>
      <Text style={[type.caption, { marginTop: spacing.sm }]}>
        {t(
          'If you believe your data-protection rights have not been respected, you can complain to the data-protection authority of the country where you live (in Spain: Agencia Española de Protección de Datos, www.aepd.es).',
        )}
      </Text>
    </Screen>
  );
}
