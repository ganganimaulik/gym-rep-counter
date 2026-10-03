// Demo data for DemoPilot (demo builds only; see utils/demoMode.ts). A fresh browser gets ten
// weeks of training, body-weight, calorie and journal logs in the guest stores, ending
// yesterday, so the demo opens on a lived-in app with today's workout still to do.
//
// Every number comes from how many weeks or days ago it was logged, never from the calendar
// date, so a demo run on any day shows the same records, and the agent's playbooks can name
// them (Bench Press tops out at 82.5 kg, Back Squat at 110 kg). Which weekdays carry which
// routine does follow the calendar, as a real Push/Pull/Legs/Upper/Lower week would.
import { Timestamp } from 'firebase/firestore'
import { Platform } from 'react-native'
import type {
  CalorieLog,
  JournalEntry,
  SupplementLog,
  TDEEConfig,
  WeightLog,
  WorkoutSet,
} from '../declarations'
import type { Exercise, Settings, Workout } from '../hooks/useData'
import { SET_PREFERENCE_KEY, type SetPreference } from './exerciseSetPreference'
import type { SupplementSuggestion } from './supplementSchedule'
import { getLocalDateKey } from './supplementSchedule'

export interface DemoData {
  settings: Settings
  workouts: Workout[]
  history: WorkoutSet[]
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
  tdeeConfig: TDEEConfig
  journalEntries: JournalEntry[]
  /** The routine the workout screen opens on: today's, or the next training day's. */
  activeSession: { workoutId: string; exerciseIndex: number }
  setPreferences: Record<string, SetPreference>
}

/** Set once a browser is seeded, so a reload mid-demo keeps what the visitor did. */
export const DEMO_SEED_KEY = 'demoDataSeededAt'

const WEEKS_OF_TRAINING = 10
const DAYS_OF_BODY_LOGS = 84
const DAYS_OF_JOURNAL = 70
/** Weeks ago when work travel cut training to three days (it breaks the streak). */
const TRAVEL_WEEK = 7

interface DemoExercise {
  exercise: Exercise
  /** The working weight in the latest weeks: the exercise's record. */
  top: number
  /** Taken off the weight once per `period` weeks going back. */
  step: number
  period: number
}

const lift = (
  id: string,
  name: string,
  sets: number,
  reps: number,
  top: number,
  step: number,
  extra: Omit<Exercise, 'id' | 'name' | 'sets' | 'reps'> = {},
  period = 2,
): DemoExercise => ({
  exercise: { id: `demo-${id}`, name, sets, reps, ...extra },
  top,
  step,
  period,
})

const PROGRAM: { id: string; name: string; lifts: DemoExercise[] }[] = [
  {
    id: 'demo-push',
    name: 'Push',
    lifts: [
      lift('bench-press', 'Bench Press', 4, 8, 82.5, 2.5),
      lift('overhead-press', 'Overhead Press', 3, 10, 50, 2.5),
      lift('incline-db-press', 'Incline Dumbbell Press', 3, 10, 30, 2),
      lift('lateral-raise', 'Lateral Raise', 3, 15, 12, 1, {}, 3),
      lift('triceps-pushdown', 'Triceps Pushdown', 3, 12, 32.5, 2.5, {}, 3),
    ],
  },
  {
    id: 'demo-pull',
    name: 'Pull',
    lifts: [
      lift('lat-pulldown', 'Lat Pulldown', 4, 10, 70, 2.5),
      lift('chest-supported-row', 'Chest-Supported Row', 4, 10, 65, 2.5),
      lift('face-pull', 'Face Pull', 3, 15, 25, 2.5, {}, 3),
      lift('biceps-curl', 'Biceps Curl', 3, 12, 16, 1, {}, 3),
    ],
  },
  {
    id: 'demo-legs',
    name: 'Legs',
    lifts: [
      lift('back-squat', 'Back Squat', 4, 6, 110, 5, { restSeconds: 150 }),
      lift('romanian-deadlift', 'Romanian Deadlift', 3, 10, 100, 5),
      lift('leg-press', 'Leg Press', 3, 12, 8, 1, { weightUnit: 'plates' }, 4),
      lift(
        'calf-raise',
        'Calf Raise',
        4,
        15,
        60,
        5,
        { variants: ['Standing', 'Seated'] },
        3,
      ),
    ],
  },
  {
    id: 'demo-upper',
    name: 'Upper',
    lifts: [
      lift('incline-bench-press', 'Incline Bench Press', 3, 10, 70, 2.5),
      lift('seated-cable-row', 'Seated Cable Row', 3, 12, 65, 2.5),
      lift('arnold-press', 'Arnold Press', 3, 12, 20, 2, {}, 3),
      lift('hammer-curl', 'Hammer Curl', 3, 12, 18, 2, {}, 4),
      lift(
        'overhead-triceps-extension',
        'Overhead Triceps Extension',
        3,
        12,
        27.5,
        2.5,
        {},
        3,
      ),
    ],
  },
  {
    id: 'demo-lower',
    name: 'Lower',
    lifts: [
      lift('deadlift', 'Deadlift', 3, 5, 150, 5, {
        restSeconds: 180,
        eccentricSeconds: 3,
      }),
      lift('bulgarian-split-squat', 'Bulgarian Split Squat', 3, 10, 24, 2),
      lift('leg-curl', 'Leg Curl', 3, 12, 7, 1, { weightUnit: 'plates' }, 4),
      lift(
        'leg-extension',
        'Leg Extension',
        3,
        15,
        9,
        1,
        { weightUnit: 'plates' },
        4,
      ),
      lift('hip-thrust', 'Hip Thrust', 3, 10, 120, 5),
    ],
  },
]

/** Routine index per weekday (getDay(): 0 = Sunday); null is a rest day. */
const WEEK_PLAN: (number | null)[] = [null, 0, 1, 2, null, 3, 4]
/** When the session starts on a weekday: evenings, Saturday mornings. */
const SESSION_START: [number, number][] = [
  [18, 0],
  [18, 10],
  [18, 5],
  [18, 15],
  [18, 0],
  [17, 50],
  [10, 0],
]

const SETTINGS: Settings = {
  countdownSeconds: 5,
  restSeconds: 90,
  maxReps: 15,
  maxSets: 3,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  countdownAnnouncementThreshold: 15,
  volume: 1,
  statRemindersEnabled: true,
  statRemindersSleepStart: 23,
  statRemindersSleepEnd: 7,
}

const TRACKED_SUPPLEMENTS: Omit<
  SupplementSuggestion,
  'scheduleActivatedDate'
>[] = [
  { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
  { name: 'Vitamin D3', defaultDosage: '5000 IU', schedule: 'daily' },
  { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'twice_daily' },
  { name: 'Magnesium', defaultDosage: '400mg', schedule: 'daily' },
]

const OTHER_SUPPLEMENTS: SupplementSuggestion[] = [
  { name: 'Whey Protein', defaultDosage: '1 scoop' },
  { name: 'Caffeine', defaultDosage: '200mg' },
  { name: 'Pre-workout', defaultDosage: '1 scoop' },
  { name: 'Multivitamin', defaultDosage: '1 tab' },
  { name: 'Zinc', defaultDosage: '50mg' },
  { name: 'Ashwagandha', defaultDosage: '600mg' },
]

const MORNING_NOTES = [
  'Slept 7.5h, woke up before the alarm.',
  '',
  'A bit sore from yesterday, nothing bad.',
  'Slept 6h. Extra coffee.',
  '',
  'Good sleep, energy high.',
  'Woke up stiff, did 10 min of mobility.',
]

const TRAINING_NOTES = [
  'Hit every rep. Moving up next week.',
  'Felt slow on the first sets, better after the warm-up.',
  'Kept the 4-second lowering on every rep.',
  'Short on time, cut the rest a little.',
  'Last set was a grind but got it.',
  'Great pump today.',
]

const REST_DAY_NOTES = [
  'Rest day. Long walk, 9k steps.',
  'Rest day, stretched in the evening.',
  'Off day. Ate at maintenance.',
]

// ── Deterministic noise ─────────────────────────────────────────────────────

/** A number in [0, 1) that depends only on the key. */
function noise(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
  }
  // One mulberry32 step over the FNV-1a hash.
  let t = (hash + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

// ── Dates ───────────────────────────────────────────────────────────────────

/** Local midnight `days` before `now`'s day (DST-safe: built from the calendar). */
const dayStart = (now: Date, days: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

const at = (day: Date, hours: number, minutes: number, seconds = 0) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
    seconds,
  )

/** Whole weeks between `day`'s Monday-based week and the current one. */
const weeksAgo = (now: Date, day: Date) => {
  const monday = (date: Date) => {
    const offset = (date.getDay() + 6) % 7
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - offset,
    )
  }
  return Math.round(
    (monday(now).getTime() - monday(day).getTime()) / (7 * 86400000),
  )
}

// ── Builders ────────────────────────────────────────────────────────────────

function buildHistory(now: Date): WorkoutSet[] {
  const history: WorkoutSet[] = []
  const oldest = ((now.getDay() + 6) % 7) + 7 * (WEEKS_OF_TRAINING - 1)
  for (let days = oldest; days >= 1; days--) {
    const day = dayStart(now, days)
    const routineIndex = WEEK_PLAN[day.getDay()]
    if (routineIndex === null || routineIndex === undefined) continue
    const week = weeksAgo(now, day)
    // The travel week kept Push, Pull and Legs only.
    if (week === TRAVEL_WEEK && routineIndex > 2) continue
    const routine = PROGRAM[routineIndex]
    const [hours, minutes] = SESSION_START[day.getDay()]
    let clock = at(day, hours, minutes).getTime()
    for (const [liftIndex, demoLift] of routine.lifts.entries()) {
      const { exercise, top, step, period } = demoLift
      const weight = top - step * Math.floor(week / period)
      const concentric =
        exercise.concentricSeconds ?? SETTINGS.concentricSeconds
      const eccentric = exercise.eccentricSeconds ?? SETTINGS.eccentricSeconds
      const rest = exercise.restSeconds ?? SETTINGS.restSeconds
      // Standing and seated calf raises take turns week by week.
      const variants = exercise.variants
      const variant = variants ? variants[week % variants.length] : undefined
      for (let set = 1; set <= exercise.sets; set++) {
        const roll = noise(`${week}:${routineIndex}:${liftIndex}:${set}`)
        // The last set is where reps fall short; now and then an early set beats the target.
        let reps = exercise.reps
        if (set === exercise.sets) reps -= roll < 0.12 ? 2 : roll < 0.45 ? 1 : 0
        else if (roll > 0.93) reps += 1
        const startTime = clock + SETTINGS.countdownSeconds * 1000
        const endTime = startTime + reps * (concentric + eccentric) * 1000
        history.push({
          id: `demo-${getLocalDateKey(day)}-${exercise.id}-${set}`,
          workoutId: routine.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          reps,
          weight,
          weightUnit: exercise.weightUnit ?? 'kg',
          ...(variant ? { variant } : {}),
          set,
          startTime: Timestamp.fromMillis(startTime),
          date: Timestamp.fromMillis(endTime),
        })
        clock = endTime + rest * 1000
      }
      // Changing over to the next exercise.
      clock += 60_000
    }
  }
  return history
}

function buildBodyLogs(now: Date): {
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
} {
  const weightLogs: WeightLog[] = []
  const calorieLogs: CalorieLog[] = []
  for (let days = DAYS_OF_BODY_LOGS; days >= 1; days--) {
    const day = dayStart(now, days)
    const key = getLocalDateKey(day)
    // A slow cut: about a quarter of a kilo a week, with day-to-day water swings.
    if (noise(`weight-skip:${days}`) > 0.12) {
      const swing = (noise(`weight:${days}`) - 0.5) * 0.8
      weightLogs.push({
        id: `demo-weight-${key}`,
        weight: roundTo(81.8 + 0.034 * days + swing, 0.1),
        date: Timestamp.fromDate(at(day, 7, 20)),
      })
    }
    if (noise(`calories-skip:${days}`) > 0.1) {
      const swing = (noise(`calories:${days}`) - 0.5) * 400
      calorieLogs.push({
        id: `demo-calories-${key}`,
        calories: roundTo(2250 + swing, 10),
        date: Timestamp.fromDate(at(day, 21, 30)),
      })
    }
  }
  return { weightLogs, calorieLogs }
}

function buildJournal(now: Date): JournalEntry[] {
  const entries: JournalEntry[] = []
  const pick = <T>(list: T[], key: string) =>
    list[Math.floor(noise(key) * list.length)]
  for (let days = DAYS_OF_JOURNAL; days >= 1; days--) {
    const day = dayStart(now, days)
    const key = getLocalDateKey(day)
    const morning: SupplementLog[] = [
      { name: 'Creatine', dosage: '5g' },
      { name: 'Fish Oil', dosage: '1 cap' },
    ]
    if (noise(`vitamin-d:${days}`) > 0.08) {
      morning.splice(1, 0, { name: 'Vitamin D3', dosage: '5000 IU' })
    }
    entries.push({
      id: `demo-journal-${key}-am`,
      note: pick(MORNING_NOTES, `morning:${days}`),
      date: Timestamp.fromDate(at(day, 8, 15)),
      supplements: morning,
    })
    // Some evenings go unlogged: one fish oil short, and no magnesium.
    if (noise(`evening:${days}`) < 0.1) continue
    const routineIndex = WEEK_PLAN[day.getDay()]
    const trained =
      routineIndex !== null &&
      routineIndex !== undefined &&
      !(weeksAgo(now, day) === TRAVEL_WEEK && routineIndex > 2)
    entries.push({
      id: `demo-journal-${key}-pm`,
      note: trained
        ? `${PROGRAM[routineIndex].name} day. ${pick(TRAINING_NOTES, `training:${days}`)}`
        : pick(REST_DAY_NOTES, `rest:${days}`),
      date: Timestamp.fromDate(at(day, 22, 0)),
      supplements: [
        { name: 'Fish Oil', dosage: '1 cap' },
        { name: 'Magnesium', dosage: '400mg' },
      ],
    })
  }
  return entries
}

/** The demo user's whole account, as of `now`. */
export function buildDemoData(now: Date): DemoData {
  const workouts: Workout[] = PROGRAM.map(({ id, name, lifts }) => ({
    id,
    name,
    exercises: lifts.map(({ exercise }) => exercise),
  }))
  const history = buildHistory(now)
  const { weightLogs, calorieLogs } = buildBodyLogs(now)

  // Today's routine, or on a rest day the next one in the week.
  let todayRoutine: number | null = null
  for (let ahead = 0; todayRoutine === null; ahead++) {
    todayRoutine = WEEK_PLAN[(now.getDay() + ahead) % 7] ?? null
  }

  // The Set Complete modal starts from how each exercise was last logged.
  const setPreferences: Record<string, SetPreference> = {}
  for (const set of history) {
    setPreferences[set.exerciseId] = {
      ...(set.weightUnit ? { weightUnit: set.weightUnit } : {}),
      reps: set.reps,
      ...(set.variant ? { variant: set.variant } : {}),
    }
  }

  const activated = getLocalDateKey(dayStart(now, DAYS_OF_JOURNAL))
  return {
    settings: {
      ...SETTINGS,
      supplementSuggestions: [
        ...TRACKED_SUPPLEMENTS.map((supplement) => ({
          ...supplement,
          scheduleActivatedDate: activated,
        })),
        ...OTHER_SUPPLEMENTS,
      ],
    },
    workouts,
    history,
    weightLogs,
    calorieLogs,
    tdeeConfig: {
      weightUnit: 'kg',
      energyUnit: 'cal',
      smoothingWindowWeeks: 12,
      goalWeight: 80,
      goalWeeklyRate: 0.25,
    },
    journalEntries: buildJournal(now),
    activeSession: { workoutId: PROGRAM[todayRoutine].id, exerciseIndex: 0 },
    setPreferences,
  }
}

/**
 * The storage key for each piece: the guest stores useData reads (AsyncStorage is
 * localStorage on web), serialized the way the app writes them (Timestamp.toJSON).
 */
export function demoStorageEntries(data: DemoData): [string, string][] {
  return [
    ['repCounterSettings', JSON.stringify(data.settings)],
    ['workouts', JSON.stringify(data.workouts)],
    ['guestHistory', JSON.stringify(data.history)],
    ['guestWeightLogs', JSON.stringify(data.weightLogs)],
    ['guestCalorieLogs', JSON.stringify(data.calorieLogs)],
    ['guestTdeeConfig', JSON.stringify(data.tdeeConfig)],
    ['guestJournalEntries', JSON.stringify(data.journalEntries)],
    ['activeWorkoutSession', JSON.stringify(data.activeSession)],
    [SET_PREFERENCE_KEY, JSON.stringify(data.setPreferences)],
  ]
}

/**
 * Seeds a browser's storage once (DemoPilot opens every session in a fresh one). Returns
 * whether it wrote anything: a reload during a demo keeps the visitor's changes.
 */
export function seedDemoStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now: Date,
): boolean {
  if (storage.getItem(DEMO_SEED_KEY)) return false
  for (const [key, value] of demoStorageEntries(buildDemoData(now))) {
    storage.setItem(key, value)
  }
  storage.setItem(DEMO_SEED_KEY, now.toISOString())
  return true
}

/** Runs before the app mounts in a demo build (index.js): seeds this browser, names the tab. */
export function startDemo(now: Date = new Date()): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  seedDemoStorage(window.localStorage, now)
  document.title = 'Rep Counter'
}
