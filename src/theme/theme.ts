import { Platform } from 'react-native';

/**
 * "Passport wallet": passport-cover navy ground; documents appear as light
 * paper cards; green = protected / verified, amber = expiring.
 */
const NAVY = {
  bg: '#0C1A30',
  bgElevated: '#102240',
  surface: '#12243F',
  surfaceAlt: '#15284A',
  surfacePressed: '#1B3156',
  border: '#1C3156',
  borderStrong: '#2A426B',
  text: '#E8EEF6',
  textSecondary: '#C7D2E2',
  textMuted: '#93A4BE',
  primary: '#2FB38A',
  primaryBright: '#5CD3AC',
  primaryDeep: '#1E8A68',
  primarySoft: 'rgba(47,179,138,0.14)',
  primaryBorder: 'rgba(92,211,172,0.40)',
  onPrimary: '#062419',
  danger: '#F07F75',
  dangerSoft: 'rgba(240,127,117,0.12)',
  warning: '#E0A33A',
  warningSoft: 'rgba(224,163,58,0.14)',
  info: '#7FB2F0',
  overlay: 'rgba(6,14,28,0.88)',
  /** Document "paper" cards and the ink printed on them. */
  paper: '#EDF1F6',
  paperInk: '#1D2C44',
  paperMuted: '#5A6B85',
  paperWarn: '#8A5A12',
  passport: '#6E2034',
  passportInk: '#F3E7D6',
  passportGold: '#E7C9A0',
};

export const colors = NAVY;

export const gradients = {
  primary: ['#3CC096', '#2FB38A'] as const,
  hero: ['#12284A', '#0C1A30'] as const,
  card: ['#15284A', '#12243F'] as const,
  danger: ['#F28A80', '#D9584D'] as const,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Bundled font families (loaded in app/_layout.tsx). Android needs one family per weight. */
export const fonts = {
  regular: 'SchibstedGrotesk-Regular',
  medium: 'SchibstedGrotesk-Medium',
  semibold: 'SchibstedGrotesk-SemiBold',
  bold: 'SchibstedGrotesk-Bold',
  /** Only for real document data: numbers and passport code lines. */
  mono: 'IBMPlexMono-Regular',
};

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.6, color: colors.text },
  h1: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.4, color: colors.text },
  h2: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.2, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodySecondary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  /** Small section label, sentence case. */
  overline: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  button: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 0.1 },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 6 },
  default: {},
});
