import { detectSleepWindow } from '../sleepDetection'
import { WeightLog, CalorieLog, JournalEntry, WorkoutSet } from '../../declarations'

// Helper to create a fake Firestore timestamp
const mockTimestamp = (hour: number, dayOffset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - dayOffset)
  date.setHours(hour, 0, 0, 0)
  return {
    toMillis: () => date.getTime(),
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as any
}

describe('detectSleepWindow', () => {
  it('should return default sleep hours (23 to 7) when there are less than 5 logs', () => {
    const weightLogs: WeightLog[] = []
    const calorieLogs: CalorieLog[] = [
      { id: '1', calories: 2000, date: mockTimestamp(12) },
    ]
    const journalEntries: JournalEntry[] = []
    const workoutHistory: WorkoutSet[] = []

    const result = detectSleepWindow(
      weightLogs,
      calorieLogs,
      journalEntries,
      workoutHistory
    )

    expect(result.startHour).toBe(23)
    expect(result.endHour).toBe(7)
    expect(result.isDefault).toBe(true)
  })

  it('should find the 8-hour window with the least activity', () => {
    // Let's simulate a user active during daytime:
    // Logging weight at 8 AM, workout at 10 AM, calories at 1 PM, 6 PM, 8 PM
    // This leaves a natural inactive window during the night.
    const weightLogs: WeightLog[] = [
      { id: 'w1', weight: 70, date: mockTimestamp(8, 1) },
      { id: 'w2', weight: 70.2, date: mockTimestamp(8, 2) },
    ]
    const calorieLogs: CalorieLog[] = [
      { id: 'c1', calories: 500, date: mockTimestamp(13, 1) },
      { id: 'c2', calories: 800, date: mockTimestamp(18, 1) },
      { id: 'c3', calories: 400, date: mockTimestamp(20, 1) },
    ]
    const journalEntries: JournalEntry[] = [
      { id: 'j1', note: 'Good day', date: mockTimestamp(21, 1) },
    ]
    const workoutHistory: WorkoutSet[] = [
      { id: 's1', workoutId: 'w', exerciseId: 'e', exerciseName: 'Pushup', reps: 10, weight: 0, set: 1, date: mockTimestamp(10, 1) },
    ]

    const result = detectSleepWindow(
      weightLogs,
      calorieLogs,
      journalEntries,
      workoutHistory
    )

    // With active times: 8, 10, 13, 18, 20, 21.
    // Inactive period should be around late night / early morning (e.g. starting at 22:00 or 23:00)
    // Let's verify it is not default and chooses a night window close to 23:00.
    expect(result.isDefault).toBe(false)
    
    // Check if the detected window avoids the active hours.
    // The active hours: [8, 10, 13, 18, 20, 21]
    // The window from 23 to 7 contains: 23, 0, 1, 2, 3, 4, 5, 6. None of these have logs!
    // So 23:00 should be the starting hour since it has 0 logs and is closest to 23 (distance = 0).
    expect(result.startHour).toBe(23)
    expect(result.endHour).toBe(7)
  })

  it('should shift sleep window if the user is active late at night', () => {
    // Suppose the user is a night owl:
    // Active at 1 AM, 2 AM, 3 AM, 4 AM, 5 AM (e.g. night worker or gamer).
    // They are sleeping during the day: e.g., 9 AM to 5 PM.
    // Logs at: 23:00, 01:00, 02:00, 03:00, 05:00.
    const weightLogs: WeightLog[] = [
      { id: 'w1', weight: 70, date: mockTimestamp(23, 1) },
      { id: 'w2', weight: 70.2, date: mockTimestamp(1, 1) },
      { id: 'w3', weight: 70.1, date: mockTimestamp(2, 1) },
      { id: 'w4', weight: 70.3, date: mockTimestamp(3, 1) },
      { id: 'w5', weight: 70.4, date: mockTimestamp(5, 1) },
    ]
    const calorieLogs: CalorieLog[] = []
    const journalEntries: JournalEntry[] = []
    const workoutHistory: WorkoutSet[] = []

    const result = detectSleepWindow(
      weightLogs,
      calorieLogs,
      journalEntries,
      workoutHistory
    )

    expect(result.isDefault).toBe(false)
    
    // The window starting at 9 AM (9 to 17 / 5 PM) has 0 logs.
    // Let's make sure the detected sleep window covers hours that don't have logs.
    // Specifically, let's verify that the active hours [23, 1, 2, 3, 5] are NOT in the sleep window.
    const sleepHours: number[] = []
    for (let i = 0; i < 8; i++) {
      sleepHours.push((result.startHour + i) % 24)
    }

    const activeHours = [23, 1, 2, 3, 5]
    activeHours.forEach(hour => {
      expect(sleepHours).not.toContain(hour)
    })
  })
})
