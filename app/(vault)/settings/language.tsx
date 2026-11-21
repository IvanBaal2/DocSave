import React from 'react';
import { Text } from 'react-native';
import { Header, Screen, SettingRow, SettingsGroup, haptic } from '../../../src/components/ui';
import { LANGUAGES, useI18n } from '../../../src/i18n';
import { spacing, type } from '../../../src/theme/theme';

/** Language picker: the whole app switches immediately; Arabic uses right-to-left layout. */
export default function LanguageSettings() {
  const { t, lang, setLanguage } = useI18n();
  return (
    <Screen>
      <Header title={t('Language')} />
      <SettingsGroup>
        {LANGUAGES.map((l) => (
          <SettingRow
            key={l.code}
            icon={l.code === lang ? 'checkmark-circle' : 'ellipse-outline'}
            title={l.name}
            subtitle={l.code === 'en' ? undefined : t(l.english)}
            toggle={l.code === lang}
            onToggle={() => {
              haptic.success();
              setLanguage(l.code);
            }}
          />
        ))}
      </SettingsGroup>
      <Text style={[type.caption, { marginTop: spacing.md }]}>
        {t('The Terms & Conditions and Privacy Policy are provided in English.')}
      </Text>
    </Screen>
  );
}
