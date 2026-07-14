import type { JournalEntry } from '../declarations'

// Schedule types for supplement frequency
export type SupplementScheduleType =
  | 'daily'
  | 'specific_days'
  | 'every_other_day'
  | 'none'

export interface SupplementSuggestion {
  name: string
  defaultDosage: string
  schedule?: SupplementScheduleType // default: 'none' (suggestion only, not tracked)
  scheduleDays?: number[] // for 'specific_days': [0=Sun, 1=Mon, ..., 6=Sat]
  scheduleStartDate?: string // for 'every_other_day': ISO date anchor (YYYY-MM-DD)
}

/**
 * Get the local date key (YYYY-MM-DD) for a given Date object.
 */
function getLocalDateKey(date: Date): string {
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

  switch (schedule) {
    case 'none':
      return false

    case 'daily':
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
 * Get supplements that are due today but haven't been taken
 * (not found in any journal entry for that date).
 */
export function getUntakenSupplements(
  dueSupplements: SupplementSuggestion[],
  journalEntries: JournalEntry[],
  date: Date,
): SupplementSuggestion[] {
  const takenNames = getSupplementsTakenOnDate(journalEntries, date)

  return dueSupplements.filter(
    (supp) => !takenNames.includes(supp.name.toLowerCase()),
  )
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
 * Build the bedtime reminder notification body.
 * Returns null if there's nothing to remind about.
 */
export function buildBedtimeReminderBody(
  suggestions: SupplementSuggestion[],
  journalEntries: JournalEntry[],
  date: Date,
): { title: string; body: string } | null {
  const dueToday = getSupplementsDueToday(suggestions, date)
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
