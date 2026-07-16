import { useMemo } from 'react'
import type {
  WeightLog,
  CalorieLog,
  MeasurementLog,
  TDEEConfig,
} from '../declarations'
import {
  calculateTDEEPipeline,
  type WeekInput,
  type TDEEPipelineResult,
  type TDEEPipelineConfig,
  roundDisplayTDEE,
  calculateSeedTDEE,
  calculateBodyFatPercent,
} from '../modules/tdeeCalculator'

/**
 * Groups weight and calorie logs into weekly buckets (Mon–Sun)
 * matching the spreadsheet's dual-row layout.
 */
function groupLogsByWeek(
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
): WeekInput[] {
  if (weightLogs.length === 0 && calorieLogs.length === 0) return []

  // Find the earliest log date to determine start
  const allDates: Date[] = [
    ...weightLogs.map((l) => l.date.toDate()),
    ...calorieLogs.map((l) => l.date.toDate()),
  ]

  if (allDates.length === 0) return []

  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const latest = new Date(Math.max(...allDates.map((d) => d.getTime())))

  // Find the Monday of the earliest date's week
  const startMonday = new Date(earliest)
  const day = startMonday.getDay()
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // Shift to Monday: if Sunday (0), go back 6 days; otherwise go back (day-1) days
  const daysToMonday = day === 0 ? 6 : day - 1
  startMonday.setDate(startMonday.getDate() - daysToMonday)
  startMonday.setHours(0, 0, 0, 0)

  // Build a map for quick lookup: dateStr -> value
  const weightMap = new Map<string, number>()
  weightLogs.forEach((log) => {
    const d = log.date.toDate()
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    weightMap.set(key, log.weight)
  })

  const calorieMap = new Map<string, number>()
  calorieLogs.forEach((log) => {
    const d = log.date.toDate()
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    calorieMap.set(key, log.calories)
  })

  const weeks: WeekInput[] = []
  const currentMonday = new Date(startMonday)
  let hasStarted = false

  while (currentMonday <= latest) {
    const dailyWeights: (number | null)[] = []
    const dailyCalories: (number | null)[] = []

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(currentMonday)
      date.setDate(date.getDate() + dayOffset)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

      dailyWeights.push(weightMap.get(key) ?? null)
      dailyCalories.push(calorieMap.get(key) ?? null)
    }

    const hasWeightData = dailyWeights.some((v) => v !== null)
    const hasCalorieData = dailyCalories.some((v) => v !== null)

    if (hasWeightData || hasCalorieData) {
      hasStarted = true
    }

    if (hasStarted) {
      weeks.push({
        weekStart: new Date(currentMonday),
        dailyWeights,
        dailyCalories,
      })
    }

    currentMonday.setDate(currentMonday.getDate() + 7)
  }

  return weeks
}

export interface UseTDEEResult {
  /** Per-week TDEE data */
  weeks: TDEEPipelineResult['weeks']
  /** Latest smoothed TDEE (raw number) */
  currentTDEE: number | null
  /** Display-ready TDEE rounded to nearest 25 */
  displayTDEE: number | null
  /** Seed TDEE before enough data (weight × multiplier) */
  seedTDEE: number
  /** Latest weight rounded to 0.5 */
  currentWeight: number | null
  /** Total weight change from starting weight */
  totalWeightChange: number | null
  /** Goal daily calories */
  goalCalories: number | null
  /** Daily deficit/surplus */
  dailyDeficit: number | null
  /** Estimated weeks to reach goal */
  weeksToGoal: number | null
  /** Estimated date to reach goal */
  goalDate: Date | null
  /** Whether we have enough data for a meaningful TDEE */
  hasEnoughData: boolean
  /** Number of weeks with TDEE data */
  weeksWithData: number
  /** Body fat % from the latest measurement log (decimal, e.g. 0.15) */
  currentBodyFatPct: number | null
}

/**
 * Custom hook that computes adaptive TDEE from weight and calorie logs.
 * Implements the exact algorithm from the "TDEE variant with bf 3.06" spreadsheet.
 */
// Stable default so omitting the argument doesn't break useMemo
const NO_MEASUREMENT_LOGS: MeasurementLog[] = []

export function useTDEE(
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
  tdeeConfig: TDEEConfig | null,
  measurementLogs: MeasurementLog[] = NO_MEASUREMENT_LOGS,
): UseTDEEResult {
  return useMemo(() => {
    // Cap TDEE processing to 1 year of data for performance while preserving full history elsewhere
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoMillis = oneYearAgo.getTime()

    const recentWeightLogs = weightLogs.filter(
      (l) => l.date.toMillis() >= oneYearAgoMillis,
    )
    const recentCalorieLogs = calorieLogs.filter(
      (l) => l.date.toMillis() >= oneYearAgoMillis,
    )

    // Starting weight (F6): earliest logged weight within the processed window
    // (logs are ordered newest-first, so the earliest is the last element)
    const startingWeight =
      recentWeightLogs.length > 0
        ? recentWeightLogs[recentWeightLogs.length - 1].weight
        : null

    if (!tdeeConfig) {
      const fallbackSeed = startingWeight
        ? calculateSeedTDEE(startingWeight, 'kg', 'cal')
        : 0
      return {
        weeks: [],
        currentTDEE: null,
        displayTDEE: fallbackSeed ? roundDisplayTDEE(fallbackSeed) : null,
        seedTDEE: fallbackSeed,
        currentWeight: null,
        totalWeightChange: null,
        goalCalories: null,
        dailyDeficit: null,
        weeksToGoal: null,
        goalDate: null,
        hasEnoughData: false,
        weeksWithData: 0,
        currentBodyFatPct: null,
      }
    }

    // Group logs into weekly buckets
    let weekInputs = groupLogsByWeek(recentWeightLogs, recentCalorieLogs)

    // Attach body measurements to each week input so calculateTDEEPipeline can
    // compute a per-week body fat %, matching the spreadsheet's per-row
    // measurement columns (O/P/Q). Each week uses the latest measurement
    // logged within it; weeks without a measurement get no BF% — except when
    // no measurement logs exist at all, where the static config measurements
    // apply to every week (legacy behavior).
    if (measurementLogs.length > 0) {
      weekInputs = weekInputs.map((week) => {
        const weekEndExclusive = new Date(week.weekStart)
        weekEndExclusive.setDate(weekEndExclusive.getDate() + 7)
        // Logs are ordered newest-first, so find() returns the week's latest
        const logInWeek = measurementLogs.find((log) => {
          const d = log.date.toDate()
          return d >= week.weekStart && d < weekEndExclusive
        })
        return logInWeek
          ? {
              ...week,
              waist: logInWeek.waist,
              neck: logInWeek.neck,
              hip: logInWeek.hip,
            }
          : week
      })
    } else {
      weekInputs = weekInputs.map((week) => ({
        ...week,
        waist: tdeeConfig.waistValue,
        neck: tdeeConfig.neckValue,
        hip: tdeeConfig.hipValue,
      }))
    }

    // Build pipeline config
    const pipelineConfig: TDEEPipelineConfig = {
      startingWeight,
      weightUnit: tdeeConfig.weightUnit,
      energyUnit: tdeeConfig.energyUnit,
      smoothingWindowWeeks: tdeeConfig.smoothingWindowWeeks,
      goalWeight: tdeeConfig.goalWeight,
      goalWeeklyRate: tdeeConfig.goalWeeklyRate,
      gender: tdeeConfig.gender,
      height: tdeeConfig.heightValue,
      measurementUnit: tdeeConfig.measurementUnit,
    }

    // Run the pipeline
    const result = calculateTDEEPipeline(weekInputs, pipelineConfig)

    // Count weeks that have a calculated TDEE
    const weeksWithData = result.weeks.filter(
      (w) => w.displayTDEE !== null,
    ).length

    // Need at least 2 weeks of data for meaningful TDEE
    const hasEnoughData = weeksWithData >= 2

    // Current body fat % from the most recent measurement log (newest-first
    // ordering), falling back to the static config measurements
    let currentBodyFatPct: number | null = null
    if (
      tdeeConfig.gender &&
      tdeeConfig.heightValue &&
      tdeeConfig.measurementUnit
    ) {
      const latest = measurementLogs[0]
      const waist = latest?.waist ?? tdeeConfig.waistValue
      const neck = latest?.neck ?? tdeeConfig.neckValue
      const hip = latest?.hip ?? tdeeConfig.hipValue
      if (waist !== undefined && neck !== undefined) {
        currentBodyFatPct = calculateBodyFatPercent(
          tdeeConfig.gender,
          waist,
          neck,
          tdeeConfig.heightValue,
          tdeeConfig.measurementUnit,
          hip,
        )
      }
    }

    return {
      weeks: result.weeks,
      currentTDEE: result.currentTDEE,
      displayTDEE: result.displayTDEE,
      seedTDEE: result.seedTDEE,
      currentWeight: result.currentWeight,
      totalWeightChange: result.totalWeightChange,
      goalCalories: result.goalCalories,
      dailyDeficit: result.dailyDeficit,
      weeksToGoal: result.weeksToGoal,
      goalDate: result.goalDate,
      hasEnoughData,
      weeksWithData,
      currentBodyFatPct,
    }
  }, [weightLogs, calorieLogs, tdeeConfig, measurementLogs])
}
