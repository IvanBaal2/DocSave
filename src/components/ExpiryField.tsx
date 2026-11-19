import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme/theme';
import { formatDate, parseIsoDate, toIsoDate } from '../utils/format';
import { Button } from './ui';

export function ExpiryField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  hint?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseIsoDate(value) ?? new Date());

  function open() {
    const current = parseIsoDate(value) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(toIsoDate(d));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  }

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[type.overline, { marginBottom: spacing.sm }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}`}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfacePressed : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            height: 52,
          })}
        >
          <Ionicons name="calendar-outline" size={19} color={colors.primaryBright} />
          <Text style={[type.body, { marginLeft: spacing.md, color: value ? colors.text : colors.textMuted }]}>
            {value ? formatDate(value) : 'Optional — tap to set'}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => onChange(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
            style={{ padding: spacing.md }}
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={[type.caption, { marginTop: 6 }]}>{hint}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setIosOpen(false)} />
          <View style={{ backgroundColor: colors.bgElevated, padding: spacing.xl, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              themeVariant="dark"
              accentColor={colors.primary}
              onChange={(_, d) => d && setDraft(d)}
            />
            <Button
              title="Set date"
              onPress={() => {
                onChange(toIsoDate(draft));
                setIosOpen(false);
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
