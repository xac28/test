export function userTimezone(): string {
  if (typeof window === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatLocalDate(isoUtc: string, locale: 'en' | 'tr'): string {
  const tz = userTimezone();
  const d = new Date(isoUtc);
  return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  });
}

export function formatLocalTime(isoUtc: string, locale: 'en' | 'tr'): string {
  const tz = userTimezone();
  const d = new Date(isoUtc);
  return d.toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}

export function dayKey(isoUtc: string): string {
  const tz = userTimezone();
  const d = new Date(isoUtc);
  // Generate a stable per-day key in user's timezone (YYYY-MM-DD)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const dy = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${dy}`;
}

export function groupSlotsByDay(slots: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const s of slots) {
    const key = dayKey(s);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  return grouped;
}
