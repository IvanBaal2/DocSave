/**
 * Translations: every language covers every source string, keeps the
 * {placeholders}, and switching language takes effect immediately (Arabic is
 * right-to-left).
 */
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ar from '../src/i18n/ar';
import de from '../src/i18n/de';
import es from '../src/i18n/es';
import fr from '../src/i18n/fr';
import it from '../src/i18n/it';
import pt from '../src/i18n/pt';
import { getLanguage, isRTL, LANGUAGES, setLanguage, t, tLabel } from '../src/i18n';
import { reminderText } from '../src/notifications/scheduler';
import { autoLockLabel } from '../src/utils/format';

const DICTS = { ar, de, es, fr, it, pt };
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('translations', () => {
  test('seven languages are offered', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'ar', 'es', 'fr', 'de', 'it', 'pt']);
  });

  test('every source string is translated in every language', () => {
    // scripts/i18n-check.mjs exits non-zero when any translation is missing
    const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'i18n-check.mjs')], { encoding: 'utf8' });
    for (const code of Object.keys(DICTS)) expect(out).toMatch(new RegExp(`${code}: (\\d+)/\\1 translated`));
  });

  test.each(Object.entries(DICTS))('%s keeps every {placeholder} and has no empty text', (_code, dict) => {
    for (const [en, tr] of Object.entries(dict)) {
      expect(tr.trim()).not.toBe('');
      expect(placeholders(tr)).toBe(placeholders(en));
    }
  });

  test.each(Object.entries(DICTS))('%s covers the same strings as Spanish', (_code, dict) => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(es).sort());
  });
});

describe('language switching', () => {
  afterEach(() => setLanguage('en'));

  test('falls back to English and fills placeholders', () => {
    setLanguage('en');
    expect(t('Settings')).toBe('Settings');
    expect(t('{n} days', { n: 7 })).toBe('7 days');
    expect(t('A string that has no translation')).toBe('A string that has no translation');
  });

  test('changes text immediately, including generated labels', () => {
    setLanguage('es');
    expect(getLanguage()).toBe('es');
    expect(t('Settings')).toBe('Ajustes');
    expect(t('{n} days', { n: 7 })).toBe('7 días');
    expect(tLabel('Page 3')).toBe('Página 3');
    expect(autoLockLabel(300)).toBe('Tras 5 minutos');
    expect(reminderText('identity', 1, 'category').body).toBe('Un documento de identidad caduca mañana.');
    setLanguage('de');
    expect(t('Lock now')).toBe('Jetzt sperren');
  });

  test('Arabic is right-to-left, the others are left-to-right', () => {
    expect(isRTL('ar')).toBe(true);
    for (const l of ['en', 'es', 'fr', 'de', 'it', 'pt'] as const) expect(isRTL(l)).toBe(false);
    setLanguage('ar');
    expect(isRTL()).toBe(true);
    expect(t('Settings')).toBe('الإعدادات');
  });
});
