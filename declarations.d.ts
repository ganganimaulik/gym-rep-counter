import { Timestamp } from 'firebase/firestore'

export interface WorkoutSet {
  id: string
  workoutId: string
  exerciseId: string
  exerciseName: string
  reps: number
  weight: number
  set: number
  startTime?: Timestamp | null // When the set started (optional for backward compat)
  date: Timestamp // When the set ended/was completed
}

export interface WeightLog {
  id: string
  weight: number
  date: Timestamp
}

export interface CalorieLog {
  id: string
  calories: number
  date: Timestamp
}

export interface MeasurementLog {
  id: string
  waist: number
  neck: number
  hip?: number
  date: Timestamp
}

export interface SupplementLog {
  name: string
  dosage?: string
}

export interface JournalEntry {
  id: string
  note: string
  date: Timestamp
  supplements?: SupplementLog[]
}

// Analytics Types
export interface PRRecord {
  exerciseId: string
  exerciseName: string
  maxWeight: number
  repsAtMax: number
  date: Timestamp
}

export interface StreakInfo {
  currentStreak: number // Number of consecutive qualifying weeks
  longestStreak: number
  lastWorkoutDate: Date | null
  currentWeekWorkouts: number // Days worked out this week so far
}

export interface VolumeData {
  label: string // e.g., "Week 1" or "Dec"
  startDate: Date
  endDate: Date
  totalVolume: number // weight × reps sum
}

export interface TrendData {
  date: Date
  avgWeight: number
  avgReps: number
  setCount: number
}

// TDEE Calculator Types (matching "TDEE variant with bf 3.06" spreadsheet)

export interface TDEEWeekData {
  weekStart: Date
  weekEnd: Date
  dailyWeights: (number | null)[]
  dailyCalories: (number | null)[]
  avgWeight: number | null
  avgCalories: number | null
  weightDelta: number | null
  rawTDEE: number | null
  smoothedTDEE: number | null
  displayTDEE: number | null
  bodyFatPct: number | null
  weightDayCount: number
  calorieDayCount: number
}

export interface TDEEConfig {
  weightUnit: 'lb' | 'kg'
  energyUnit: 'cal' | 'kj'
  smoothingWindowWeeks: number // default 12
  goalWeight?: number | null
  goalWeeklyRate?: number | null // lb or kg per week
  // Body fat inputs (optional)
  gender?: 'male' | 'female' | null
  heightValue?: number | null
  measurementUnit?: 'inch' | 'cm' | null
  waistValue?: number | null
  neckValue?: number | null
  hipValue?: number | null
}
