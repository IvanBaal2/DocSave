/**
 * Local, on-device reminders. Docsave never registers for remote push and has
 * no server, so no push token is ever created or sent anywhere.
 *
 * Privacy rule: notification text NEVER contains document names, numbers,
 * notes or any document content. At most (if the user opts in) the broad
 * category, e.g. "An identity document expires in 30 days".
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DocumentRecord, Settings } from '../vault/types';

const CHANNEL_ID = 'docsave-reminders';
const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending local notifications.
const REMINDER_HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Document reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
    enableVibrate: true,
  });
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return res.granted;
}

type Kind = 'identity' | 'travel' | 'expiry';

export function reminderText(kind: Kind, days: number, detail: Settings['notificationDetail']) {
  const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  if (detail === 'generic') {
    return {
      title: 'Docsave reminder',
      body: 'A document in your vault needs your attention. Open Docsave to review it.',
    };
  }
  switch (kind) {
    case 'identity':
      return { title: 'Docsave reminder', body: `An identity document expires ${when}.` };
    case 'travel':
      return { title: 'Docsave reminder', body: `You have a travel document dated ${when}.` };
    default:
      return { title: 'Docsave reminder', body: `A document expires ${when}.` };
  }
}

function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), REMINDER_HOUR, 0, 0);
}

type Planned = { date: Date; kind: Kind; days: number };

/** Pure planning step (unit-testable): which reminders to fire, and when. */
export function planReminders(docs: DocumentRecord[], s: Settings, now = new Date()): Planned[] {
  const out: Planned[] = [];
  for (const d of docs) {
    if (!d.expiryDate) continue;
    const target = parseDate(d.expiryDate);
    if (!target) continue;
    let kind: Kind;
    let offsets: number[];
    if (d.categoryId === 'identity') {
      if (!s.identityReminders) continue;
      kind = 'identity';
      // Many countries require 6 months of passport validity for entry.
      offsets = [180, s.reminderLeadDays, 7, 0];
    } else if (d.categoryId === 'travel') {
      if (!s.travelReminders) continue;
      kind = 'travel';
      offsets = [7, 1];
    } else {
      if (!s.expiryReminders) continue;
      kind = 'expiry';
      offsets = [s.reminderLeadDays, 0];
    }
    for (const days of Array.from(new Set(offsets))) {
      const date = new Date(target);
      date.setDate(date.getDate() - days);
      if (date.getTime() > now.getTime()) out.push({ date, kind, days });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleReminders(docs: DocumentRecord[], s: Settings): Promise<number> {
  await cancelAllReminders();
  if (!s.notificationsEnabled) return 0;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  await ensureChannel();
  const plan = planReminders(docs, s);
  for (const p of plan) {
    const content = reminderText(p.kind, p.days, s.notificationDetail);
    await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: true, data: {} },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.date,
        channelId: CHANNEL_ID,
      },
    });
  }
  return plan.length;
}

export async function sendTestNotification(s: Settings): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: reminderText('identity', 30, s.notificationDetail),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNEL_ID,
    },
  });
}
