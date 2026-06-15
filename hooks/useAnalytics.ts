import { useState, useCallback, useMemo } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import type {
  WorkoutSet,
  PRRecord,
  StreakInfo,
  VolumeData,
  TrendData,
} from '../declarations'
import {
  calculatePRs,
  calculateStreak,
  calculateVolume,
  calculateTrends,
  getUniqueExercises,
} from '../utils/analyticsUtils'
import { DataHook } from './useData'

export interface AnalyticsHook {
  isLoading: boolean
  error: string | null
  prs: PRRecord[]
  streak: StreakInfo
  weeklyVolume: VolumeData[]
  monthlyVolume: VolumeData[]
  exercises: { id: string; name: string }[]
  getExerciseTrends: (exerciseId: string) => TrendData[]
  refreshAnalytics: (user: FirebaseUser | null) => Promise<void>
}

const defaultStreak: StreakInfo = {
  currentStreak: 0,
  longestStreak: 0,
  lastWorkoutDate: null,
  currentWeekWorkouts: 0,
}

export const useAnalytics = (dataHook: DataHook): AnalyticsHook => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<WorkoutSet[]>([])
  const [prs, setPRs] = useState<PRRecord[]>([])
  const [streak, setStreak] = useState<StreakInfo>(defaultStreak)
  const [weeklyVolume, setWeeklyVolume] = useState<VolumeData[]>([])
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeData[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])

  const { fetchFullHistory } = dataHook

  const refreshAnalytics = useCallback(
    async (user: FirebaseUser | null) => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch all history for last 90 days
        const fullHistory = await fetchFullHistory(user, 90)
        setHistory(fullHistory)

        // Calculate all analytics
        setPRs(calculatePRs(fullHistory))
        setStreak(calculateStreak(fullHistory, 5))
        setWeeklyVolume(calculateVolume(fullHistory, 'week', 8))
        setMonthlyVolume(calculateVolume(fullHistory, 'month', 6))
        setExercises(getUniqueExercises(fullHistory))
      } catch (e) {
        console.error('Failed to refresh analytics', e)
        setError('Failed to load analytics data')
      } finally {
        setIsLoading(false)
      }
    },
    [fetchFullHistory],
  )

  const getExerciseTrends = useCallback(
    (exerciseId: string): TrendData[] => {
      return calculateTrends(history, exerciseId)
    },
    [history],
  )

  return useMemo(
    () => ({
      isLoading,
      error,
      prs,
      streak,
      weeklyVolume,
      monthlyVolume,
      exercises,
      getExerciseTrends,
      refreshAnalytics,
    }),
    [
      isLoading,
      error,
      prs,
      streak,
      weeklyVolume,
      monthlyVolume,
      exercises,
      getExerciseTrends,
      refreshAnalytics,
    ],
  )
}
