import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, gradients, radius, shadow, spacing, type } from '../theme/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

// ── Layout ───────────────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  contentStyle,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : (
        <View style={{ width: 4 }} />
      )}
      <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
        <Text style={type.h2} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.caption} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.text,
  size = 22,
  tone = 'default',
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        tone === 'danger' && { backgroundColor: colors.dangerSoft },
        pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Ionicons name={icon} size={size} color={tone === 'danger' ? colors.danger : color} />
    </Pressable>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? '#03140D' : variant === 'danger' ? '#FFF' : colors.text;
  const content = (
    <View style={styles.buttonInner}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[type.button, { color: fg }]}>{title}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        inactive && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {variant === 'primary' || variant === 'danger' ? (
        <LinearGradient
          colors={variant === 'primary' ? gradients.primary : gradients.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={type.overline}>{children}</Text>
      {action}
    </View>
  );
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: IconName;
  title?: string;
  children: React.ReactNode;
}) {
  const palette = {
    info: { bg: 'rgba(96,165,250,0.10)', fg: colors.info, icon: 'information-circle' as IconName },
    success: { bg: colors.primarySoft, fg: colors.primaryBright, icon: 'shield-checkmark' as IconName },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' as IconName },
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as IconName },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.fg + '40' }]}>
      <Ionicons name={icon ?? palette.icon} size={20} color={palette.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        {title ? <Text style={[type.h3, { color: palette.fg, marginBottom: 2 }]}>{title}</Text> : null}
        {typeof children === 'string' ? <Text style={type.bodySecondary}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.8 }]}
    >
      {icon ? (
        <Ionicons name={icon} size={15} color={selected ? colors.primaryBright : colors.textSecondary} style={{ marginRight: 6 }} />
      ) : null}
      <Text style={[type.bodySecondary, { fontSize: 13 }, selected && { color: colors.primaryBright, fontWeight: '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Settings rows ────────────────────────────────────────────────────────────

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {items.map((child, i) => (
        <View key={i}>
          {child}
          {i < items.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  );
}

export function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  toggle,
  onToggle,
  danger,
  disabled,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const tint = danger ? colors.danger : colors.primaryBright;
  const body = (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <Text style={[type.h3, { fontWeight: '500' }, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={(v) => {
            haptic.tap();
            onToggle?.(v);
          }}
          disabled={disabled}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (toggle ? colors.primaryBright : '#C8D1E0') : undefined}
          ios_backgroundColor={colors.borderStrong}
          accessibilityLabel={title}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {value ? <Text style={[type.bodySecondary, { marginRight: 6 }]}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
        </View>
      )}
    </View>
  );
  if (!onPress || disabled) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && { backgroundColor: colors.surfacePressed }}
    >
      {body}
    </Pressable>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────────

/** Props that keep typed text out of keyboard learning, autofill and spellcheck. */
export const privateInputProps: Partial<TextInputProps> = {
  autoCorrect: false,
  spellCheck: false,
  autoComplete: 'off',
  importantForAutofill: 'no',
  textContentType: 'none',
  contextMenuHidden: false,
  keyboardAppearance: 'dark',
};

export function TextField({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[type.overline, { marginBottom: spacing.sm }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        {...privateInputProps}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.danger, marginTop: 6 }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.caption, { marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ── Branding ─────────────────────────────────────────────────────────────────

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="shield-checkmark" size={size * 0.56} color="#03140D" />
    </LinearGradient>
  );
}

export function Logo({ size = 40, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Docsave">
      <LogoMark size={size} />
      <View style={{ marginLeft: spacing.md }}>
        <Text style={[type.h1, { fontSize: size * 0.55 }]}>
          Doc<Text style={{ color: colors.primaryBright }}>save</Text>
        </Text>
        {tagline ? <Text style={type.caption}>Your Documents. Your Device. Your Privacy.</Text> : null}
      </View>
    </View>
  );
}

// ── Motion ───────────────────────────────────────────────────────────────────

export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function PulseShield({ size = 96, tone = 'ok' }: { size?: number; tone?: 'ok' | 'warn' }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const c = tone === 'ok' ? colors.primary : colors.warning;
  return (
    <View style={{ width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 1.3,
          height: size * 1.3,
          borderRadius: size,
          borderWidth: 2,
          borderColor: c,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === 'ok' ? colors.primarySoft : colors.warningSoft,
          borderWidth: 1,
          borderColor: c + '66',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={tone === 'ok' ? 'shield-checkmark' : 'shield-half'} size={size * 0.5} color={c} />
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View style={[styles.rowIcon, { width: 64, height: 64, borderRadius: 20, marginBottom: spacing.lg }]}>
        <Ionicons name={icon} size={30} color={colors.primaryBright} />
      </View>
      <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }]}>{body}</Text>
      {action}
    </View>
  );
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 4,
            width: i + 1 === step ? 22 : 8,
            borderRadius: 2,
            marginRight: 5,
            backgroundColor: i + 1 <= step ? colors.primary : colors.borderStrong,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingBottom: 120 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 54,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    ...shadow,
  },
  buttonSecondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong, elevation: 0, shadowOpacity: 0 },
  buttonGhost: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardPressed: { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.99 }] },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  notice: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, minHeight: 60 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
});
