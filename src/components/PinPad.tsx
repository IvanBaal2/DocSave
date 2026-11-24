import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, spacing, type, fonts } from '../theme/theme';
import { t } from '../i18n';
import type { IconName } from './ui';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length: number;
  /** Called once the PIN reaches `length` digits. */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  /** Increment to trigger a shake animation (wrong PIN). */
  errorSignal?: number;
  leftAction?: { icon: IconName; label: string; onPress: () => void };
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'left', '0', 'del'] as const;

/**
 * Custom on-screen keypad. Using our own keypad (instead of the system keyboard)
 * keeps the PIN away from third-party keyboards, keyboard learning and autofill.
 */
export function PinPad({ value, onChange, length, onComplete, disabled, errorSignal = 0, leftAction }: Props) {
  const shake = useRef(new Animated.Value(0)).current;
  // Smaller keys on short / narrow screens so the whole keypad always fits.
  const { height, width } = useWindowDimensions();
  const key = Math.round(Math.max(54, Math.min(74, height * 0.085, (width - 80) / 3)));
  const keyStyle = { width: key, height: key, borderRadius: key / 2, marginBottom: Math.round(key * 0.18) };

  useEffect(() => {
    if (!errorSignal) return;
    // visual shake only (silent)
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: true })),
    ).start();
  }, [errorSignal, shake]);

  // The digits typed so far, updated synchronously on every tap. Building the
  // PIN from the rendered `value` prop could drop a digit when two taps arrive
  // before the screen re-renders (fast typing), producing a wrong PIN.
  const buffer = useRef(value);
  const completed = useRef(false);
  useEffect(() => {
    // Parent cleared or changed the value (e.g. after a wrong PIN): follow it.
    buffer.current = value;
    if (value.length < length) completed.current = false;
  }, [value, length]);

  function press(k: (typeof KEYS)[number]) {
    if (disabled) return;
    if (k === 'left') return leftAction?.onPress();
    // Silent keypad: no click sound and no vibration per digit.
    if (k === 'del') {
      if (completed.current) return;
      buffer.current = buffer.current.slice(0, -1);
      onChange(buffer.current);
      return;
    }
    if (completed.current || buffer.current.length >= length) return;
    const next = buffer.current + k;
    buffer.current = next;
    onChange(next);
    if (next.length === length) {
      completed.current = true;
      setTimeout(() => onComplete?.(next), 60);
    }
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: shake }] }]}
        accessibilityLabel={`${value.length} of ${length} digits entered`}
        accessibilityLiveRegion="polite"
      >
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      <View style={[styles.grid, { width: key * 3 + 48, direction: 'ltr' }]}>
        {KEYS.map((k) => {
          if (k === 'left' && !leftAction) return <View key={k} style={styles.key} />;
          const label =
            k === 'del' ? t('Delete digit') : k === 'left' ? leftAction!.label : t('Digit {n}', { n: k });
          return (
            <Pressable
              key={k}
              android_disableSound
              onPress={() => press(k)}
              disabled={disabled || (k === 'del' && value.length === 0)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.key,
                keyStyle,
                k !== 'del' && k !== 'left' && styles.keyDigit,
                pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.95 }] },
              ]}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.textSecondary} />
              ) : k === 'left' ? (
                <Ionicons name={leftAction!.icon} size={30} color={colors.primaryBright} />
              ) : (
                <Text style={styles.digit}>{k}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const KEY = 74;
const styles = StyleSheet.create({
  dots: { flexDirection: 'row', marginBottom: spacing.xxl, minHeight: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    marginHorizontal: 8,
  },
  dotFilled: { backgroundColor: colors.primaryBright, borderColor: colors.primaryBright },
  grid: { width: KEY * 3 + 48, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  keyDigit: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  digit: { ...type.h1, fontSize: 28, fontFamily: fonts.medium },
});
