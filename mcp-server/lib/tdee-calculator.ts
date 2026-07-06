/**
 * TDEE Calculator — Server-side port of modules/tdeeCalculator.ts
 *
 * This is a standalone TypeScript module for use in the MCP server.
 * All calculation logic is identical to the client-side module.
 *
 * Row layout in spreadsheet:
 *   Even rows (12,14,16…) = Weight rows: D–J = daily weights, K = avg, L = Δ, M = TDEE
 *   Odd rows  (13,15,17…) = Calorie rows: D–J = daily calories, K = avg
 *
 * Columns AL–AR: gap-filled daily values (carry-forward)
 * Column AS: weekly average
 * Column AT: weight delta (this week − previous week)
 * Column AU: TDEE rounded to nearest 5
 * Column AV: core TDEE formula (raw + rolling average)
 */

import { Timestamp } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Constants (from spreadsheet cells AW12, AX12, AY12, AZ12, AW13, AX13…)
// ---------------------------------------------------------------------------

/** kcal per lb of body weight (AW12) */
export const KCAL_PER_LB = 3500;
/** kcal per kg of body weight (AX12 = 3500 × 2.20462) */
export const KCAL_PER_KG = 7716.169999999999;
/** kJ per lb (AY12 = 3500 × 4.184) */
export const KJ_PER_LB = 14644;
/** kJ per kg (AZ12 = AX12 × 4.184) */
export const KJ_PER_KG = 32284.45528;

/** Seed TDEE multiplier: cal/lb/day (AW13) */
export const SEED_MULTIPLIER_KCAL_LB = 13;
/** Seed TDEE multiplier: cal/kg/day (AX13 = 13 × 2.20462) */
export const SEED_MULTIPLIER_KCAL_KG = 28.660059999999998;
/** Seed TDEE multiplier: kJ/lb/day (AY13 = 13 × 4.184) */
export const SEED_MULTIPLIER_KJ_LB = 54.392;
/** Seed TDEE multiplier: kJ/kg/day (AZ13 = AX13 × 4.184) */
export const SEED_MULTIPLIER_KJ_KG = 119.91369103999999;

/** Default smoothing window in weeks (S8) */
export const DEFAULT_SMOOTHING_WEEKS = 12;

export type WeightUnit = 'lb' | 'kg';
export type EnergyUnit = 'cal' | 'kj';
export type Gender = 'male' | 'female';
export type MeasurementUnit = 'inch' | 'cm';

// ---------------------------------------------------------------------------
// Unit conversion lookup (matches AV6/AV7/AW7 logic)
// ---------------------------------------------------------------------------

/**
 * Returns energy per unit of body weight.
 * Matches spreadsheet cell AV7 lookup.
 *
 * lb+cal → 3500, kg+cal → 7716.17, lb+kJ → 14644, kg+kJ → 32284.46
 */
export function getEnergyPerUnit(
  weightUnit: WeightUnit,
  energyUnit: EnergyUnit,
): number {
  if (weightUnit === 'lb' && energyUnit === 'cal') return KCAL_PER_LB;
  if (weightUnit === 'kg' && energyUnit === 'cal') return KCAL_PER_KG;
  if (weightUnit === 'lb' && energyUnit === 'kj') return KJ_PER_LB;
  return KJ_PER_KG; // kg + kj
}

/**
 * Returns TDEE seed multiplier per unit of body weight.
 * Matches spreadsheet cell AW7 lookup.
 */
export function getSeedMultiplier(
  weightUnit: WeightUnit,
  energyUnit: EnergyUnit,
): number {
  if (weightUnit === 'lb' && energyUnit === 'cal')
    return SEED_MULTIPLIER_KCAL_LB;
  if (weightUnit === 'kg' && energyUnit === 'cal')
    return SEED_MULTIPLIER_KCAL_KG;
  if (weightUnit === 'lb' && energyUnit === 'kj') return SEED_MULTIPLIER_KJ_LB;
  return SEED_MULTIPLIER_KJ_KG; // kg + kj
}

// ---------------------------------------------------------------------------
// Rounding helpers (matching spreadsheet's MROUND)
// ---------------------------------------------------------------------------

/** MROUND(value, multiple) — rounds to nearest multiple. */
export function mround(value: number, multiple: number): number {
  if (multiple === 0) return value;
  return Math.round(value / multiple) * multiple;
}

/** Round TDEE to nearest 5 (column AU). */
export function roundTDEE(value: number): number {
  return mround(value, 5);
}

/** Round display TDEE to nearest 25 (cell L6). */
export function roundDisplayTDEE(value: number): number {
  return mround(value, 25);
}

/** Round weight to nearest 0.5 (cell AI124). */
export function roundWeight(value: number): number {
  return mround(value, 0.5);
}

// ---------------------------------------------------------------------------
// Seed TDEE estimate (cell AI5)
// ---------------------------------------------------------------------------

/**
 * Initial TDEE estimate before enough data exists.
 * Matches: AI5 = MROUND(F6 × AW7, 5)
 */
export function calculateSeedTDEE(
  startingWeight: number,
  weightUnit: WeightUnit,
  energyUnit: EnergyUnit,
): number {
  const multiplier = getSeedMultiplier(weightUnit, energyUnit);
  return mround(startingWeight * multiplier, 5);
}

// ---------------------------------------------------------------------------
// Gap-filling algorithm (columns AL–AR)
// ---------------------------------------------------------------------------

/**
 * Gap-fills missing daily values using carry-forward.
 * Matches columns AL–AR in the spreadsheet.
 *
 * - If day has a value, use it.
 * - If day is null, carry forward from the previous day.
 * - If first day (Monday) is null, use `previousAvg` (previous week's AS value).
 * - If no days have data at all, returns null (row is empty).
 *
 * @param dailyValues - Array of 7 values (Mon–Sun), null for missing days
 * @param previousAvg - Previous week's average (AS[row-2] or seed value)
 * @returns Gap-filled array of 7 values, or null if entire week is empty
 */
export function gapFillWeek(
  dailyValues: (number | null)[],
  previousAvg: number,
): number[] | null {
  // Spreadsheet: IF(COUNT(D:J) < 1, "", ...)
  const hasAnyData = dailyValues.some((v) => v !== null && v !== undefined);
  if (!hasAnyData) return null;

  const filled: number[] = new Array(7);

  // AL: IF(D="", previousAvg, D)
  filled[0] = dailyValues[0] ?? previousAvg;

  // AM–AR: IF(next="", previous_filled, next)
  for (let i = 1; i < 7; i++) {
    filled[i] = dailyValues[i] ?? filled[i - 1];
  }

  return filled;
}

// ---------------------------------------------------------------------------
// Weekly average (column AS)
// ---------------------------------------------------------------------------

/**
 * Calculates the weekly average from gap-filled values.
 * Matches: AS = SUM(AL:AR) / AH where AH = COUNT(AL:AR)
 *
 * Since gap-filled values always have 7 entries (if any data exists),
 * this is simply the mean of the 7 values.
 */
export function calculateWeeklyAverage(gapFilledValues: number[]): number {
  const count = gapFilledValues.length;
  if (count === 0) return 0;
  const sum = gapFilledValues.reduce((a, b) => a + b, 0);
  return sum / count;
}

// ---------------------------------------------------------------------------
// Raw TDEE formula (core of column AV)
// ---------------------------------------------------------------------------

/**
 * Calculates raw TDEE for a single week.
 * Matches the inner formula in AV:
 *   raw_tdee = avg_calories + ((-weight_delta × energy_per_unit) / calorie_day_count)
 *
 * @param avgCalories - K[n+1]: average daily calories for this week
 * @param weightDelta - L[n] = AT[n]: weight change from previous week (positive = gained)
 * @param energyPerUnit - AV7: energy per unit body weight (e.g. 3500 cal/lb)
 * @param calorieDayCount - AH[n+1]: number of days with calorie data (gap-filled count, always 7 if data exists)
 */
export function calculateRawTDEE(
  avgCalories: number,
  weightDelta: number,
  energyPerUnit: number,
  calorieDayCount: number,
): number {
  if (calorieDayCount === 0) return avgCalories;
  return avgCalories + (-weightDelta * energyPerUnit) / calorieDayCount;
}

// ---------------------------------------------------------------------------
// Smoothed TDEE — rolling average (column AV full formula)
// ---------------------------------------------------------------------------

/**
 * Calculates smoothed TDEE using a rolling average of previous TDEE values.
 * Matches the OFFSET/SUM portion of the AV formula.
 *
 * The spreadsheet computes:
 *   smoothed = (raw_tdee_this_week + SUM(previous_N-1_TDEE_values)) / min(N, available_weeks)
 *
 * Where N = smoothing window (default 12, from S8).
 *
 * @param rawTDEEThisWeek - The raw TDEE calculated for the current week
 * @param previousSmoothedTDEEs - Array of previous weeks' smoothed TDEE values (M column / AU column)
 * @param windowSize - Smoothing window in weeks (S8, default 12)
 * @returns Smoothed TDEE value
 */
export function calculateSmoothedTDEE(
  rawTDEEThisWeek: number,
  previousSmoothedTDEEs: number[],
  windowSize: number = DEFAULT_SMOOTHING_WEEKS,
): number {
  // Take up to (windowSize - 1) previous values
  const prevWindow = previousSmoothedTDEEs.slice(-(windowSize - 1));
  const allValues = [...prevWindow, rawTDEEThisWeek];
  const divisor = Math.min(windowSize, allValues.length);
  const sum = allValues.reduce((a, b) => a + b, 0);
  return sum / divisor;
}

// ---------------------------------------------------------------------------
// Body fat % — US Army method (column R)
// ---------------------------------------------------------------------------

/**
 * Calculates body fat percentage using the US Army formula.
 * Matches the exact formula in column R of the spreadsheet.
 *
 * Male (inch):
 *   BF% = ROUND((86.01 × LOG10(waist - neck)) - (70.041 × LOG10(height)) + 36.76) / 100
 *
 * Female (inch):
 *   BF% = ROUND((163.205 × LOG10(waist + hip - neck)) - (97.684 × LOG10(height)) - 78.387) / 100
 *
 * For cm: divide each measurement by 2.54 first, then apply inch formula.
 *
 * @returns Body fat as a decimal (e.g. 0.15 = 15%), or null if inputs are invalid
 */
export function calculateBodyFatPercent(
  gender: Gender,
  waist: number,
  neck: number,
  height: number,
  measurementUnit: MeasurementUnit,
  hip?: number,
): number | null {
  // Convert cm to inches if needed (spreadsheet divides by 2.54 inline)
  const toInch = (v: number) => (measurementUnit === 'cm' ? v / 2.54 : v);

  const w = toInch(waist);
  const n = toInch(neck);
  const h = toInch(height);

  if (w <= 0 || n <= 0 || h <= 0) return null;

  if (gender === 'male') {
    const diff = w - n;
    if (diff <= 0) return null;
    const raw = 86.01 * Math.log10(diff) - 70.041 * Math.log10(h) + 36.76;
    return Math.round(raw) / 100;
  } else {
    if (hip === undefined || hip === null) return null;
    const hp = toInch(hip);
    if (hp <= 0) return null;
    const sum = w + hp - n;
    if (sum <= 0) return null;
    const raw = 163.205 * Math.log10(sum) - 97.684 * Math.log10(h) - 78.387;
    return Math.round(raw) / 100;
  }
}

// ---------------------------------------------------------------------------
// Goal projection (cells F9, L8, AF4, AF5, L7)
// ---------------------------------------------------------------------------

/**
 * Calculates daily caloric deficit/surplus needed for goal weight change rate.
 * Matches: F9 = MROUND((F8 × AV7) / 7, 5)
 *
 * @param weeklyRate - Goal weight change per week (F8, always positive)
 * @param energyPerUnit - AV7 (e.g. 3500 cal/lb)
 * @returns Daily deficit/surplus rounded to nearest 5
 */
export function calculateDailyDeficit(
  weeklyRate: number,
  energyPerUnit: number,
): number {
  return mround((weeklyRate * energyPerUnit) / 7, 5);
}

/**
 * Calculates goal calorie intake.
 * Matches: L8 = IF(goal > current, TDEE + deficit, TDEE - deficit)
 */
export function calculateGoalCalories(
  tdee: number,
  currentWeight: number,
  goalWeight: number,
  dailyDeficit: number,
): number {
  if (goalWeight > currentWeight) {
    // Bulking — eat above TDEE
    return tdee + dailyDeficit;
  } else if (goalWeight < currentWeight) {
    // Cutting — eat below TDEE
    return tdee - dailyDeficit;
  }
  return tdee; // Maintain
}

/**
 * Calculates weeks to reach goal weight.
 * Matches: AF4/AF5 = CEILING(((goal - current) / rate), 0.5)
 */
export function calculateWeeksToGoal(
  currentWeight: number,
  goalWeight: number,
  weeklyRate: number,
): number {
  if (weeklyRate === 0 || currentWeight === goalWeight) return 0;
  const raw = Math.abs(goalWeight - currentWeight) / weeklyRate;
  // CEILING to nearest 0.5
  return Math.ceil(raw / 0.5) * 0.5;
}

/**
 * Calculates the estimated goal date.
 * Matches: L7 = TODAY() + (weeks_to_goal × 7)
 */
export function calculateGoalDate(
  weeksToGoal: number,
  fromDate: Date = new Date(),
): Date {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + Math.round(weeksToGoal * 7));
  return date;
}

// ---------------------------------------------------------------------------
// Full TDEE pipeline
// ---------------------------------------------------------------------------

export interface WeekInput {
  /** ISO date string for the Monday of this week */
  weekStart: Date;
  /** 7 daily weight values (Mon–Sun), null for missing */
  dailyWeights: (number | null)[];
  /** 7 daily calorie values (Mon–Sun), null for missing */
  dailyCalories: (number | null)[];
  /** Optional body measurements for BF% */
  waist?: number;
  neck?: number;
  hip?: number;
}

export interface WeekResult {
  weekStart: Date;
  weekEnd: Date;
  dailyWeights: (number | null)[];
  dailyCalories: (number | null)[];
  gapFilledWeights: number[] | null;
  gapFilledCalories: number[] | null;
  avgWeight: number | null;
  avgCalories: number | null;
  weightDelta: number | null;
  rawTDEE: number | null;
  smoothedTDEE: number | null;
  displayTDEE: number | null;
  bodyFatPct: number | null;
  weightDayCount: number;
  calorieDayCount: number;
}

export interface TDEEPipelineConfig {
  startingWeight: number | null;
  weightUnit: WeightUnit;
  energyUnit: EnergyUnit;
  smoothingWindowWeeks?: number;
  // Optional: for body fat calculation
  gender?: Gender;
  height?: number;
  measurementUnit?: MeasurementUnit;
  // Optional: for goal projection
  goalWeight?: number;
  goalWeeklyRate?: number;
}

export interface TDEEPipelineResult {
  weeks: WeekResult[];
  currentTDEE: number | null;
  displayTDEE: number | null;
  seedTDEE: number;
  currentWeight: number | null;
  totalWeightChange: number | null;
  // Goal projection
  goalCalories: number | null;
  dailyDeficit: number | null;
  weeksToGoal: number | null;
  goalDate: Date | null;
}

/**
 * Runs the complete TDEE calculation pipeline matching the spreadsheet logic.
 *
 * This processes all weeks of data sequentially, applying:
 * 1. Gap-filling for missing daily entries
 * 2. Weekly average calculation
 * 3. Weight delta computation
 * 4. Raw TDEE calculation
 * 5. Rolling average smoothing
 * 6. Rounding
 */
export function calculateTDEEPipeline(
  weekInputs: WeekInput[],
  config: TDEEPipelineConfig,
): TDEEPipelineResult {
  const {
    startingWeight,
    weightUnit,
    energyUnit,
    smoothingWindowWeeks = DEFAULT_SMOOTHING_WEEKS,
    gender,
    height,
    measurementUnit,
    goalWeight,
    goalWeeklyRate,
  } = config;

  const energyPerUnit = getEnergyPerUnit(weightUnit, energyUnit);
  const seedTDEE =
    startingWeight !== null
      ? calculateSeedTDEE(startingWeight, weightUnit, energyUnit)
      : 0;

  const weeks: WeekResult[] = [];
  const smoothedTDEEHistory: number[] = [];

  // Previous week's average weight — starts with startingWeight (AM6 = F6)
  let prevAvgWeight: number = startingWeight ?? 0;
  // Previous week's average calories — starts with seed TDEE (AI5)
  let prevAvgCalories: number = seedTDEE;
  // Track the latest known weight (AI column)
  let latestKnownWeight: number | null = startingWeight;

  // Track first week to prevent skewed initial deltas if startingWeight config is inaccurate
  let isFirstWeekWithWeight = true;

  // Pre-calculate raw weight anchors for retroactive linear interpolation of missing weeks
  const rawAnchors: (number | null)[] = weekInputs.map((input) => {
    const validWeights = input.dailyWeights.filter(
      (w) => w !== null,
    ) as number[];
    if (validWeights.length === 0) return null;
    return validWeights.reduce((a, b) => a + b, 0) / validWeights.length;
  });

  for (let i = 0; i < weekInputs.length; i++) {
    const input = weekInputs[i];
    const weekEnd = new Date(input.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Count actual data entries
    const weightDayCount = input.dailyWeights.filter(
      (v) => v !== null && v !== undefined,
    ).length;
    const calorieDayCount = input.dailyCalories.filter(
      (v) => v !== null && v !== undefined,
    ).length;

    // Gap-fill
    const gapFilledWeights = gapFillWeek(input.dailyWeights, prevAvgWeight);
    const gapFilledCalories = gapFillWeek(input.dailyCalories, prevAvgCalories);

    // Weekly averages
    let avgWeight: number | null = null;

    if (gapFilledWeights !== null) {
      avgWeight = calculateWeeklyAverage(gapFilledWeights);
    } else {
      // Retroactive Linear Interpolation for missing weeks
      let nextAnchor: number | null = null;
      let missingCount = 0;

      for (let j = i + 1; j < rawAnchors.length; j++) {
        if (rawAnchors[j] !== null) {
          nextAnchor = rawAnchors[j];
          missingCount = j - i;
          break;
        }
      }

      if (nextAnchor !== null && prevAvgWeight !== null) {
        const stepSize = (nextAnchor - prevAvgWeight) / (missingCount + 1);
        avgWeight = prevAvgWeight + stepSize;
      }
    }
    const avgCalories = gapFilledCalories
      ? calculateWeeklyAverage(gapFilledCalories)
      : null;

    // Auto-detect starting weight to prevent massive delta spikes
    if (avgWeight !== null && isFirstWeekWithWeight) {
      prevAvgWeight = avgWeight;
      isFirstWeekWithWeight = false;
    }

    // Weight delta (AT column: this week - previous week)
    const weightDelta = avgWeight !== null ? avgWeight - prevAvgWeight : null;

    // Update latest known weight (AI column)
    if (avgWeight !== null) {
      latestKnownWeight = avgWeight;
    }

    // TDEE calculation
    let rawTDEE: number | null = null;
    let smoothedTDEE: number | null = null;
    let displayTDEE: number | null = null;

    if (i === 0) {
      // Week 1 (row 12): AV12 = AS13 + ((-AT12 × AV7) / AH13)
      if (avgWeight !== null && avgCalories !== null) {
        rawTDEE = calculateRawTDEE(
          avgCalories,
          weightDelta!,
          energyPerUnit,
          gapFilledCalories!.length,
        );
        smoothedTDEE = rawTDEE;
        displayTDEE = roundTDEE(smoothedTDEE);
        smoothedTDEEHistory.push(displayTDEE);
      }
    } else {
      // Subsequent weeks: need both weight + calorie data with 7 gap-filled values
      // Spreadsheet checks: IF(AH[n+1] < 7, carry_prev, IF(AH[n] < 7, carry_prev, ...))
      // Since gap-fill always produces 7 entries when any data exists, we check if data exists at all
      if (
        avgWeight !== null &&
        avgCalories !== null &&
        weightDelta !== null &&
        gapFilledCalories !== null
      ) {
        rawTDEE = calculateRawTDEE(
          avgCalories,
          weightDelta,
          energyPerUnit,
          gapFilledCalories.length,
        );

        // Rolling average with previous smoothed TDEE values
        smoothedTDEE = calculateSmoothedTDEE(
          rawTDEE,
          smoothedTDEEHistory,
          smoothingWindowWeeks,
        );
        displayTDEE = roundTDEE(smoothedTDEE);
        smoothedTDEEHistory.push(displayTDEE);
      } else if (smoothedTDEEHistory.length > 0) {
        // Carry forward previous TDEE (matching AV[n] = AV[n-2] when data insufficient)
        displayTDEE = smoothedTDEEHistory[smoothedTDEEHistory.length - 1];
        smoothedTDEE = displayTDEE;
        smoothedTDEEHistory.push(displayTDEE); // Also push to history to maintain rolling window
      }
    }

    // Body fat calculation (optional)
    let bodyFatPct: number | null = null;
    if (
      gender &&
      height &&
      measurementUnit &&
      input.waist !== undefined &&
      input.neck !== undefined
    ) {
      bodyFatPct = calculateBodyFatPercent(
        gender,
        input.waist,
        input.neck,
        height,
        measurementUnit,
        input.hip,
      );
    }

    weeks.push({
      weekStart: input.weekStart,
      weekEnd,
      dailyWeights: input.dailyWeights,
      dailyCalories: input.dailyCalories,
      gapFilledWeights,
      gapFilledCalories,
      avgWeight,
      avgCalories,
      weightDelta,
      rawTDEE,
      smoothedTDEE,
      displayTDEE,
      bodyFatPct,
      weightDayCount,
      calorieDayCount,
    });

    // Update previous averages for next iteration
    if (avgWeight !== null) prevAvgWeight = avgWeight;
    if (avgCalories !== null) prevAvgCalories = avgCalories;
  }

  // Current values (matching row 124)
  const lastWeekWithTDEE = [...weeks]
    .reverse()
    .find((w) => w.displayTDEE !== null);
  const currentTDEE = lastWeekWithTDEE?.smoothedTDEE ?? null;
  const currentDisplayTDEE = lastWeekWithTDEE?.displayTDEE ?? null;
  const currentWeight =
    latestKnownWeight !== null ? roundWeight(latestKnownWeight) : null;
  const totalWeightChange =
    currentWeight !== null && startingWeight !== null
      ? currentWeight - startingWeight
      : null;

  // Goal projection
  let goalCalories: number | null = null;
  let dailyDeficit: number | null = null;
  let weeksToGoal: number | null = null;
  let goalDate: Date | null = null;

  const tdeeForGoal = currentDisplayTDEE ?? seedTDEE;

  if (
    goalWeight !== undefined &&
    goalWeeklyRate !== undefined &&
    goalWeeklyRate > 0 &&
    currentDisplayTDEE !== null &&
    currentWeight !== null
  ) {
    dailyDeficit = calculateDailyDeficit(goalWeeklyRate, energyPerUnit);
    goalCalories = calculateGoalCalories(
      tdeeForGoal,
      currentWeight,
      goalWeight,
      dailyDeficit,
    );
    weeksToGoal = calculateWeeksToGoal(
      currentWeight,
      goalWeight,
      goalWeeklyRate,
    );
    goalDate = calculateGoalDate(weeksToGoal);
  }

  return {
    weeks,
    currentTDEE,
    displayTDEE:
      currentDisplayTDEE !== null
        ? roundDisplayTDEE(currentDisplayTDEE)
        : roundDisplayTDEE(seedTDEE),
    seedTDEE,
    currentWeight,
    totalWeightChange,
    goalCalories,
    dailyDeficit,
    weeksToGoal,
    goalDate,
  };
}

// ---------------------------------------------------------------------------
// Server-side helper: Raw Firestore data → TDEE analysis
// ---------------------------------------------------------------------------

/**
 * Represents a raw Firestore timestamp as it appears in document data.
 * Firestore timestamps serialize as { _seconds, _nanoseconds } in the
 * firebase-admin SDK's DocumentData.
 */
interface FirestoreTimestampData {
  _seconds: number;
  _nanoseconds: number;
}

/** Raw weight log document data from Firestore */
export interface RawWeightLog {
  id?: string;
  weight: number;
  date: Timestamp | FirestoreTimestampData;
}

/** Raw calorie log document data from Firestore */
export interface RawCalorieLog {
  id?: string;
  calories: number;
  date: Timestamp | FirestoreTimestampData;
}

/** TDEE config as stored in Firestore */
export interface TDEEConfigData {
  weightUnit: WeightUnit;
  energyUnit: EnergyUnit;
  smoothingWindowWeeks?: number;
  goalWeight?: number;
  goalWeeklyRate?: number;
  gender?: Gender;
  heightValue?: number;
  measurementUnit?: MeasurementUnit;
  waistValue?: number;
  neckValue?: number;
  hipValue?: number;
}

/** Result format for the MCP tool response */
export interface TDEEAnalysisResult {
  displayTDEE: number | null;
  currentTDEE: number | null;
  seedTDEE: number;
  currentWeight: number | null;
  totalWeightChange: number | null;
  hasEnoughData: boolean;
  weeksWithData: number;
  weekUnit: WeightUnit;
  energyUnit: EnergyUnit;
  // Goal projection
  goalCalories: number | null;
  dailyDeficit: number | null;
  weeksToGoal: number | null;
  goalDate: string | null;
  // Weekly breakdown (recent weeks only)
  recentWeeks: {
    weekStart: string;
    weekEnd: string;
    avgWeight: number | null;
    avgCalories: number | null;
    weightDelta: number | null;
    displayTDEE: number | null;
    bodyFatPct: number | null;
    weightDayCount: number;
    calorieDayCount: number;
  }[];
}

/**
 * Converts a Firestore timestamp (Timestamp instance or raw {_seconds, _nanoseconds})
 * to a JavaScript Date.
 */
function toDate(ts: Timestamp | FirestoreTimestampData): Date {
  if (ts instanceof Timestamp) {
    return ts.toDate();
  }
  // Raw serialized format: { _seconds, _nanoseconds }
  return new Date(ts._seconds * 1000 + ts._nanoseconds / 1_000_000);
}

/**
 * Converts a Firestore timestamp to milliseconds since epoch.
 */
function toMillis(ts: Timestamp | FirestoreTimestampData): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  return ts._seconds * 1000 + Math.floor(ts._nanoseconds / 1_000_000);
}

/**
 * Groups weight and calorie logs into weekly buckets (Mon–Sun).
 * This is a server-side port of useTDEE.ts's groupLogsByWeek function.
 */
function groupLogsByWeek(
  weightLogs: RawWeightLog[],
  calorieLogs: RawCalorieLog[],
): WeekInput[] {
  if (weightLogs.length === 0 && calorieLogs.length === 0) return [];

  // Find the earliest log date to determine start
  const allDates: Date[] = [
    ...weightLogs.map((l) => toDate(l.date)),
    ...calorieLogs.map((l) => toDate(l.date)),
  ];

  if (allDates.length === 0) return [];

  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const latest = new Date(Math.max(...allDates.map((d) => d.getTime())));

  // Find the Monday of the earliest date's week
  const startMonday = new Date(earliest);
  const day = startMonday.getDay();
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // Shift to Monday: if Sunday (0), go back 6 days; otherwise go back (day-1) days
  const daysToMonday = day === 0 ? 6 : day - 1;
  startMonday.setDate(startMonday.getDate() - daysToMonday);
  startMonday.setHours(0, 0, 0, 0);

  // Build a map for quick lookup: dateStr -> value
  const weightMap = new Map<string, number>();
  weightLogs.forEach((log) => {
    const d = toDate(log.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    weightMap.set(key, log.weight);
  });

  const calorieMap = new Map<string, number>();
  calorieLogs.forEach((log) => {
    const d = toDate(log.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    calorieMap.set(key, log.calories);
  });

  const weeks: WeekInput[] = [];
  const currentMonday = new Date(startMonday);
  let hasStarted = false;

  while (currentMonday <= latest) {
    const dailyWeights: (number | null)[] = [];
    const dailyCalories: (number | null)[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(currentMonday);
      date.setDate(date.getDate() + dayOffset);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      dailyWeights.push(weightMap.get(key) ?? null);
      dailyCalories.push(calorieMap.get(key) ?? null);
    }

    const hasWeightData = dailyWeights.some((v) => v !== null);
    const hasCalorieData = dailyCalories.some((v) => v !== null);

    if (hasWeightData || hasCalorieData) {
      hasStarted = true;
    }

    if (hasStarted) {
      weeks.push({
        weekStart: new Date(currentMonday),
        dailyWeights,
        dailyCalories,
      });
    }

    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return weeks;
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
  // Determine dynamic starting weight from the oldest logged weight
  // Weight logs are expected newest-first from Firestore orderBy('date', 'desc')
  const startingWeight =
    weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;

  const weightUnit: WeightUnit = tdeeConfig?.weightUnit ?? 'kg';
  const energyUnit: EnergyUnit = tdeeConfig?.energyUnit ?? 'cal';

  if (!tdeeConfig) {
    const fallbackSeed = startingWeight
      ? calculateSeedTDEE(startingWeight, 'kg', 'cal')
      : 0;
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
    };
  }

  // Cap TDEE processing to 1 year of data for performance
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoMillis = oneYearAgo.getTime();

  const recentWeightLogs = weightLogs.filter(
    (l) => toMillis(l.date) >= oneYearAgoMillis,
  );
  const recentCalorieLogs = calorieLogs.filter(
    (l) => toMillis(l.date) >= oneYearAgoMillis,
  );

  // Group logs into weekly buckets
  let weekInputs = groupLogsByWeek(recentWeightLogs, recentCalorieLogs);

  // Attach body fat measurements to each week input
  weekInputs = weekInputs.map((week) => ({
    ...week,
    waist: tdeeConfig.waistValue,
    neck: tdeeConfig.neckValue,
    hip: tdeeConfig.hipValue,
  }));

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
  };

  // Run the pipeline
  const result = calculateTDEEPipeline(weekInputs, pipelineConfig);

  // Count weeks that have a calculated TDEE
  const weeksWithData = result.weeks.filter(
    (w) => w.displayTDEE !== null,
  ).length;

  // Need at least 2 weeks of data for meaningful TDEE
  const hasEnoughData = weeksWithData >= 2;

  // Return recent weeks (last 12) for the response
  const recentWeeks = result.weeks.slice(-12).map((w) => ({
    weekStart: w.weekStart.toISOString().split('T')[0],
    weekEnd: w.weekEnd.toISOString().split('T')[0],
    avgWeight: w.avgWeight !== null ? Math.round(w.avgWeight * 100) / 100 : null,
    avgCalories:
      w.avgCalories !== null ? Math.round(w.avgCalories) : null,
    weightDelta:
      w.weightDelta !== null
        ? Math.round(w.weightDelta * 100) / 100
        : null,
    displayTDEE: w.displayTDEE,
    bodyFatPct:
      w.bodyFatPct !== null
        ? Math.round(w.bodyFatPct * 10000) / 100
        : null, // Convert decimal to percentage
    weightDayCount: w.weightDayCount,
    calorieDayCount: w.calorieDayCount,
  }));

  return {
    displayTDEE: result.displayTDEE,
    currentTDEE: result.currentTDEE
      ? Math.round(result.currentTDEE)
      : null,
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
  };
}
