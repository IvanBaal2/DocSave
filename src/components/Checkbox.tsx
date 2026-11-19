import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme/theme';
import { haptic } from './ui';

export function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onChange(!checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: checked ? colors.primaryBorder : colors.border,
        backgroundColor: checked ? colors.primarySoft : colors.surface,
        opacity: pressed ? 0.85 : 1,
        marginTop: spacing.md,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.borderStrong,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={17} color="#03140D" /> : null}
      </View>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
