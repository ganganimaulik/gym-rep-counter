import {
  WeightLog,
  CalorieLog,
  JournalEntry,
  WorkoutSet,
} from '../declarations'

export interface SleepWindow {
  startHour: number // 0-23
  endHour: number // 0-23
  isDefault: boolean
}

// Safely extract milliseconds from any date/timestamp format
function getMillis(dateField: unknown): number | null {
  if (!dateField) return null

  if (typeof dateField === 'object') {
    const obj = dateField as Record<string, unknown>
    // 1. Check if it's a Firestore Timestamp with toMillis()
    if (typeof obj.toMillis === 'function') {
      return (obj.toMillis as () => number)()
    }

    // 2. Check if it's a Firestore Timestamp with toDate()
    if (typeof obj.toDate === 'function') {
      const toDateFn = obj.toDate as () => { getTime: () => number }
      return toDateFn().getTime()
    }

    // 3. Check if it's a serialized Timestamp object { seconds, nanoseconds }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000
    }

    // 4. Check if it's already a JS Date object
    if (dateField instanceof Date) {
      return dateField.getTime()
    }
  }

  // 5. Try parsing as date string/number
  const parsed = new Date(dateField as string | number | Date).getTime()
  if (!isNaN(parsed)) {
    return parsed
  }

  return null
}

export function detectSleepWindow(
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
  journalEntries: JournalEntry[],
  workoutHistory: WorkoutSet[],
): SleepWindow {
  const timestamps: number[] = []

  const addTime = (dateField: unknown) => {
    const ms = getMillis(dateField)
    if (ms !== null) {
      timestamps.push(ms)
    }
  }

  weightLogs.forEach((log) => addTime(log.date))
  calorieLogs.forEach((log) => addTime(log.date))
  journalEntries.forEach((entry) => addTime(entry.date))
  workoutHistory.forEach((set) => {
    addTime(set.date || set.startTime)
  })

  // If there are less than 5 timestamps, return default sleep window (23:00 to 07:00)
  if (timestamps.length < 5) {
    return { startHour: 23, endHour: 7, isDefault: true }
  }

  // Count activity in each of the 24 hours of the day
  const hourCounts = new Array(24).fill(0)
  timestamps.forEach((ms) => {
    const date = new Date(ms)
    const hour = date.getHours() // Local hour (0-23)
    hourCounts[hour]++
  })

  // We want to find a contiguous 8-hour sleep window that minimizes activity.
  // The sleep window starting at hour H contains hours: H, (H+1)%24, ..., (H+7)%24.
  // We want to minimize:
  //   score = (sum of logs in window * 1000) + distance_from_H_to_23
  // distance_from_H_to_23 = min(|H - 23|, 24 - |H - 23|)

  let bestStartHour = 23
  let minScore = Infinity

  for (let h = 0; h < 24; h++) {
    let windowLogs = 0
    for (let i = 0; i < 8; i++) {
      windowLogs += hourCounts[(h + i) % 24]
    }

    const distTo23 = Math.min(Math.abs(h - 23), 24 - Math.abs(h - 23))
    const score = windowLogs * 1000 + distTo23

    if (score < minScore) {
      minScore = score
      bestStartHour = h
    }
  }

  const endHour = (bestStartHour + 8) % 24

  return {
    startHour: bestStartHour,
    endHour,
    isDefault: false,
  }
}
