jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

import { planReminders, reminderText } from '../src/notifications/scheduler';
import { DEFAULT_SETTINGS, type DocumentRecord } from '../src/vault/types';
import { VIEWER_CSP, imageHtml, pdfHtml, textHtml } from '../src/viewer/viewerHtml';

const doc = (over: Partial<DocumentRecord>): DocumentRecord => ({
  id: 'd',
  name: 'Passport X1234567 John Smith',
  categoryId: 'identity',
  docType: 'passport',
  pages: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('notification privacy', () => {
  test('no notification text ever contains document data', () => {
    for (const detail of ['generic', 'category'] as const) {
      for (const kind of ['identity', 'travel', 'expiry'] as const) {
        for (const days of [0, 1, 7, 30, 180]) {
          const t = reminderText(kind, days, detail);
          const all = `${t.title} ${t.body}`;
          expect(all).not.toMatch(/X1234567|John|Smith|passport/i);
        }
      }
    }
  });

  test('generic mode reveals not even the category', () => {
    const t = reminderText('identity', 30, 'generic');
    expect(t.body).not.toMatch(/identity|travel|expire/i);
  });
});

describe('reminder planning', () => {
  const now = new Date(2026, 0, 1, 12);
  const s = { ...DEFAULT_SETTINGS, notificationsEnabled: true };

  test('identity documents get 180/30/7/0-day reminders', () => {
    const plan = planReminders([doc({ expiryDate: '2027-01-01' })], s, now);
    expect(plan.map((p) => p.days).sort((a, b) => a - b)).toEqual([0, 7, 30, 180]);
  });

  test('past dates and disabled types are skipped', () => {
    expect(planReminders([doc({ expiryDate: '2025-01-01' })], s, now)).toHaveLength(0);
    expect(planReminders([doc({ expiryDate: '2027-01-01' })], { ...s, identityReminders: false }, now)).toHaveLength(0);
  });

  test('travel documents remind 7 days and 1 day before', () => {
    const plan = planReminders([doc({ categoryId: 'travel', expiryDate: '2026-06-10' })], s, now);
    expect(plan.map((p) => p.days).sort()).toEqual([1, 7]);
  });

  test('never schedules more than the iOS limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => doc({ id: `d${i}`, expiryDate: '2027-06-01' }));
    expect(planReminders(many, s, now).length).toBeLessThanOrEqual(60);
  });
});

describe('secure viewer HTML', () => {
  test('CSP forbids all network access', () => {
    expect(VIEWER_CSP).toContain("default-src 'none'");
    expect(VIEWER_CSP).not.toMatch(/https?:|\*/);
    expect(VIEWER_CSP).toContain("connect-src data: blob:");
  });

  test('every viewer page carries the CSP and loads nothing remote', () => {
    for (const html of [imageHtml('AAAA', 'image/png'), textHtml('hello'), pdfHtml('AAAA', '"lib"', '"worker"')]) {
      expect(html).toContain('Content-Security-Policy');
      expect(html).not.toMatch(/(src|href)=["']https?:/);
    }
  });

  test('text content is HTML-escaped (no script injection)', () => {
    const html = textHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('image MIME type cannot break out of the data URL', () => {
    const html = imageHtml('AAAA', 'image/png"><script>x</script>');
    expect(html).not.toContain('<script>x</script>');
  });
});
