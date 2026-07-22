import { useMemo } from 'react'
import type { WeightLog, CalorieLog, TDEEConfig } from '../declarations'
import {
  calculateTDEEPipeline,
  type WeekInput,
  type TDEEPipelineResult,
  type TDEEPipelineConfig,
  roundDisplayTDEE,
  calculateSeedTDEE,
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
}

/**
 * Custom hook that computes adaptive TDEE from weight and calorie logs.
 * Implements the exact algorithm from the "TDEE variant with bf 3.06" spreadsheet.
 */
export function useTDEE(
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
  tdeeConfig: TDEEConfig | null,
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
      }
    }

    // Group logs into weekly buckets
    const weekInputs = groupLogsByWeek(recentWeightLogs, recentCalorieLogs)

    // Build pipeline config
    const pipelineConfig: TDEEPipelineConfig = {
      startingWeight,
      weightUnit: tdeeConfig.weightUnit,
      energyUnit: tdeeConfig.energyUnit,
      smoothingWindowWeeks: tdeeConfig.smoothingWindowWeeks,
      goalWeight: tdeeConfig.goalWeight ?? undefined,
      goalWeeklyRate: tdeeConfig.goalWeeklyRate ?? undefined,
    }

    // Run the pipeline
    const result = calculateTDEEPipeline(weekInputs, pipelineConfig)

    // Count weeks that have a calculated TDEE
    const weeksWithData = result.weeks.filter(
      (w) => w.displayTDEE !== null,
    ).length

    // Need at least 2 weeks of data for meaningful TDEE
    const hasEnoughData = weeksWithData >= 2

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
    }
  }, [weightLogs, calorieLogs, tdeeConfig])
}
