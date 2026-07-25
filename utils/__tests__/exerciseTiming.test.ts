import {
  TIMING_FIELDS,
  describeTimingOverrides,
  hasTimingOverride,
  isValidTimingValue,
  parseTimingInput,
  resolveExerciseTiming,
} from '../exerciseTiming'
import type { Exercise, Settings } from '../../hooks/useData'

const settings: Settings = {
  countdownSeconds: 5,
  restSeconds: 60,
  maxReps: 15,
  maxSets: 3,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  countdownAnnouncementThreshold: 15,
  volume: 1,
}

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex1',
  name: 'Calf Raise',
  sets: 4,
  reps: 12,
  ...overrides,
})

describe('resolveExerciseTiming', () => {
  it('returns the same settings object when there is no exercise', () => {
    expect(resolveExerciseTiming(settings, undefined)).toBe(settings)
    expect(resolveExerciseTiming(settings, null)).toBe(settings)
  })

  it('returns the same settings object when the exercise overrides nothing', () => {
    expect(resolveExerciseTiming(settings, exercise())).toBe(settings)
  })

  it('applies each overridden field and leaves the rest alone', () => {
    const resolved = resolveExerciseTiming(
      settings,
      exercise({ countdownSeconds: 3, restSeconds: 90 }),
    )

    expect(resolved.countdownSeconds).toBe(3)
    expect(resolved.restSeconds).toBe(90)
    expect(resolved.concentricSeconds).toBe(settings.concentricSeconds)
    expect(resolved.eccentricSeconds).toBe(settings.eccentricSeconds)
    // Non-timing settings pass through untouched.
    expect(resolved.maxReps).toBe(settings.maxReps)
    expect(resolved.volume).toBe(settings.volume)
  })

  it('honors a zero override for get ready and rest', () => {
    const resolved = resolveExerciseTiming(
      settings,
      exercise({ countdownSeconds: 0, restSeconds: 0 }),
    )

    expect(resolved.countdownSeconds).toBe(0)
    expect(resolved.restSeconds).toBe(0)
  })

  it('ignores broken overrides rather than feeding them to the timer', () => {
    const resolved = resolveExerciseTiming(
      settings,
      exercise({
        countdownSeconds: NaN,
        restSeconds: -5,
        // A zero rep phase would spin the timer, so it is out of range.
        concentricSeconds: 0,
        eccentricSeconds: 10_000,
      }),
    )

    expect(resolved).toBe(settings)
  })

  it('does not mutate the settings it was given', () => {
    const original = { ...settings }
    resolveExerciseTiming(settings, exercise({ restSeconds: 120 }))
    expect(settings).toEqual(original)
  })
})

describe('isValidTimingValue', () => {
  it('accepts in-range numbers and rejects everything else', () => {
    expect(isValidTimingValue('restSeconds', 90)).toBe(true)
    expect(isValidTimingValue('restSeconds', 0)).toBe(true)
    expect(isValidTimingValue('restSeconds', 601)).toBe(false)
    expect(isValidTimingValue('concentricSeconds', 0)).toBe(false)
    expect(isValidTimingValue('concentricSeconds', 1.5)).toBe(true)
    expect(isValidTimingValue('countdownSeconds', undefined)).toBe(false)
    expect(isValidTimingValue('countdownSeconds', '5')).toBe(false)
    expect(isValidTimingValue('countdownSeconds', Infinity)).toBe(false)
  })
})

describe('parseTimingInput', () => {
  it('treats blank input as "no override"', () => {
    expect(parseTimingInput('restSeconds', '')).toBeUndefined()
    expect(parseTimingInput('restSeconds', '   ')).toBeUndefined()
    expect(parseTimingInput('restSeconds', 'abc')).toBeUndefined()
  })

  it('rounds the whole-second fields and keeps fractions on the rep phases', () => {
    expect(parseTimingInput('restSeconds', '90.6')).toBe(91)
    expect(parseTimingInput('countdownSeconds', '3')).toBe(3)
    expect(parseTimingInput('eccentricSeconds', '2.5')).toBe(2.5)
  })

  it('clamps out-of-range input to the field bounds', () => {
    expect(parseTimingInput('restSeconds', '99999')).toBe(600)
    expect(parseTimingInput('restSeconds', '-10')).toBe(0)
    expect(parseTimingInput('concentricSeconds', '0')).toBe(0.1)
  })

  it('round-trips every field', () => {
    for (const field of TIMING_FIELDS) {
      const parsed = parseTimingInput(field, '2')
      expect(parsed).toBeDefined()
      expect(isValidTimingValue(field, parsed)).toBe(true)
    }
  })
})

describe('hasTimingOverride / describeTimingOverrides', () => {
  it('reports nothing for an exercise following the globals', () => {
    expect(hasTimingOverride(exercise())).toBe(false)
    expect(describeTimingOverrides(exercise())).toBe('')
  })

  it('summarizes overrides in field order', () => {
    const ex = exercise({ restSeconds: 90, countdownSeconds: 3 })
    expect(hasTimingOverride(ex)).toBe(true)
    expect(describeTimingOverrides(ex)).toBe('Ready 3s · Rest 90s')
  })

  it('skips invalid values in the summary', () => {
    expect(describeTimingOverrides(exercise({ restSeconds: -1 }))).toBe('')
  })
})
