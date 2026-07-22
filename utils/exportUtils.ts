import { Clipboard as RNClipboard } from 'react-native'
import type {
  JournalEntry,
  WeightLog,
  CalorieLog,
  SupplementLog,
} from '../declarations'

export type ExportDateRangeOption = '1m' | '3m' | '6m' | 'custom'

export interface DateRangeBounds {
  startDate: Date
  endDate: Date
}

export interface FilteredExportData {
  journalEntries: JournalEntry[]
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
  supplements: { date: Date; supplement: SupplementLog }[]
}

/**
 * Safely converts various timestamp formats (Firestore Timestamp, Date, Serialized object, ISO string) into a JS Date.
 */
export const toJsDate = (date: unknown): Date | null => {
  if (!date) return null
  const d = date as Record<string, unknown>
  if (typeof d.toDate === 'function') {
    return (d.toDate as () => Date)()
  }
  if (date instanceof Date) {
    return date
  }
  if (typeof d.seconds === 'number') {
    return new Date(d.seconds * 1000)
  }
  const parsed = new Date(date as string | number)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Calculates start and end Date objects for a given range selection.
 */
export const getDateRangeBounds = (
  rangeOption: ExportDateRangeOption,
  customStartDate?: Date | null,
  customEndDate?: Date | null,
  now: Date = new Date(),
): DateRangeBounds => {
  const endDate = customEndDate ? new Date(customEndDate) : new Date(now)
  endDate.setHours(23, 59, 59, 999)

  let startDate: Date
  if (rangeOption === 'custom' && customStartDate) {
    startDate = new Date(customStartDate)
    startDate.setHours(0, 0, 0, 0)
  } else if (rangeOption === '1m') {
    startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 1)
    startDate.setHours(0, 0, 0, 0)
  } else if (rangeOption === '3m') {
    startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 3)
    startDate.setHours(0, 0, 0, 0)
  } else if (rangeOption === '6m') {
    startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 6)
    startDate.setHours(0, 0, 0, 0)
  } else {
    startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 1)
    startDate.setHours(0, 0, 0, 0)
  }

  return { startDate, endDate }
}

/**
 * Filters journal, weight, calorie, and supplement logs by date range bounds.
 */
export const filterLogsByDateRange = (
  journalEntries: JournalEntry[],
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
  bounds: DateRangeBounds,
): FilteredExportData => {
  const startTime = bounds.startDate.getTime()
  const endTime = bounds.endDate.getTime()

  const filteredJournal = (journalEntries || []).filter((item) => {
    const d = toJsDate(item.date)
    if (!d) return false
    const t = d.getTime()
    return t >= startTime && t <= endTime
  })

  const filteredWeight = (weightLogs || []).filter((item) => {
    const d = toJsDate(item.date)
    if (!d) return false
    const t = d.getTime()
    return t >= startTime && t <= endTime
  })

  const filteredCalories = (calorieLogs || []).filter((item) => {
    const d = toJsDate(item.date)
    if (!d) return false
    const t = d.getTime()
    return t >= startTime && t <= endTime
  })

  const extractedSupplements: { date: Date; supplement: SupplementLog }[] = []
  filteredJournal.forEach((entry) => {
    const d = toJsDate(entry.date)
    if (d && entry.supplements && entry.supplements.length > 0) {
      entry.supplements.forEach((supp) => {
        extractedSupplements.push({ date: d, supplement: supp })
      })
    }
  })

  return {
    journalEntries: filteredJournal,
    weightLogs: filteredWeight,
    calorieLogs: filteredCalories,
    supplements: extractedSupplements,
  }
}

/**
 * Formats filtered logs into a clean, human-readable structured text string for export.
 */
export const formatLogsForExport = (
  filteredData: FilteredExportData,
  bounds: DateRangeBounds,
): string => {
  const formatDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatTimeStr = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const rangeHeader = `Date Range: ${formatDateStr(bounds.startDate)} to ${formatDateStr(bounds.endDate)}`
  const lines: string[] = []

  lines.push('========================================')
  lines.push('         HEALTH & JOURNAL EXPORT        ')
  lines.push('========================================')
  lines.push(rangeHeader)
  lines.push(`Exported On: ${formatDateStr(new Date())}`)
  lines.push('')

  // 1. Weight Logs Section
  lines.push(`--- WEIGHT LOGS (${filteredData.weightLogs.length}) ---`)
  if (filteredData.weightLogs.length === 0) {
    lines.push('No weight logs recorded in this period.')
  } else {
    const sortedWeight = [...filteredData.weightLogs].sort((a, b) => {
      const da = toJsDate(a.date)?.getTime() ?? 0
      const db = toJsDate(b.date)?.getTime() ?? 0
      return db - da
    })
    sortedWeight.forEach((log) => {
      const d = toJsDate(log.date)
      const dateStr = d ? formatDateStr(d) : 'Unknown Date'
      lines.push(`• ${dateStr}: ${log.weight} kg`)
    })
  }
  lines.push('')

  // 2. Calorie Logs Section
  lines.push(`--- CALORIE LOGS (${filteredData.calorieLogs.length}) ---`)
  if (filteredData.calorieLogs.length === 0) {
    lines.push('No calorie logs recorded in this period.')
  } else {
    const sortedCalories = [...filteredData.calorieLogs].sort((a, b) => {
      const da = toJsDate(a.date)?.getTime() ?? 0
      const db = toJsDate(b.date)?.getTime() ?? 0
      return db - da
    })
    sortedCalories.forEach((log) => {
      const d = toJsDate(log.date)
      const dateStr = d ? formatDateStr(d) : 'Unknown Date'
      lines.push(`• ${dateStr}: ${log.calories} kcal`)
    })
  }
  lines.push('')

  // 3. Journal & Supplement Logs Section
  lines.push(
    `--- JOURNAL & SUPPLEMENT LOGS (${filteredData.journalEntries.length}) ---`,
  )
  if (filteredData.journalEntries.length === 0) {
    lines.push('No journal entries recorded in this period.')
  } else {
    const sortedJournal = [...filteredData.journalEntries].sort((a, b) => {
      const da = toJsDate(a.date)?.getTime() ?? 0
      const db = toJsDate(b.date)?.getTime() ?? 0
      return db - da
    })
    sortedJournal.forEach((entry) => {
      const d = toJsDate(entry.date)
      const dateStr = d
        ? `${formatDateStr(d)} ${formatTimeStr(d)}`
        : 'Unknown Date'
      lines.push(`• [${dateStr}] Note: ${entry.note}`)
      if (entry.supplements && entry.supplements.length > 0) {
        const suppList = entry.supplements
          .map((s) => (s.dosage ? `${s.name} (${s.dosage})` : s.name))
          .join(', ')
        lines.push(`  Supplements: ${suppList}`)
      }
    })
  }

  return lines.join('\n')
}

/**
 * Copies plain text to device clipboard. Safe on all native binaries and web.
 */
export const copyLogsToClipboard = async (text: string): Promise<boolean> => {
  try {
    // 1. Try expo-clipboard if native module is available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExpoClipboard = require('expo-clipboard')
      if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === 'function') {
        await ExpoClipboard.setStringAsync(text)
        return true
      }
    } catch {
      // Fallback silently if expo-clipboard native module is not linked in current binary
    }

    // 2. Fallback to React Native core Clipboard
    if (RNClipboard && typeof RNClipboard.setString === 'function') {
      RNClipboard.setString(text)
      return true
    }

    // 3. Fallback to Web navigator.clipboard
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text)
      return true
    }

    return false
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}
