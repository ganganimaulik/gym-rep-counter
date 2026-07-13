/**
 * TDEE Adapter — Server-side wrapper around the shared TDEE calculator module.
 *
 * Core calculation logic lives in ../../modules/tdeeCalculator (shared with the app).
 * This adapter adds server-specific helpers for Firestore data conversion and
 * the high-level analyzeTDEE() pipeline function.
 */

import { Timestamp } from 'firebase/firestore'
import {
  calculateSeedTDEE,
  roundDisplayTDEE,
  calculateTDEEPipeline,
  type WeekInput,
  type TDEEPipelineConfig,
  type WeightUnit,
  type EnergyUnit,
} from '../../modules/tdeeCalculator'

// Re-export everything from the shared module so consumers only need this one import
export * from '../../modules/tdeeCalculator'

// ---------------------------------------------------------------------------
// Server-side types (Firestore Admin SDK specific)
// ---------------------------------------------------------------------------

/**
 * Represents a raw Firestore timestamp as it appears in document data.
 * Firestore timestamps serialize as { _seconds, _nanoseconds } in the
 * firebase-admin SDK's DocumentData.
 */
interface FirestoreTimestampData {
  _seconds: number
  _nanoseconds: number
}

/** Raw weight log document data from Firestore */
export interface RawWeightLog {
  id?: string
  weight: number
  date: Timestamp | FirestoreTimestampData
}

/** Raw calorie log document data from Firestore */
export interface RawCalorieLog {
  id?: string
  calories: number
  date: Timestamp | FirestoreTimestampData
}

/** TDEE config as stored in Firestore */
export interface TDEEConfigData {
  weightUnit: WeightUnit
  energyUnit: EnergyUnit
  smoothingWindowWeeks?: number
  goalWeight?: number
  goalWeeklyRate?: number
  gender?: 'male' | 'female'
  heightValue?: number
  measurementUnit?: 'inch' | 'cm'
  waistValue?: number
  neckValue?: number
  hipValue?: number
}

/** Result format for the MCP tool response */
export interface TDEEAnalysisResult {
  displayTDEE: number | null
  currentTDEE: number | null
  seedTDEE: number
  currentWeight: number | null
  totalWeightChange: number | null
  hasEnoughData: boolean
  weeksWithData: number
  weekUnit: WeightUnit
  energyUnit: EnergyUnit
  // Goal projection
  goalCalories: number | null
  dailyDeficit: number | null
  weeksToGoal: number | null
  goalDate: string | null
  // Weekly breakdown (recent weeks only)
  recentWeeks: {
    weekStart: string
    weekEnd: string
    avgWeight: number | null
    avgCalories: number | null
    weightDelta: number | null
    displayTDEE: number | null
    bodyFatPct: number | null
    weightDayCount: number
    calorieDayCount: number
  }[]
}

// ---------------------------------------------------------------------------
// Server-side helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Firestore timestamp (Timestamp instance or raw {_seconds, _nanoseconds})
 * to a JavaScript Date.
 */
function toDate(ts: Timestamp | FirestoreTimestampData): Date {
  if (ts instanceof Timestamp) {
    return ts.toDate()
  }
  // Raw serialized format: { _seconds, _nanoseconds }
  return new Date(ts._seconds * 1000 + ts._nanoseconds / 1_000_000)
}

/**
 * Converts a Firestore timestamp to milliseconds since epoch.
 */
function toMillis(ts: Timestamp | FirestoreTimestampData): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis()
  }
  return ts._seconds * 1000 + Math.floor(ts._nanoseconds / 1_000_000)
}

/**
 * Groups weight and calorie logs into weekly buckets (Mon–Sun).
 * This is a server-side adapter that converts Firestore timestamps to Dates
 * before feeding into the shared TDEE pipeline.
 */
function groupLogsByWeek(
  weightLogs: RawWeightLog[],
  calorieLogs: RawCalorieLog[],
): WeekInput[] {
  if (weightLogs.length === 0 && calorieLogs.length === 0) return []

  // Find the earliest log date to determine start
  const allDates: Date[] = [
    ...weightLogs.map((l) => toDate(l.date)),
    ...calorieLogs.map((l) => toDate(l.date)),
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
    const d = toDate(log.date)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    weightMap.set(key, log.weight)
  })

  const calorieMap = new Map<string, number>()
  calorieLogs.forEach((log) => {
    const d = toDate(log.date)
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

/**
 * High-level helper that takes raw Firestore weight and calorie logs,
 * groups them into weekly buckets, runs the TDEE pipeline, and returns
 * a structured result ready for the MCP tool response.
 *
 * @param weightLogs - Raw weight log documents from Firestore
 * @param calorieLogs - Raw calorie log documents from Firestore
 * @param tdeeConfig - TDEE configuration (from user settings or defaults)
 * @returns TDEEAnalysisResult ready for MCP tool consumption
 */
export function analyzeTDEE(
  weightLogs: RawWeightLog[],
  calorieLogs: RawCalorieLog[],
  tdeeConfig: TDEEConfigData | null,
): TDEEAnalysisResult {
  // Cap TDEE processing to 1 year of data for performance
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoMillis = oneYearAgo.getTime()

  const recentWeightLogs = weightLogs.filter(
    (l) => toMillis(l.date) >= oneYearAgoMillis,
  )
  const recentCalorieLogs = calorieLogs.filter(
    (l) => toMillis(l.date) >= oneYearAgoMillis,
  )

  // Starting weight (F6): earliest logged weight within the processed window
  // Weight logs are expected newest-first from Firestore orderBy('date', 'desc')
  const startingWeight =
    recentWeightLogs.length > 0
      ? recentWeightLogs[recentWeightLogs.length - 1].weight
      : null

  const weightUnit: WeightUnit = tdeeConfig?.weightUnit ?? 'kg'
  const energyUnit: EnergyUnit = tdeeConfig?.energyUnit ?? 'cal'

  if (!tdeeConfig) {
    const fallbackSeed = startingWeight
      ? calculateSeedTDEE(startingWeight, 'kg', 'cal')
      : 0
    return {
      displayTDEE: fallbackSeed ? roundDisplayTDEE(fallbackSeed) : null,
      currentTDEE: null,
      seedTDEE: fallbackSeed,
      currentWeight: null,
      totalWeightChange: null,
      hasEnoughData: false,
      weeksWithData: 0,
      weekUnit: 'kg',
      energyUnit: 'cal',
      goalCalories: null,
      dailyDeficit: null,
      weeksToGoal: null,
      goalDate: null,
      recentWeeks: [],
    }
  }

  // Group logs into weekly buckets
  let weekInputs = groupLogsByWeek(recentWeightLogs, recentCalorieLogs)

  // Attach body fat measurements to each week input
  weekInputs = weekInputs.map((week) => ({
    ...week,
    waist: tdeeConfig.waistValue,
    neck: tdeeConfig.neckValue,
    hip: tdeeConfig.hipValue,
  }))

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

  // Return recent weeks (last 12) for the response
  const recentWeeks = result.weeks.slice(-12).map((w) => ({
    weekStart: w.weekStart.toISOString().split('T')[0],
    weekEnd: w.weekEnd.toISOString().split('T')[0],
    avgWeight:
      w.avgWeight !== null ? Math.round(w.avgWeight * 100) / 100 : null,
    avgCalories: w.avgCalories !== null ? Math.round(w.avgCalories) : null,
    weightDelta:
      w.weightDelta !== null ? Math.round(w.weightDelta * 100) / 100 : null,
    displayTDEE: w.displayTDEE,
    bodyFatPct:
      w.bodyFatPct !== null ? Math.round(w.bodyFatPct * 10000) / 100 : null, // Convert decimal to percentage
    weightDayCount: w.weightDayCount,
    calorieDayCount: w.calorieDayCount,
  }))

  return {
    displayTDEE: result.displayTDEE,
    currentTDEE: result.currentTDEE ? Math.round(result.currentTDEE) : null,
    seedTDEE: result.seedTDEE,
    currentWeight: result.currentWeight,
    totalWeightChange:
      result.totalWeightChange !== null
        ? Math.round(result.totalWeightChange * 100) / 100
        : null,
    hasEnoughData,
    weeksWithData,
    weekUnit: weightUnit,
    energyUnit,
    goalCalories: result.goalCalories,
    dailyDeficit: result.dailyDeficit,
    weeksToGoal: result.weeksToGoal,
    goalDate: result.goalDate?.toISOString().split('T')[0] ?? null,
    recentWeeks,
  }
}
