// Timezone helpers. All instants are stored as UTC timestamptz; the organizer
// types a wall-clock date+time that is interpreted in the platform timezone
// (admin setting, default Asia/Kolkata). No browser timezone is ever trusted.

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find(p => p.type === t)!.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-10-05" + "18:00" in `tz` -> UTC Date. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz); // second pass handles DST edges
  return new Date(utc);
}

export function formatInTz(iso: string | Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso));
}
export const fmtDate = (iso: string, tz: string) => formatInTz(iso, tz, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDay = (iso: string, tz: string) => formatInTz(iso, tz, { weekday: 'long' });
export const fmtTime = (iso: string, tz: string) => formatInTz(iso, tz, { hour: 'numeric', minute: '2-digit', hour12: true });
export const fmtDateTime = (iso: string, tz: string) => `${fmtDate(iso, tz)}, ${fmtTime(iso, tz)}`;

/** Day-of-week for a "YYYY-MM-DD" string, timezone independent. */
export function dayOfWeek(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function hhmm(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
export function ymd(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
