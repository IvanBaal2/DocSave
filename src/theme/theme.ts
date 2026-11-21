import { Platform } from 'react-native';

const DARK = {
  bg: '#05080F',
  bgElevated: '#0A101D',
  surface: '#0E1626',
  surfaceAlt: '#132036',
  surfacePressed: '#18273F',
  border: '#1B2944',
  borderStrong: '#26385A',
  text: '#EAF0FA',
  textSecondary: '#9AA8C2',
  textMuted: '#62708C',
  primary: '#10B981',
  primaryBright: '#34D399',
  primaryDeep: '#047857',
  primarySoft: 'rgba(16,185,129,0.12)',
  primaryBorder: 'rgba(52,211,153,0.35)',
  danger: '#F05252',
  dangerSoft: 'rgba(240,82,82,0.12)',
  warning: '#F5B544',
  warningSoft: 'rgba(245,181,68,0.12)',
  info: '#60A5FA',
  overlay: 'rgba(3,6,12,0.85)',
};

export const colors = DARK;

export const gradients = {
  primary: ['#34D399', '#059669'] as const,
  hero: ['#0E1A2E', '#070B14'] as const,
  card: ['#111C30', '#0B1322'] as const,
  danger: ['#F87171', '#DC2626'] as const,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

const family = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const familyMedium = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

export const type = {
  display: { fontFamily: family, fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6, color: colors.text },
  h1: { fontFamily: family, fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4, color: colors.text },
  h2: { fontFamily: familyMedium, fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2, color: colors.text },
  h3: { fontFamily: familyMedium, fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontFamily: family, fontSize: 15, lineHeight: 22, color: colors.text },
  bodySecondary: { fontFamily: family, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  caption: { fontFamily: family, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  overline: {
    fontFamily: familyMedium,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: colors.textMuted,
  },
  button: { fontFamily: familyMedium, fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.1 },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 6 },
  default: {},
});
