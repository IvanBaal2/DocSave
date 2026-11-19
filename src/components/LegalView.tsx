import React from 'react';
import { Text, View } from 'react-native';
import type { LegalDocument } from '../content/legal';
import { colors, spacing, type } from '../theme/theme';

export function LegalView({ doc }: { doc: LegalDocument }) {
  return (
    <View>
      <Text style={type.caption}>
        Version {doc.version} · Last updated {doc.updated}
      </Text>
      {doc.status === "draft" ? (
        <Text style={[type.caption, { color: colors.warning, marginTop: spacing.sm }]}>
          Draft — pending legal review. Items in [brackets] are still to be provided by the publisher.
        </Text>
      ) : null}
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ marginTop: spacing.xl }}>
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
