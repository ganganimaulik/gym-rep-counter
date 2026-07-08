import { Timestamp } from 'firebase-admin/firestore'

/**
 * Get the timezone offset in milliseconds for a given date and timezone.
 * Positive means timezone is ahead of UTC.
 */
export function getTimezoneOffset(dateStr: string, timezone: string): number {
  const date = new Date(`${dateStr}T12:00:00Z`)
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

/**
 * Get Firestore Timestamps for start and end of a day in user's timezone.
 */
export function getDayRange(
  dateStr: string,
  timezone: string,
): { start: Timestamp; end: Timestamp } {
  const offset = getTimezoneOffset(dateStr, timezone)
  const startUtc = new Date(`${dateStr}T00:00:00Z`)
  startUtc.setTime(startUtc.getTime() - offset)

  const [y, m, d] = dateStr.split('-').map(Number)
  const nextDay = new Date(y, m - 1, d + 1)
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
  const endOffset = getTimezoneOffset(nextDayStr, timezone)
  const endUtc = new Date(`${nextDayStr}T00:00:00Z`)
  endUtc.setTime(endUtc.getTime() - endOffset)

  return {
    start: Timestamp.fromDate(startUtc),
    end: Timestamp.fromDate(endUtc),
  }
}

/**
 * Get today's date string YYYY-MM-DD in the user's timezone.
 */
export function getTodayString(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * Get Firestore Timestamps for a date range (N days back from today).
 */
export function getDaysBackRange(
  daysBack: number,
  timezone: string,
): { start: Timestamp; end: Timestamp } {
  const todayStr = getTodayString(timezone)
  const [y, m, d] = todayStr.split('-').map(Number)
  const today = new Date(y, m - 1, d)

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - daysBack)
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  // End is start of tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const startOffset = getTimezoneOffset(startStr, timezone)
  const endOffset = getTimezoneOffset(tomorrowStr, timezone)

  const startUtc = new Date(`${startStr}T00:00:00Z`)
  startUtc.setTime(startUtc.getTime() - startOffset)

  const endUtc = new Date(`${tomorrowStr}T00:00:00Z`)
  endUtc.setTime(endUtc.getTime() - endOffset)

  return {
    start: Timestamp.fromDate(startUtc),
    end: Timestamp.fromDate(endUtc),
  }
}

/**
 * Get start of week (Monday) for a date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get week range Timestamps for a given week offset from current week.
 */
export function getWeekRange(
  weekOffset: number,
  timezone: string,
): { start: Timestamp; end: Timestamp; startDate: Date; endDate: Date } {
  const todayStr = getTodayString(timezone)
  const [y, m, d] = todayStr.split('-').map(Number)
  const today = new Date(y, m - 1, d)
  today.setDate(today.getDate() + weekOffset * 7)

  const weekStart = getWeekStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const startStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const endStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`

  const startOffset = getTimezoneOffset(startStr, timezone)
  const endOffset = getTimezoneOffset(endStr, timezone)

  const startUtc = new Date(`${startStr}T00:00:00Z`)
  startUtc.setTime(startUtc.getTime() - startOffset)

  const endUtc = new Date(`${endStr}T00:00:00Z`)
  endUtc.setTime(endUtc.getTime() - endOffset)

  return {
    start: Timestamp.fromDate(startUtc),
    end: Timestamp.fromDate(endUtc),
    startDate: weekStart,
    endDate: new Date(weekEnd.getTime() - 1),
  }
}

/**
 * Get a YYYY-MM-DD string from a Firestore Timestamp in a timezone.
 */
export function getDateStringFromTimestamp(
  ts: FirebaseFirestore.Timestamp | { _seconds: number; _nanoseconds: number },
  timezone: string,
): string {
  const date = toDate(ts)
  return date.toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * Convert any Firestore timestamp-like object to a Date.
 */
export function toDate(ts: unknown): Date {
  if (ts instanceof Date) return ts
  const tsObj = ts as Record<string, unknown>
  if (
    tsObj &&
    typeof (tsObj as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (tsObj as { toDate: () => Date }).toDate()
  }
  if (tsObj && (tsObj._seconds !== undefined || tsObj.seconds !== undefined)) {
    const seconds = (tsObj._seconds ?? tsObj.seconds) as number
    const nanos = (tsObj._nanoseconds ?? tsObj.nanoseconds ?? 0) as number
    return new Date(seconds * 1000 + nanos / 1000000)
  }
  return new Date(ts as string | number)
}
