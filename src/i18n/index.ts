/**
 * Centralised translations.
 *
 * Source strings are written in English directly in the code and wrapped in
 * t('…'). Each language file maps the English text to its translation; a
 * missing entry falls back to English, so the app never shows a blank label.
 * Placeholders use {name}: t('{count} documents', { count: 3 }).
 *
 * Components that show text call useI18n(), so the whole screen re-renders
 * immediately when the language changes. Arabic is laid out right-to-left via
 * the `direction` style on each screen root (instant, no restart).
 */
import { useSyncExternalStore } from 'react';
import { I18nManager } from 'react-native';
import { readPrefs, writePrefs } from '../prefs';
import ar from './ar';
import de from './de';
import es from './es';
import fr from './fr';
import it from './it';
import pt from './pt';

export type Lang = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'it' | 'pt';
export type Dict = Record<string, string>;

export const LANGUAGES: { code: Lang; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'ar', name: 'العربية', english: 'Arabic' },
  { code: 'es', name: 'Español', english: 'Spanish' },
  { code: 'fr', name: 'Français', english: 'French' },
  { code: 'de', name: 'Deutsch', english: 'German' },
  { code: 'it', name: 'Italiano', english: 'Italian' },
  { code: 'pt', name: 'Português', english: 'Portuguese' },
];

const DICTS: Record<Lang, Dict> = { en: {}, ar, es, fr, de, it, pt };
const RTL: ReadonlySet<Lang> = new Set(['ar']);

function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && x in DICTS;
}

function deviceLanguage(): Lang {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    const base = tag.split(/[-_]/)[0];
    return isLang(base) ? base : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = (() => {
  const saved = readPrefs().language;
  return isLang(saved) ? saved : deviceLanguage();
})();
const listeners = new Set<() => void>();

function syncNativeDirection(lang: Lang) {
  // Native widgets (system back gesture, text input caret) follow this after the next start;
  // our own layouts switch immediately through the `direction` style.
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== RTL.has(lang)) I18nManager.forceRTL(RTL.has(lang));
  } catch {
    // not critical
  }
}
syncNativeDirection(current);

export function getLanguage(): Lang {
  return current;
}

export function isRTL(lang: Lang = current): boolean {
  return RTL.has(lang);
}

export function setLanguage(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  writePrefs({ language: lang });
  syncNativeDirection(lang);
  listeners.forEach((l) => l());
}

export function t(text: string, params?: Record<string, string | number>): string {
  const out = DICTS[current][text] ?? text;
  if (!params) return out;
  return out.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Page and side labels stored with documents ("Front", "Page 3"). */
export function tLabel(label: string): string {
  const m = /^Page (\d+)$/.exec(label);
  return m ? t('Page {n}', { n: m[1] }) : t(label);
}

/** Locale tag for dates and numbers. */
export function locale(): string {
  return current === 'en' ? 'en-GB' : current;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  const rtl = RTL.has(lang);
  return {
    t,
    lang,
    rtl,
    setLanguage,
    direction: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    /** Forward-pointing chevron / arrow name for the current direction. */
    forward: (rtl ? 'chevron-back' : 'chevron-forward') as 'chevron-back' | 'chevron-forward',
    back: (rtl ? 'chevron-forward' : 'chevron-back') as 'chevron-back' | 'chevron-forward',
  };
}
