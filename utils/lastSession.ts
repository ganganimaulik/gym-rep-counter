import type { WorkoutSet } from '../declarations'
import { getSetUnit, toLocalYMD, parseLocalYMD } from './analyticsUtils'

// The most recent day (before today) on which an exercise was logged, with that
// day's sets in set order. "Last time" deliberately excludes today: sets logged
// in the current session are already on screen in the set tracker, so the
// useful comparison is the previous session's numbers.
export interface LastSession {
  dateKey: string
  sets: WorkoutSet[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// History entries carry Firestore Timestamps, but migrated/queued entries have
// been seen with missing or malformed dates — skip those rather than throwing
// while rendering the workout screen.
const toDate = (set: WorkoutSet): Date | null => {
  const raw = set?.date
  if (!raw || typeof raw.toDate !== 'function') return null
  try {
    const date = raw.toDate()
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Pick the most recent session strictly before `todayKey` from a list of sets
 * for one exercise. Returns null when the exercise has no earlier history.
 */
export const selectLastSession = (
  sets: WorkoutSet[],
  todayKey: string,
): LastSession | null => {
  const byDay = new Map<string, WorkoutSet[]>()

  for (const set of sets ?? []) {
    const date = toDate(set)
    if (!date) continue
    const key = toLocalYMD(date)
    if (key >= todayKey) continue
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.push(set)
    } else {
      byDay.set(key, [set])
    }
  }

  if (byDay.size === 0) return null

  // YYYY-MM-DD sorts lexicographically the same as chronologically.
  const dateKey = [...byDay.keys()].sort().pop() as string
  const daySets = [...(byDay.get(dateKey) as WorkoutSet[])].sort(
    (a, b) => (a.set ?? 0) - (b.set ?? 0),
  )

  return { dateKey, sets: daySets }
}

/**
 * The set from that session to compare the upcoming set against: the same set
 * number when it exists, otherwise the closest earlier one (last session may
 * have been shorter), otherwise its first set.
 */
export const resolveSetForNumber = (
  session: LastSession,
  setNumber: number,
): WorkoutSet | null => {
  if (session.sets.length === 0) return null
  const exact = session.sets.find((s) => s.set === setNumber)
  if (exact) return exact
  const earlier = session.sets.filter((s) => (s.set ?? 0) < setNumber)
  return earlier.length > 0
    ? earlier[earlier.length - 1]
    : (session.sets[0] ?? null)
}

/** "60 kg" / "4 plates" / "1 plate". Empty when the set carried no weight. */
export const formatLoad = (set: WorkoutSet): string => {
  const weight = set?.weight
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return ''
  }
  const unit = getSetUnit(set)
  if (unit === 'plates') {
    return `${weight} ${weight === 1 ? 'plate' : 'plates'}`
  }
  return `${weight} kg`
}

/**
 * "60 kg × 10", or just "10 reps" for a bodyweight/unlogged-weight set.
 * Empty string when there is nothing meaningful to show.
 */
export const formatSetSummary = (set: WorkoutSet | null): string => {
  if (!set) return ''
  const reps = typeof set.reps === 'number' && set.reps > 0 ? set.reps : 0
  const load = formatLoad(set)
  if (load && reps) return `${load} × ${reps}`
  if (load) return load
  return reps ? `${reps} reps` : ''
}

/** Whether a logged set carries anything worth showing. */
export const hasSetData = (set: WorkoutSet): boolean => {
  const reps = typeof set?.reps === 'number' && set.reps > 0
  const weight =
    typeof set?.weight === 'number' &&
    Number.isFinite(set.weight) &&
    set.weight > 0
  return reps || weight
}

/** Compact "60×10" form for the per-set chips. */
export const formatSetChip = (set: WorkoutSet): string => {
  const reps = typeof set.reps === 'number' && set.reps > 0 ? set.reps : 0
  const weight =
    typeof set.weight === 'number' && Number.isFinite(set.weight)
      ? set.weight
      : 0
  if (weight > 0 && reps) return `${weight}×${reps}`
  if (weight > 0) return `${weight}`
  return reps ? `${reps} reps` : '—'
}

/** "Yesterday" / "3 days ago" / "Mar 4" once it's over a month old. */
export const describeRelativeDay = (
  dateKey: string,
  todayKey: string,
): string => {
  const then = parseLocalYMD(dateKey)
  const today = parseLocalYMD(todayKey)
  if (Number.isNaN(then.getTime()) || Number.isNaN(today.getTime())) return ''

  const days = Math.round((today.getTime() - then.getTime()) / MS_PER_DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 30) return `${days} days ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
