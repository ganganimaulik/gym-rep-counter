import { act, renderHook } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildDemoData,
  DEMO_SEED_KEY,
  demoStorageEntries,
  seedDemoStorage,
} from '../demoData'
import { calculatePRs, calculateStreak } from '../analyticsUtils'
import { loadSetPreferences } from '../exerciseSetPreference'
import { getLocalDateKey } from '../supplementSchedule'
import { useData } from '../../hooks/useData'
import { useTDEE } from '../../hooks/useTDEE'

// jest.setup.js stubs firebase/firestore, and the real module doesn't load under Jest: a Timestamp
// with the real one's shape (seconds, nanoseconds, and the same JSON) stands in.
jest.mock('firebase/firestore', () => {
  class Timestamp {
    seconds: number
    nanoseconds: number
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }
    static fromMillis(ms: number) {
      return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6)
    }
    static fromDate(date: Date) {
      return Timestamp.fromMillis(date.getTime())
    }
    toMillis() {
      return this.seconds * 1000 + this.nanoseconds / 1e6
    }
    toDate() {
      return new Date(this.toMillis())
    }
    toJSON() {
      return {
        type: 'firestore/timestamp/1.0',
        seconds: this.seconds,
        nanoseconds: this.nanoseconds,
      }
    }
  }
  return { Timestamp }
})

// A Saturday afternoon. DemoPilot runs the demo on any day; the weekday tests walk a week.
const NOW = new Date(2026, 9, 3, 14, 30)
const startOfToday = new Date(2026, 9, 3)
const day = (offset: number) => new Date(2026, 9, 3 + offset, 14, 30)

describe('buildDemoData', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('is the same data for the same moment', () => {
    expect(JSON.stringify(buildDemoData(NOW))).toBe(
      JSON.stringify(buildDemoData(NOW)),
    )
  })

  it('covers the past weeks up to yesterday, leaving today to the demo', () => {
    const data = buildDemoData(NOW)
    const dates = [
      ...data.history.map((s) => s.date),
      ...data.weightLogs.map((l) => l.date),
      ...data.calorieLogs.map((l) => l.date),
      ...data.journalEntries.map((e) => e.date),
    ].map((t) => t.toMillis())
    expect(Math.max(...dates)).toBeLessThan(startOfToday.getTime())
    // Ten training weeks: back to the Monday nine weeks before this one.
    const oldestSet = Math.min(...data.history.map((s) => s.date.toMillis()))
    expect(getLocalDateKey(new Date(oldestSet))).toBe('2026-07-27')
    expect(getLocalDateKey(data.history.at(-1)!.date.toDate())).toBe(
      '2026-10-02',
    )
  })

  it('logs every set against its routine, unit and variants', () => {
    const { workouts, history } = buildDemoData(NOW)
    const exercises = new Map(
      workouts.flatMap((w) => w.exercises.map((e) => [e.id, { e, w }])),
    )
    expect(new Set(exercises.keys()).size).toBe(exercises.size)
    for (const set of history) {
      const found = exercises.get(set.exerciseId)
      expect(found).toBeDefined()
      const { e, w } = found!
      expect(set.workoutId).toBe(w.id)
      expect(set.exerciseName).toBe(e.name)
      expect(set.weightUnit).toBe(e.weightUnit ?? 'kg')
      if (set.variant !== undefined) expect(e.variants).toContain(set.variant)
      expect(set.set).toBeGreaterThanOrEqual(1)
      expect(set.set).toBeLessThanOrEqual(e.sets)
      expect(set.reps).toBeGreaterThanOrEqual(e.reps - 2)
      expect(set.date.toMillis()).toBeGreaterThan(set.startTime!.toMillis())
    }
    // Firestore rejects undefined, and the routines are written to it as-is on sign-in.
    for (const exercise of workouts.flatMap((w) => w.exercises)) {
      expect(Object.values(exercise)).not.toContain(undefined)
    }
  })

  it('shows a streak and the same records whatever the weekday', () => {
    for (let offset = 0; offset < 7; offset++) {
      jest.useFakeTimers({ now: day(offset) })
      const { history } = buildDemoData(day(offset))
      const streak = calculateStreak(history, 5)
      expect(streak.currentStreak).toBeGreaterThanOrEqual(6)
      expect(streak.longestStreak).toBe(streak.currentStreak)

      const records = Object.fromEntries(
        calculatePRs(history).map((pr) => [
          pr.exerciseName,
          `${pr.maxWeight} ${pr.weightUnit}`,
        ]),
      )
      expect(records).toMatchObject({
        'Bench Press': '82.5 kg',
        'Back Squat': '110 kg',
        Deadlift: '150 kg',
        'Leg Press': '8 plates',
      })
    }
  })

  it('opens on the day’s routine, or the next one on a rest day', () => {
    const routineOn = (date: Date) => {
      const data = buildDemoData(date)
      return data.workouts.find((w) => w.id === data.activeSession.workoutId)
        ?.name
    }
    expect(routineOn(NOW)).toBe('Lower') // Saturday
    expect(routineOn(new Date(2026, 9, 4, 10))).toBe('Push') // Sunday → Monday's
    expect(routineOn(new Date(2026, 9, 1, 10))).toBe('Upper') // Thursday → Friday's
  })

  it('logs enough weight and calories for a TDEE and a goal', () => {
    jest.useFakeTimers({ now: NOW })
    const { weightLogs, calorieLogs, tdeeConfig } = buildDemoData(NOW)
    // Newest first, as useData's readers hand them to the TDEE screen.
    const newestFirst = <T extends { date: { toMillis(): number } }>(
      logs: T[],
    ) => [...logs].sort((a, b) => b.date.toMillis() - a.date.toMillis())
    const { result } = renderHook(() =>
      useTDEE(newestFirst(weightLogs), newestFirst(calorieLogs), tdeeConfig),
    )
    expect(result.current.hasEnoughData).toBe(true)
    expect(result.current.displayTDEE).toBeGreaterThan(2200)
    expect(result.current.displayTDEE).toBeLessThan(2700)
    // A slow cut toward the 80 kg goal.
    expect(result.current.totalWeightChange).toBeLessThan(0)
    expect(result.current.goalCalories).not.toBeNull()
    expect(result.current.weeksToGoal).toBeGreaterThan(0)
  })
})

describe('demoStorageEntries', () => {
  it('writes the stores useData reads, serialized like the app writes them', () => {
    const entries = Object.fromEntries(demoStorageEntries(buildDemoData(NOW)))
    expect(Object.keys(entries).sort()).toEqual([
      'activeWorkoutSession',
      'guestCalorieLogs',
      'guestHistory',
      'guestJournalEntries',
      'guestTdeeConfig',
      'guestWeightLogs',
      'lastSetPreferenceByExercise',
      'repCounterSettings',
      'workouts',
    ])
    // The guest readers revive {seconds, nanoseconds} into Timestamps.
    const [set] = JSON.parse(entries.guestHistory)
    expect(set.date).toMatchObject({
      seconds: expect.any(Number),
      nanoseconds: 0,
    })
  })
})

describe('seedDemoStorage', () => {
  it('seeds a browser once, so a reload keeps what the visitor did', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }
    expect(seedDemoStorage(storage, NOW)).toBe(true)
    expect(values.get(DEMO_SEED_KEY)).toBe(NOW.toISOString())
    expect(JSON.parse(values.get('guestHistory')!).length).toBeGreaterThan(400)

    values.set('guestHistory', '[]')
    expect(seedDemoStorage(storage, NOW)).toBe(false)
    expect(values.get('guestHistory')).toBe('[]')
  })

  it('loads through the guest stores the app reads', async () => {
    const data = buildDemoData(new Date())
    await AsyncStorage.clear()
    for (const [key, value] of demoStorageEntries(data)) {
      await AsyncStorage.setItem(key, value)
    }
    const { result } = renderHook(() => useData())
    await act(async () => {
      expect(await result.current.loadWorkouts()).toEqual(data.workouts)
      const settings = await result.current.loadSettings()
      expect(settings.restSeconds).toBe(90)
      expect(settings.supplementSuggestions?.[0]).toMatchObject({
        name: 'Creatine',
        schedule: 'daily',
      })
      const history = await result.current.fetchFullHistory(null, 90)
      expect(history).toHaveLength(data.history.length)
      const deadlifts = await result.current.fetchRecentExerciseSets(
        null,
        'demo-deadlift',
      )
      expect(deadlifts[0].weight).toBe(150)
      expect(await result.current.fetchWeightLogs(null)).toHaveLength(
        data.weightLogs.length,
      )
      expect(await result.current.fetchCalorieLogs(null)).toHaveLength(
        data.calorieLogs.length,
      )
      expect(await result.current.fetchJournalEntries(null)).toHaveLength(
        data.journalEntries.length,
      )
      expect(await result.current.loadTDEEConfig(null)).toEqual(data.tdeeConfig)
      expect(await result.current.loadActiveSession()).toEqual(
        data.activeSession,
      )
    })
    expect(await loadSetPreferences()).toEqual(data.setPreferences)
  })
})
