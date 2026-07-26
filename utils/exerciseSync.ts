import type { Exercise, Workout } from '../hooks/useData'
import { TIMING_FIELDS } from './exerciseTiming'

// Fields that describe the *movement* rather than the routine slot it sits in.
// Two exercises sharing a name are the same movement — a leg curl doesn't grow
// a different set of variants or a different tempo because it appears on Day 3
// as well as Day 1 — so these stay in sync across routines. Sets, reps and
// weight unit are deliberately excluded: those are per-routine programming.
export const SHARED_EXERCISE_FIELDS = ['variants', ...TIMING_FIELDS] as const

export type SharedExerciseField = (typeof SHARED_EXERCISE_FIELDS)[number]

export type SharedExerciseFields = Pick<Exercise, SharedExerciseField>

/** Exercises are matched on a trimmed, case-insensitive name. */
export const exerciseNameKey = (name: string): string =>
  name.trim().toLowerCase()

/**
 * The shared fields actually present on an exercise. Absent fields are omitted
 * rather than set to undefined — workouts are written to Firestore as-is and a
 * single undefined rejects the whole user-doc write.
 */
export const getSharedExerciseFields = (
  exercise: Exercise,
): SharedExerciseFields => {
  const shared: SharedExerciseFields = {}
  if (exercise.variants !== undefined) shared.variants = exercise.variants
  for (const field of TIMING_FIELDS) {
    const value = exercise[field]
    if (value !== undefined) shared[field] = value
  }
  return shared
}

const sameVariants = (a?: string[], b?: string[]): boolean => {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((variant, i) => variant === b[i])
}

/** Whether the exercise already carries exactly these shared fields. */
export const hasSharedExerciseFields = (
  exercise: Exercise,
  shared: SharedExerciseFields,
): boolean =>
  sameVariants(exercise.variants, shared.variants) &&
  TIMING_FIELDS.every((field) => exercise[field] === shared[field])

/**
 * A copy of the exercise carrying these shared fields, with any the source
 * doesn't have deleted (not set to undefined — see getSharedExerciseFields).
 */
export const applySharedExerciseFields = (
  exercise: Exercise,
  shared: SharedExerciseFields,
): Exercise => {
  const updated: Exercise = { ...exercise }
  if (shared.variants === undefined) {
    delete updated.variants
  } else {
    updated.variants = shared.variants
  }
  for (const field of TIMING_FIELDS) {
    const value = shared[field]
    if (value === undefined) {
      delete updated[field]
    } else {
      updated[field] = value
    }
  }
  return updated
}

/**
 * Push `source`'s variants and timing onto every other exercise with the same
 * name, in this and every other routine. The original array (and the original
 * workout/exercise objects) come back untouched where nothing changed, so
 * memoized rows don't re-render for a routine the edit never reached.
 */
export const syncSharedExerciseFields = (
  workouts: Workout[],
  source: Exercise,
): Workout[] => {
  const key = exerciseNameKey(source.name)
  if (!key) return workouts

  const shared = getSharedExerciseFields(source)
  let anyChanged = false

  const synced = workouts.map((workout) => {
    let changed = false
    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id === source.id) return exercise
      if (exerciseNameKey(exercise.name) !== key) return exercise
      if (hasSharedExerciseFields(exercise, shared)) return exercise
      changed = true
      return applySharedExerciseFields(exercise, shared)
    })
    if (!changed) return workout
    anyChanged = true
    return { ...workout, exercises }
  })

  return anyChanged ? synced : workouts
}

/**
 * Variants and timing of an existing exercise with this name, so an exercise
 * added under a name already in use starts in sync instead of silently
 * breaking the invariant. Undefined when the name is new — or when no twin
 * overrides anything, which amounts to the same thing.
 *
 * Takes the first twin that carries any, rather than the first twin outright:
 * routines saved before names were kept in sync can disagree, and inheriting
 * the configured one beats inheriting whichever happens to come first.
 */
export const findSharedExerciseFields = (
  workouts: Workout[],
  name: string,
): SharedExerciseFields | undefined => {
  const key = exerciseNameKey(name)
  if (!key) return undefined
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (exerciseNameKey(exercise.name) !== key) continue
      const shared = getSharedExerciseFields(exercise)
      if (Object.keys(shared).length > 0) return shared
    }
  }
  return undefined
}

/**
 * Names of the routines that would be updated alongside this edit — every
 * routine holding an exercise of the same name, excluding the one being
 * edited. Used to warn before variants/timing propagate.
 */
export const routinesSharingExercise = (
  workouts: Workout[],
  name: string,
  excludeExerciseId?: string,
): string[] => {
  const key = exerciseNameKey(name)
  if (!key) return []
  const names: string[] = []
  for (const workout of workouts) {
    const shares = workout.exercises.some(
      (exercise) =>
        exercise.id !== excludeExerciseId &&
        exerciseNameKey(exercise.name) === key,
    )
    if (shares && !names.includes(workout.name)) names.push(workout.name)
  }
  return names
}
