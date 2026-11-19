import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';
import { haptic, type IconName } from './ui';

type Tab = 'home' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName; activeIcon: IconName; href: '/' | '/settings' }[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', href: '/' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', href: '/settings' },
];

export const BOTTOM_NAV_HEIGHT = 64;

export function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => {
              if (on) return;
              haptic.tap();
              if (t.id === 'home') router.dismissTo('/');
              else router.navigate(t.href);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={styles.tab}
          >
            <View style={[styles.pill, on && styles.pillActive]}>
              <Ionicons name={on ? t.activeIcon : t.icon} size={22} color={on ? colors.primaryBright : colors.textSecondary} />
            </View>
            <Text style={[styles.label, on && { color: colors.primaryBright }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(7,11,20,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center' },
  pill: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 12, marginTop: 4, color: colors.textSecondary, fontWeight: '500' },
});
