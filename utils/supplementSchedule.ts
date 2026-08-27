import type { JournalEntry } from '../declarations'

// Schedule types for supplement frequency
export type SupplementScheduleType =
  | 'daily'
  | 'twice_daily'
  | 'specific_days'
  | 'every_other_day'
  | 'none'

export interface SupplementSuggestion {
  name: string
  defaultDosage: string
  schedule?: SupplementScheduleType // default: 'none' (suggestion only, not tracked)
  scheduleDays?: number[] // for 'specific_days': [0=Sun, 1=Mon, ..., 6=Sat]
  scheduleStartDate?: string // for 'every_other_day': ISO date anchor (YYYY-MM-DD)
  scheduleActivatedDate?: string // ISO date (YYYY-MM-DD) when schedule was first activated
}

/**
 * Get the number of intakes required per day for a given schedule type.
 */
export function getRequiredIntakeCount(
  schedule?: SupplementScheduleType,
): number {
  return schedule === 'twice_daily' ? 2 : 1
}

/**
 * Get the local date key (YYYY-MM-DD) for a given Date object.
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Check if a supplement was taken on a specific date by looking through journal entries.
 */
function wasSupplementTakenOnDate(
  supplementName: string,
  date: Date,
  journalEntries: JournalEntry[],
): boolean {
  const dateKey = getLocalDateKey(date)
  const nameLower = supplementName.toLowerCase()

  return journalEntries.some((entry) => {
    if (!entry.date || typeof entry.date.toDate !== 'function') return false
    const entryDate = entry.date.toDate()
    if (getLocalDateKey(entryDate) !== dateKey) return false
    return (entry.supplements || []).some(
      (s) => s.name.toLowerCase() === nameLower,
    )
  })
}

/**
 * Count how many times a supplement was taken on a specific date across all journal entries.
 */
export function getSupplementIntakeCountOnDate(
  supplementName: string,
  date: Date,
  journalEntries: JournalEntry[],
): number {
  const dateKey = getLocalDateKey(date)
  const nameLower = supplementName.toLowerCase()
  let count = 0

  journalEntries.forEach((entry) => {
    if (!entry.date || typeof entry.date.toDate !== 'function') return
    const entryDate = entry.date.toDate()
    if (getLocalDateKey(entryDate) === dateKey && entry.supplements) {
      entry.supplements.forEach((s) => {
        if (s.name.toLowerCase() === nameLower) {
          count++
        }
      })
    }
  })

  return count
}

/**
 * Check if a single supplement is due on a given date based on its schedule.
 * For every_other_day: checks journal entries to see if it was taken yesterday.
 * If taken yesterday, it's not due today (and vice versa).
 */
export function isSupplementDueOnDate(
  supplement: SupplementSuggestion,
  date: Date,
  journalEntries?: JournalEntry[],
): boolean {
  const schedule = supplement.schedule ?? 'none'

  // If a schedule activation date exists, don't consider this supplement
  // as due on dates before it was activated
  if (schedule !== 'none' && supplement.scheduleActivatedDate) {
    const activatedKey = supplement.scheduleActivatedDate
    const dateKey = getLocalDateKey(date)
    if (dateKey < activatedKey) {
      return false
    }
  }

  switch (schedule) {
    case 'none':
      return false

    case 'daily':
    case 'twice_daily':
      return true

    case 'specific_days': {
      const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const days = supplement.scheduleDays ?? []
      return days.includes(dayOfWeek)
    }

    case 'every_other_day': {
      // If we have journal entries, use last-taken logic:
      // Due today only if NOT taken yesterday
      if (journalEntries && journalEntries.length > 0) {
        const yesterday = new Date(date)
        yesterday.setDate(yesterday.getDate() - 1)
        const takenYesterday = wasSupplementTakenOnDate(
          supplement.name,
          yesterday,
          journalEntries,
        )
        return !takenYesterday
      }

      // Fallback: use anchor date if no journal entries available
      const anchor = supplement.scheduleStartDate
      if (!anchor) return true // no history + no anchor = assume due

      const anchorDate = new Date(anchor + 'T00:00:00')
      if (isNaN(anchorDate.getTime())) return true

      const msPerDay = 24 * 60 * 60 * 1000
      const anchorMidnight = new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth(),
        anchorDate.getDate(),
      ).getTime()
      const targetMidnight = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime()

      const daysDiff = Math.round((targetMidnight - anchorMidnight) / msPerDay)
      return daysDiff >= 0 && daysDiff % 2 === 0
    }

    default:
      return false
  }
}

/**
 * Get all supplements that are due on the given date based on their schedules.
 */
export function getSupplementsDueToday(
  suggestions: SupplementSuggestion[],
  date: Date,
  journalEntries?: JournalEntry[],
): SupplementSuggestion[] {
  return suggestions.filter((supp) =>
    isSupplementDueOnDate(supp, date, journalEntries),
  )
}

/**
 * Extract all supplement names taken on a specific date from journal entries.
 */
export function getSupplementsTakenOnDate(
  journalEntries: JournalEntry[],
  date: Date,
): string[] {
  const dateKey = getLocalDateKey(date)
  const takenNames: Set<string> = new Set()

  journalEntries.forEach((entry) => {
    if (!entry.date || typeof entry.date.toDate !== 'function') return

    const entryDate = entry.date.toDate()
    const entryKey = getLocalDateKey(entryDate)

    if (entryKey === dateKey && entry.supplements) {
      entry.supplements.forEach((supp) => {
        takenNames.add(supp.name.toLowerCase())
      })
    }
  })

  return Array.from(takenNames)
}

/**
 * Get supplements that are due today but haven't been fully taken
 * (for twice_daily, taken < 2 times; for others, taken < 1 time).
 */
export function getUntakenSupplements(
  dueSupplements: SupplementSuggestion[],
  journalEntries: JournalEntry[],
  date: Date,
): SupplementSuggestion[] {
  return dueSupplements.filter((supp) => {
    const requiredCount = getRequiredIntakeCount(supp.schedule)
    const takenCount = getSupplementIntakeCountOnDate(
      supp.name,
      date,
      journalEntries,
    )
    return takenCount < requiredCount
  })
}

/**
 * Check if a journal entry exists for the given date.
 */
export function hasJournalEntryForDate(
  journalEntries: JournalEntry[],
  date: Date,
): boolean {
  const dateKey = getLocalDateKey(date)

  return journalEntries.some((entry) => {
    if (!entry.date || typeof entry.date.toDate !== 'function') return false
    const entryDate = entry.date.toDate()
    return getLocalDateKey(entryDate) === dateKey
  })
}

/**
 * Build a stable string that changes whenever anything the bedtime reminder
 * reads out of the journal changes: which entries exist for today, and which
 * supplements (and how many doses of each) were logged today or yesterday —
 * yesterday matters because every_other_day is decided from it.
 *
 * The reminder's text is baked in when the notification is *scheduled*, so it
 * has to be rescheduled on every such change. Toggling a supplement normally
 * updates the day's existing entry rather than adding one, which leaves
 * journalEntries.length untouched — a count is not enough to notice it.
 */
export function buildSupplementReminderSignature(
  journalEntries: JournalEntry[],
  date: Date,
): string {
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const relevantKeys = new Set([
    getLocalDateKey(date),
    getLocalDateKey(yesterday),
  ])

  const parts: string[] = []
  journalEntries.forEach((entry) => {
    if (!entry.date || typeof entry.date.toDate !== 'function') return
    const key = getLocalDateKey(entry.date.toDate())
    if (!relevantKeys.has(key)) return
    // Duplicates are kept, not deduped: twice_daily needs the dose count.
    const names = (entry.supplements || [])
      .map((s) => s.name.toLowerCase())
      .sort()
      .join(',')
    parts.push(`${key}#${entry.id}#${names}`)
  })

  return parts.sort().join('|')
}

/**
 * Build the bedtime reminder notification body.
 * Returns null if there's nothing to remind about.
 */
export function buildBedtimeReminderBody(
  suggestions: SupplementSuggestion[],
  journalEntries: JournalEntry[],
  date: Date,
): { title: string; body: string } | null {
  // journalEntries must be forwarded: without it every_other_day falls back to
  // the anchor-date algorithm, so the notification and the on-screen chips can
  // disagree about whether the same supplement is due today.
  const dueToday = getSupplementsDueToday(suggestions, date, journalEntries)
  const untaken = getUntakenSupplements(dueToday, journalEntries, date)
  const hasJournal = hasJournalEntryForDate(journalEntries, date)

  // Nothing to remind about
  if (untaken.length === 0 && hasJournal) {
    return null
  }

  const parts: string[] = []

  if (untaken.length > 0) {
    const names = untaken.map((s) => s.name).join(', ')
    parts.push(`💊 Missing: ${names}`)
  }

  if (!hasJournal) {
    parts.push("📓 Don't forget your journal entry!")
  }

  return {
    title: 'Evening Reminder 🌙',
    body: parts.join('\n'),
  }
}
