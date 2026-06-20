import { Timestamp } from 'firebase/firestore'

export interface WorkoutSet {
  id: string
  workoutId: string
  exerciseId: string
  exerciseName: string
  reps: number
  weight: number
  set: number
  startTime?: Timestamp // When the set started (optional for backward compat)
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

export interface JournalEntry {
  id: string
  note: string
  date: Timestamp
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
