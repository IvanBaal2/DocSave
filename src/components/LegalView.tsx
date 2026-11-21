import React from 'react';
import { Text, View } from 'react-native';
import type { LegalDocument } from '../content/legal';
import { useI18n } from '../i18n';
import { colors, spacing, type } from '../theme/theme';

export function LegalView({ doc }: { doc: LegalDocument }) {
  const { t, lang } = useI18n();
  return (
    <View>
      <Text style={type.caption}>
        {t('Version {version} · Last updated {date}', { version: doc.version, date: doc.updated })}
      </Text>
      {doc.status === "draft" ? (
        <Text style={[type.caption, { color: colors.warning, marginTop: spacing.sm }]}>
          {t('Draft, pending legal review. Items in [brackets] are still to be provided by the publisher.')}
        </Text>
      ) : null}
      {lang !== 'en' ? (
        <Text style={[type.caption, { marginTop: spacing.sm }]}>{t('The Terms & Conditions and Privacy Policy are provided in English.')}</Text>
      ) : null}
      {doc.sections.map((s) => (
        // The legal text is in English: keep it left-to-right in every language.
        <View key={s.heading} style={{ marginTop: spacing.xl, direction: 'ltr' }}>
          <Text style={[type.h3, { color: colors.primaryBright, marginBottom: spacing.sm }]} accessibilityRole="header">
            {s.heading}
          </Text>
          {s.body.map((p, i) => (
            <Text key={i} style={[type.bodySecondary, { marginBottom: spacing.sm }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
