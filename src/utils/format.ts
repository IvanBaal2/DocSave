export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function toIsoDate(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseIsoDate(iso?: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function formatDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function daysUntil(iso?: string): number | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function autoLockLabel(seconds: number): string {
  if (seconds === 0) return 'Immediately';
  if (seconds < 60) return `After ${seconds} seconds`;
  return `After ${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
}

/** Document names without separator dashes (older names used "Type — Holder"). */
export function displayName(name: string): string {
  return name.replace(/\s+[—–-]\s+/g, ' ').trim();
}
