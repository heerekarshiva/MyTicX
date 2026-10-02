import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a 24-hour "HH:mm" time string (the format used everywhere
 * internally — storage, show matching, price calc) as a 12-hour clock time
 * with an explicit AM/PM suffix for display, e.g. "19:30" -> "7:30 PM".
 * Falls back to the raw input if it isn't a valid "HH:mm" string.
 */
export function formatTime12h(time24: string | null | undefined): string {
  if (!time24) return '';
  const match = /^(\d{1,2}):(\d{2})$/.exec(time24.trim());
  if (!match) return time24;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  if (hours24 < 0 || hours24 > 23) return time24;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}
