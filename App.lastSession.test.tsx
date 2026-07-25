import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
// See App.dynamicSets.test.tsx: re-throw effect errors so their real stack
// surfaces instead of "window.dispatchEvent is not a function".
;(global as any).window = (global as any).window || {}
if (typeof (global as any).window.dispatchEvent !== 'function') {
  ;(global as any).window.dispatchEvent = (event: any) => {
    if (event?.error) throw event.error
    return true
  }
}
import App from './App'

// Proves App.tsx wires the "Last Time" panel: it fetches the active exercise's
// recent sets, picks the previous session (never today), highlights the set the
// user is about to do, and hands the same numbers to the Live Activity.

jest.mock('expo-background-timer', () => ({
  bgSetTimeout: jest.fn((callback, timeout) => setTimeout(callback, timeout)),
  bgClearTimeout: jest.fn((id) => clearTimeout(id)),
  enableBackgroundExecution: jest.fn(),
  disableBackgroundExecution: jest.fn(),
}))

jest.mock('react-native-gesture-handler', () => ({}))
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  Reanimated.configureReanimatedLogger = jest.fn()
  Reanimated.ReanimatedLogLevel = { warn: 'warn', error: 'error' }
  return Reanimated
})

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}))

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: true }),
}))

jest.mock('lucide-react-native', () => {
  return new Proxy({}, { get: () => () => null })
})

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}))

jest.mock('react-native-toast-message', () => {
  const mockToast = () => null
  mockToast.show = jest.fn()
  mockToast.hide = jest.fn()
  return mockToast
})

jest.mock('./components/WorkoutPicker', () => {
  const { View } = require('react-native')
  return View
})

const mockUseAuth = jest.fn()
jest.mock('./hooks/useAuth', () => ({
  useAuth: (onSuccess: any) => mockUseAuth(onSuccess),
}))

const mockDataHookValue: any = {
  settings: {
    volume: 1,
    countdownSeconds: 3,
    restSeconds: 5,
    maxReps: 3,
    maxSets: 2,
    concentricSeconds: 1,
    eccentricSeconds: 2,
    eccentricCountdownEnabled: true,
  },
  workouts: [
    {
      id: 'w1',
      name: 'Push Day',
      exercises: [
        { id: 'ex1', name: 'Bench Press', sets: 3, reps: 8 },
        { id: 'ex2', name: 'Overhead Press', sets: 3, reps: 8 },
      ],
    },
  ],
  loadSettings: jest.fn().mockResolvedValue({}),
  loadWorkouts: jest.fn().mockResolvedValue([]),
  saveSettings: jest.fn(),
  saveWorkouts: jest.fn(),
  setSettings: jest.fn(),
  clearUserScopedCache: jest.fn(),
  syncUserData: jest.fn(),
  addHistoryEntry: jest.fn().mockResolvedValue(undefined),
  isSetCompleted: jest.fn(() => false),
  resetSetsFrom: jest.fn(),
  arePreviousSetsCompleted: jest.fn(() => true),
  getNextUncompletedSet: jest.fn(() => 1),
  fetchAllTodaysCompletions: jest.fn(),
  fetchRecentExerciseSets: jest.fn().mockResolvedValue([]),
  syncOfflineQueue: jest.fn(),
  fetchWeightLogs: jest.fn(),
  fetchCalorieLogs: jest.fn(),
  loadTDEEConfig: jest.fn(),
  fetchJournalEntries: jest.fn(),
  weightLogs: [],
  calorieLogs: [],
  journalEntries: [],
  todaysCompletions: [],
  historyVersion: 0,
  saveActiveSession: jest.fn(),
  loadActiveSession: jest
    .fn()
    .mockResolvedValue({ workoutId: 'w1', exerciseIndex: 0 }),
  clearActiveSession: jest.fn(),
}
jest.mock('./hooks/useData', () => ({
  useData: () => mockDataHookValue,
}))

jest.mock('./hooks/useAudio', () => ({
  useAudio: () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    queueSpeak: jest.fn(),
    speakEccentric: jest.fn(),
    setAudioSessionMode: jest.fn(),
  }),
}))

// Capture the last-set resolver App passes to the timer (7th arg) — that's what
// feeds the lock screen.
const mockTimerCapture: any = { lastSetSummaryFor: null }
const mockWorkoutTimerValue: any = {
  currentRep: { value: 0 },
  currentSet: { value: 1 },
  isRunning: false,
  isPaused: false,
  isResting: false,
  isRestComplete: false,
  phase: '',
  statusText: { value: '' },
  startWorkout: jest.fn(),
  pauseWorkout: jest.fn(),
  stopWorkout: jest.fn(),
  jumpToRep: jest.fn(),
  jumpToSet: jest.fn(),
  isExerciseComplete: false,
  setStatusText: jest.fn(),
  resetExerciseCompleteFlag: jest.fn(),
  continueToNextPhase: jest.fn(),
  addCountdownTime: jest.fn(),
  endSet: jest.fn(),
  runNextSet: jest.fn(),
}
jest.mock('./hooks/useWorkoutTimer', () => ({
  useWorkoutTimer: (...args: any[]) => {
    mockTimerCapture.lastSetSummaryFor = args[6]
    return mockWorkoutTimerValue
  },
}))

jest.mock('./components/SettingsModal', () => () => null)
jest.mock('./components/WorkoutManagementModal', () => () => null)
jest.mock('./components/layout/MainDisplay', () => () => null)
jest.mock('./components/layout/Controls', () => () => null)
jest.mock('./components/layout/RepJumper', () => () => null)
jest.mock('./components/AddSetDetailsModal', () => () => null)
jest.mock('./components/SplashScreen', () => () => null)
jest.mock('./components/HistoryScreen', () => () => null)
jest.mock('./components/ProgressScreen', () => () => null)
jest.mock('./components/JournalScreen', () => () => null)

// A set logged at noon `daysAgo` days back, so local-day grouping can't be
// flipped by a timezone offset.
const setDaysAgo = (
  daysAgo: number,
  setNumber: number,
  weight: number,
  reps: number,
) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return {
    id: `d${daysAgo}-s${setNumber}`,
    workoutId: 'w1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    weight,
    reps,
    set: setNumber,
    date: { toDate: () => d, toMillis: () => d.getTime() },
  }
}

describe('App — last session panel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTimerCapture.lastSetSummaryFor = null
    mockDataHookValue.getNextUncompletedSet.mockReturnValue(1)
    mockDataHookValue.loadActiveSession.mockResolvedValue({
      workoutId: 'w1',
      exerciseIndex: 0,
    })
    mockDataHookValue.fetchRecentExerciseSets.mockResolvedValue([])
    mockUseAuth.mockImplementation((onSuccess?: any) => {
      React.useEffect(() => {
        if (onSuccess) onSuccess(null)
      }, [onSuccess])
      return {
        user: null,
        initializing: false,
        isSigningIn: false,
        onGoogleButtonPress: jest.fn(),
        disconnectAccount: jest.fn(),
      }
    })
  })

  const renderActive = async () => {
    const utils = render(<App />)
    await waitFor(() => {
      expect(utils.getByTestId('set-tracker-button-3')).toBeTruthy()
    })
    return utils
  }

  it('fetches the active exercise history and shows the previous session', async () => {
    mockDataHookValue.fetchRecentExerciseSets.mockResolvedValue([
      setDaysAgo(0, 1, 65, 10), // today — must be ignored
      setDaysAgo(3, 1, 60, 12),
      setDaysAgo(3, 2, 60, 11),
    ])

    const { getByTestId, queryByTestId } = await renderActive()

    await waitFor(() => {
      expect(getByTestId('last-session-panel')).toBeTruthy()
    })
    expect(mockDataHookValue.fetchRecentExerciseSets).toHaveBeenCalledWith(
      null,
      'ex1',
    )
    expect(getByTestId('last-session-when').props.children).toBe('3 days ago')
    expect(getByTestId('last-session-chip-1')).toBeTruthy()
    expect(getByTestId('last-session-chip-2')).toBeTruthy()
    // Today's set must not appear as a third chip.
    expect(queryByTestId('last-session-chip-3')).toBeNull()
  })

  it('marks the set the user is about to do, not always set 1', async () => {
    mockDataHookValue.getNextUncompletedSet.mockReturnValue(2)
    mockDataHookValue.fetchRecentExerciseSets.mockResolvedValue([
      setDaysAgo(2, 1, 60, 12),
      setDaysAgo(2, 2, 62.5, 9),
    ])

    const { getByTestId } = await renderActive()

    await waitFor(() => {
      expect(
        getByTestId('last-session-chip-2').props.accessibilityState?.selected,
      ).toBe(true)
    })
    expect(
      getByTestId('last-session-chip-1').props.accessibilityState?.selected,
    ).toBe(false)
  })

  it('hides the panel when the exercise has no earlier history', async () => {
    mockDataHookValue.fetchRecentExerciseSets.mockResolvedValue([
      setDaysAgo(0, 1, 65, 10),
    ])

    const { queryByTestId } = await renderActive()

    await waitFor(() => {
      expect(mockDataHookValue.fetchRecentExerciseSets).toHaveBeenCalled()
    })
    expect(queryByTestId('last-session-panel')).toBeNull()
  })

  it('hands the same numbers to the timer for the lock screen', async () => {
    mockDataHookValue.fetchRecentExerciseSets.mockResolvedValue([
      setDaysAgo(4, 1, 60, 12),
      setDaysAgo(4, 2, 60, 10),
    ])

    const { getByTestId } = await renderActive()
    await waitFor(() => {
      expect(getByTestId('last-session-panel')).toBeTruthy()
    })

    expect(mockTimerCapture.lastSetSummaryFor(1)).toBe('60 kg × 12')
    expect(mockTimerCapture.lastSetSummaryFor(2)).toBe('60 kg × 10')
    // Beyond last session's set count, fall back to its final set.
    expect(mockTimerCapture.lastSetSummaryFor(9)).toBe('60 kg × 10')
  })

  it('survives a failed history fetch without breaking the screen', async () => {
    mockDataHookValue.fetchRecentExerciseSets.mockRejectedValue(
      new Error('offline'),
    )

    const { queryByTestId, getByTestId } = await renderActive()

    expect(getByTestId('set-tracker-button-3')).toBeTruthy()
    expect(queryByTestId('last-session-panel')).toBeNull()
    expect(mockTimerCapture.lastSetSummaryFor(1)).toBe('')
  })
})
