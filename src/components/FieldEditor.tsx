import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme/theme';
import type { DocField } from '../vault/types';
import { ExpiryField } from './ExpiryField';
import { t } from '../i18n';
import { privateInputProps } from './ui';

const isDateKey = (key: string) => /date|expiry/i.test(key);

function StatusBadge({ status }: { status: DocField['status'] }) {
  const map = {
    recognized: { icon: 'scan' as const, label: t('Recognised'), color: colors.primaryBright },
    edited: { icon: 'create' as const, label: t('Edited'), color: colors.info },
    manual: { icon: 'create' as const, label: t('Entered'), color: colors.info },
    missing: { icon: 'help-circle' as const, label: t('Not recognised'), color: colors.warning },
  }[status];
  return (
    <View style={[styles.badge, { borderColor: map.color + '55', backgroundColor: map.color + '18' }]}>
      <Ionicons name={map.icon} size={11} color={map.color} />
      <Text style={[type.caption, { color: map.color, marginStart: 4, fontSize: 11 }]}>{map.label}</Text>
    </View>
  );
}

/**
 * Review / edit recognised fields. Recognised values are shown as read; fields
 * that could not be read are clearly marked and left empty for the user.
 */
export function FieldEditor({ fields, onChange }: { fields: DocField[]; onChange: (fields: DocField[]) => void }) {
  const update = (key: string, value: string) =>
    onChange(
      fields.map((f) =>
        f.key === key
          ? {
              ...f,
              value,
              status: value.trim() === '' ? 'missing' : f.status === 'missing' ? 'manual' : f.status === 'manual' ? 'manual' : 'edited',
            }
          : f,
      ),
    );

  return (
    <View>
      {fields.map((f) => (
        <View key={f.key} style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={type.overline}>{t(f.label)}</Text>
            <StatusBadge status={f.status} />
          </View>
          {isDateKey(f.key) ? (
            <ExpiryField label="" value={f.value || undefined} onChange={(v) => update(f.key, v ?? '')} />
          ) : (
            <TextInput
              {...privateInputProps}
              value={f.value}
              onChangeText={(v) => update(f.key, v)}
              placeholder={f.status === 'missing' ? t('Not recognised, type it if you want') : ''}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              style={[styles.input, f.status === 'missing' && { borderColor: colors.warning + '55', borderStyle: 'dashed' }]}
              accessibilityLabel={f.label}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
});
