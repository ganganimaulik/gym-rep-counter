import { toDate } from './date-utils';

/**
 * Format a Firestore Timestamp as "Thu, Jul 3, 2026"
 */
export function formatDate(
  ts: unknown,
  timezone: string
): string {
  const date = toDate(ts);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

/**
 * Format a short date like "Jul 3" or "Jul 3, 2026"
 */
export function formatShortDate(
  ts: unknown,
  timezone: string,
  includeYear = false
): string {
  const date = toDate(ts);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  };
  if (includeYear) opts.year = 'numeric';
  return date.toLocaleDateString('en-US', opts);
}

/**
 * Format time as "02:30 PM"
 */
export function formatTime(ts: unknown, timezone: string): string {
  const date = toDate(ts);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

/**
 * Format duration from milliseconds as "2m 15s" or "45s"
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Format weight with unit: "75.5 kg" or "166.4 lbs"
 */
export function formatWeight(value: number, unit: 'kg' | 'lb'): string {
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${formatted} ${unit === 'kg' ? 'kg' : 'lbs'}`;
}

/**
 * Format calories: "2,450 kcal" or "10,251 kJ"
 */
export function formatCalories(value: number, unit: 'cal' | 'kj'): string {
  return `${value.toLocaleString('en-US')} ${unit === 'cal' ? 'kcal' : 'kJ'}`;
}

/**
 * Format volume: "12,500"
 */
export function formatVolume(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Format a date range like "Jun 30 - Jul 6, 2026"
 */
export function formatDateRange(start: Date, end: Date, timezone: string): string {
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  return `${startStr} - ${endStr}`;
}
