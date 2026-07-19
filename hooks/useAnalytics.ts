import { useReducer, useCallback, useMemo } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import type {
  WorkoutSet,
  PRRecord,
  StreakInfo,
  VolumeData,
  ExerciseTrendSeries,
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
  getExerciseTrends: (exerciseId: string) => ExerciseTrendSeries[]
  refreshAnalytics: (user: FirebaseUser | null) => Promise<void>
}

const defaultStreak: StreakInfo = {
  currentStreak: 0,
  longestStreak: 0,
  lastWorkoutDate: null,
  currentWeekWorkouts: 0,
}

interface AnalyticsState {
  isLoading: boolean
  error: string | null
  history: WorkoutSet[]
  prs: PRRecord[]
  streak: StreakInfo
  weeklyVolume: VolumeData[]
  monthlyVolume: VolumeData[]
  exercises: { id: string; name: string }[]
}

type AnalyticsAction =
  | { type: 'REFRESH_START' }
  | {
      type: 'REFRESH_SUCCESS'
      payload: {
        history: WorkoutSet[]
        prs: PRRecord[]
        streak: StreakInfo
        weeklyVolume: VolumeData[]
        monthlyVolume: VolumeData[]
        exercises: { id: string; name: string }[]
      }
    }
  | { type: 'REFRESH_ERROR'; error: string }

const initialState: AnalyticsState = {
  isLoading: false,
  error: null,
  history: [],
  prs: [],
  streak: defaultStreak,
  weeklyVolume: [],
  monthlyVolume: [],
  exercises: [],
}

function analyticsReducer(
  state: AnalyticsState,
  action: AnalyticsAction,
): AnalyticsState {
  switch (action.type) {
    case 'REFRESH_START':
      return { ...state, isLoading: true, error: null }
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        error: null,
        ...action.payload,
      }
    case 'REFRESH_ERROR':
      return { ...state, isLoading: false, error: action.error }
    default:
      return state
  }
}

export const useAnalytics = (dataHook: DataHook): AnalyticsHook => {
  const [state, dispatch] = useReducer(analyticsReducer, initialState)

  const { fetchFullHistory } = dataHook

  const refreshAnalytics = useCallback(
    async (user: FirebaseUser | null) => {
      dispatch({ type: 'REFRESH_START' })

      try {
        // Fetch all history for last 90 days
        const fullHistory = await fetchFullHistory(user, 90)

        // Calculate all analytics and dispatch a single update
        dispatch({
          type: 'REFRESH_SUCCESS',
          payload: {
            history: fullHistory,
            prs: calculatePRs(fullHistory),
            streak: calculateStreak(fullHistory, 5),
            weeklyVolume: calculateVolume(fullHistory, 'week', 8),
            monthlyVolume: calculateVolume(fullHistory, 'month', 6),
            exercises: getUniqueExercises(fullHistory),
          },
        })
      } catch (e) {
        console.error('Failed to refresh analytics', e)
        dispatch({
          type: 'REFRESH_ERROR',
          error: 'Failed to load analytics data',
        })
      }
    },
    [fetchFullHistory],
  )

  const getExerciseTrends = useCallback(
    (exerciseId: string): ExerciseTrendSeries[] => {
      return calculateTrends(state.history, exerciseId)
    },
    [state.history],
  )

  return useMemo(
    () => ({
      isLoading: state.isLoading,
      error: state.error,
      prs: state.prs,
      streak: state.streak,
      weeklyVolume: state.weeklyVolume,
      monthlyVolume: state.monthlyVolume,
      exercises: state.exercises,
      getExerciseTrends,
      refreshAnalytics,
    }),
    [state, getExerciseTrends, refreshAnalytics],
  )
}
