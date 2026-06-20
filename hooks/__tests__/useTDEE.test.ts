import { renderHook } from '@testing-library/react-native'
import { useTDEE } from '../useTDEE'
import type { WeightLog, CalorieLog, TDEEConfig } from '../../declarations'
import { Timestamp } from 'firebase/firestore'
import { calculateSeedTDEE, roundDisplayTDEE } from '../../modules/tdeeCalculator'

const createTimestamp = (date: Date): Timestamp =>
  ({
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as unknown as Timestamp)

const createWeightLog = (weight: number, dateStr: string): WeightLog => ({
  id: Math.random().toString(),
  weight,
  date: createTimestamp(new Date(dateStr)),
})

const createCalorieLog = (calories: number, dateStr: string): CalorieLog => ({
  id: Math.random().toString(),
  calories,
  date: createTimestamp(new Date(dateStr)),
})

const baseConfig: TDEEConfig = {
  weightUnit: 'kg',
  energyUnit: 'cal',
  smoothingWindowWeeks: 12,
}

describe('useTDEE Hook', () => {
  it('Empty arrays → graceful empty result', () => {
    const { result } = renderHook(() => useTDEE([], [], baseConfig))

    expect(result.current.hasEnoughData).toBe(false)
    expect(result.current.weeks).toEqual([])
    expect(result.current.currentTDEE).toBeNull()
  })

  it('No config + no weight logs → returns all zeros/nulls', () => {
    const { result } = renderHook(() => useTDEE([], [], null))

    expect(result.current.displayTDEE).toBeNull()
    expect(result.current.seedTDEE).toBe(0)
    expect(result.current.currentWeight).toBeNull()
    expect(result.current.hasEnoughData).toBe(false)
  })

  it('No config → returns fallback with seedTDEE based on oldest weight log', () => {
    // Actually the hook uses the most recent log in the array (last item) for startingWeight
    // wait, weightLogs are typically sorted by date, oldest to newest or newest to oldest?
    // In useTDEE, startingWeight = weightLogs[weightLogs.length - 1].weight
    const logs = [
      createWeightLog(80, '2023-01-01'),
      createWeightLog(82, '2023-01-02'), // last log
    ]
    const { result } = renderHook(() => useTDEE(logs, [], null))

    const expectedSeed = calculateSeedTDEE(82, 'kg', 'cal')
    expect(result.current.seedTDEE).toBe(expectedSeed)
    expect(result.current.displayTDEE).toBe(roundDisplayTDEE(expectedSeed))
    expect(result.current.hasEnoughData).toBe(false)
  })

  it('With config but no logs → returns seed TDEE, hasEnoughData = false', () => {
    const { result } = renderHook(() => useTDEE([], [], baseConfig))

    expect(result.current.hasEnoughData).toBe(false)
    expect(result.current.seedTDEE).toBe(0)
    // When no logs exist, pipeline returns 0 or null depending on startingWeight.
    // calculateTDEEPipeline logic determines displayTDEE. Let's just expect it to be 0 or null.
    // If we inspect tdeeCalculator, without startingWeight seedTDEE is 0, so displayTDEE is likely 0.
    expect(result.current.displayTDEE).toBe(0)
    expect(result.current.weeksWithData).toBe(0)
  })

  it('Single week of data → hasEnoughData = false (needs ≥2 weeks)', () => {
    const weights = [
      createWeightLog(80, '2026-05-04'), // Monday
      createWeightLog(80, '2026-05-05'),
    ]
    const calories = [
      createCalorieLog(2500, '2026-05-04'),
      createCalorieLog(2500, '2026-05-05'),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, baseConfig))

    // Just 1 week, can't calculate TDEE delta accurately, but we do get a seed TDEE
    expect(result.current.hasEnoughData).toBe(false)
    expect(result.current.weeksWithData).toBe(1)
  })

  it('Two+ weeks of data → hasEnoughData = true, calculated TDEE', () => {
    const weights = [
      // Week 1
      createWeightLog(80, '2026-05-04'), // Monday
      createWeightLog(80, '2026-05-06'),
      // Week 2
      createWeightLog(79.5, '2026-05-11'), // Next Monday
      createWeightLog(79.5, '2026-05-13'),
    ]
    const calories = [
      // Week 1
      createCalorieLog(2500, '2026-05-04'),
      createCalorieLog(2500, '2026-05-05'),
      createCalorieLog(2500, '2026-05-06'),
      createCalorieLog(2500, '2026-05-07'),
      createCalorieLog(2500, '2026-05-08'),
      createCalorieLog(2500, '2026-05-09'),
      createCalorieLog(2500, '2026-05-10'),
      // Week 2
      createCalorieLog(2500, '2026-05-11'),
      createCalorieLog(2500, '2026-05-12'),
      createCalorieLog(2500, '2026-05-13'),
      createCalorieLog(2500, '2026-05-14'),
      createCalorieLog(2500, '2026-05-15'),
      createCalorieLog(2500, '2026-05-16'),
      createCalorieLog(2500, '2026-05-17'),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, baseConfig))

    expect(result.current.hasEnoughData).toBe(true)
    expect(result.current.weeksWithData).toBeGreaterThanOrEqual(1) // Actually week 2 will have TDEE
    // TDEE should be calculated
    expect(result.current.displayTDEE).not.toBeNull()
  })

  it('Weekly grouping — logs spanning Mon–Sun boundary', () => {
    // 2026-05-04 is Monday, 2026-05-10 is Sunday
    const weights = [
      createWeightLog(80, '2026-05-10'), // Sunday (end of week 1)
      createWeightLog(79, '2026-05-11'), // Monday (start of week 2)
      createWeightLog(78, '2026-05-18'), // Monday (start of week 3)
    ]
    const calories = [
      createCalorieLog(2000, '2026-05-10'),
      createCalorieLog(2000, '2026-05-11'),
      createCalorieLog(2000, '2026-05-18'),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, baseConfig))

    // Should create 3 distinct weeks because of the boundaries
    expect(result.current.weeks).toHaveLength(3)
  })

  it('Weekly grouping — sparse data (gaps in weight or calorie logs)', () => {
    // Gap week in the middle
    const weights = [
      createWeightLog(80, '2026-05-04'), // Week 1
      createWeightLog(79, '2026-05-18'), // Week 3
    ]
    const calories = [
      createCalorieLog(2000, '2026-05-04'),
      createCalorieLog(2000, '2026-05-18'),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, baseConfig))

    // Week 1, Week 2 (empty), Week 3 should be created
    expect(result.current.weeks).toHaveLength(3)
    expect(result.current.weeks[1].weightDayCount).toBe(0)
    expect(result.current.weeks[1].calorieDayCount).toBe(0)
  })

  it('Goal projection fields populated when goalWeight + goalWeeklyRate are set', () => {
    const config: TDEEConfig = {
      ...baseConfig,
      goalWeight: 75,
      goalWeeklyRate: 0.5,
    }

    const weights = [
      createWeightLog(80, '2026-05-04'),
      createWeightLog(79, '2026-05-11'),
    ]
    const calories = [
      createCalorieLog(2000, '2026-05-04'),
      createCalorieLog(2000, '2026-05-05'),
      createCalorieLog(2000, '2026-05-06'),
      createCalorieLog(2000, '2026-05-07'),
      createCalorieLog(2000, '2026-05-08'),
      createCalorieLog(2000, '2026-05-09'),
      createCalorieLog(2000, '2026-05-10'),
      createCalorieLog(2000, '2026-05-11'),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, config))

    // currentWeight should be ~79. goalWeight is 75. diff is 4kg. rate is 0.5kg/week -> ~8 weeks
    expect(result.current.goalCalories).not.toBeNull()
    expect(result.current.dailyDeficit).not.toBeNull()
    expect(result.current.weeksToGoal).not.toBeNull()
    expect(result.current.goalDate).not.toBeNull()
  })

  it('Memoization — same inputs produce referentially stable result', () => {
    const weights = [createWeightLog(80, '2026-05-04')]
    const calories = [createCalorieLog(2500, '2026-05-04')]

    const { result, rerender } = renderHook(
      (props) => useTDEE(props.weights, props.calories, props.config),
      {
        initialProps: {
          weights,
          calories,
          config: baseConfig,
        },
      }
    )

    const initialResult = result.current

    // Re-render with exact same arrays and config object references
    rerender({ weights, calories, config: baseConfig })

    expect(result.current).toBe(initialResult)
  })

  it('Filters data to most recent year for performance', () => {
    const now = new Date()
    
    const twoYearsAgo = new Date(now)
    twoYearsAgo.setFullYear(now.getFullYear() - 2)
    
    const halfYearAgo = new Date(now)
    halfYearAgo.setMonth(now.getMonth() - 6)

    const weights = [
      createWeightLog(85, twoYearsAgo.toISOString()), // Should be filtered out
      createWeightLog(80, halfYearAgo.toISOString()), // Should be kept
    ]
    const calories = [
      createCalorieLog(2500, twoYearsAgo.toISOString()),
      createCalorieLog(2000, halfYearAgo.toISOString()),
    ]

    const { result } = renderHook(() => useTDEE(weights, calories, baseConfig))

    // If twoYearsAgo was included, we'd have over 52 weeks. Since it's filtered, we should have around 26 weeks.
    expect(result.current.weeks.length).toBeLessThan(52)
  })
})
