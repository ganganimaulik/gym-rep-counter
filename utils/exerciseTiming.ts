import type { Exercise, Settings } from '../hooks/useData'

// Per-exercise timing overrides. Each entry names a Settings field of the same
// name; an exercise that omits the key follows the global value, so a routine
// only stores the durations that actually differ (calf raises don't need the
// same rest — or the same "get ready" — as squats).
export const TIMING_FIELDS = [
  'countdownSeconds',
  'restSeconds',
  'concentricSeconds',
  'eccentricSeconds',
] as const

export type TimingField = (typeof TIMING_FIELDS)[number]

interface TimingFieldSpec {
  label: string
  // Short label for the "overrides" summary in the routine list.
  shortLabel: string
  // "Get ready" and rest may legitimately be 0 — skipping the phase is a real
  // preference — but a 0-second rep phase would spin the timer, so the two rep
  // phases get a floor.
  min: number
  max: number
  // Whole seconds for the phases the user hears counted down; the rep phases
  // accept fractions, matching the global inputs in Settings.
  integer: boolean
}

export const TIMING_FIELD_SPECS: Record<TimingField, TimingFieldSpec> = {
  countdownSeconds: {
    label: 'Get Ready (s)',
    shortLabel: 'Ready',
    min: 0,
    max: 60,
    integer: true,
  },
  restSeconds: {
    label: 'Rest (s)',
    shortLabel: 'Rest',
    min: 0,
    max: 600,
    integer: true,
  },
  concentricSeconds: {
    label: 'Concentric (s)',
    shortLabel: 'Conc',
    min: 0.1,
    max: 60,
    integer: false,
  },
  eccentricSeconds: {
    label: 'Eccentric (s)',
    shortLabel: 'Ecc',
    min: 0.1,
    max: 60,
    integer: false,
  },
}

// An override only counts if it is a finite number inside the field's range.
// Anything else (NaN from a bad edit, a negative, a legacy value) falls back to
// the global setting rather than feeding a broken duration into the timer.
export const isValidTimingValue = (
  field: TimingField,
  value: unknown,
): value is number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  const { min, max } = TIMING_FIELD_SPECS[field]
  return value >= min && value <= max
}

/**
 * Global settings with this exercise's timing overrides applied. Returns the
 * settings object unchanged when nothing is overridden, so callers can memoize
 * on the result without re-deriving on every render.
 */
export const resolveExerciseTiming = (
  settings: Settings,
  exercise?: Exercise | null,
): Settings => {
  if (!exercise) return settings
  let merged: Settings | null = null
  for (const field of TIMING_FIELDS) {
    const override = exercise[field]
    if (isValidTimingValue(field, override) && override !== settings[field]) {
      merged = merged ?? { ...settings }
      merged[field] = override
    }
  }
  return merged ?? settings
}

/**
 * Parse a text input into a storable override, clamped to the field's range.
 * Blank (or unparseable) means "use the global value", which callers record by
 * deleting the key — workouts are written to Firestore as-is and Firestore
 * rejects undefined, so an omitted key is the only safe way to say "no
 * override".
 */
export const parseTimingInput = (
  field: TimingField,
  text: string,
): number | undefined => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return undefined
  const spec = TIMING_FIELD_SPECS[field]
  const clamped = Math.min(spec.max, Math.max(spec.min, parsed))
  const value = spec.integer ? Math.round(clamped) : clamped
  return isValidTimingValue(field, value) ? value : undefined
}

/** Whether the exercise overrides any timing field. */
export const hasTimingOverride = (exercise: Exercise): boolean =>
  TIMING_FIELDS.some((field) => isValidTimingValue(field, exercise[field]))

/**
 * Compact summary of an exercise's overrides for the routine list, e.g.
 * "Ready 3s · Rest 90s". Empty string when the exercise follows the globals.
 */
export const describeTimingOverrides = (exercise: Exercise): string =>
  TIMING_FIELDS.filter((field) => isValidTimingValue(field, exercise[field]))
    .map(
      (field) => `${TIMING_FIELD_SPECS[field].shortLabel} ${exercise[field]}s`,
    )
    .join(' · ')
