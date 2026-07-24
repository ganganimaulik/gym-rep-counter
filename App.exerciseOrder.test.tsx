import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
// react-test-renderer reports uncaught errors thrown inside effects via
// window.dispatchEvent, which the RN test env doesn't define. Re-throw so the
// true stack shows up instead of "window.dispatchEvent is not a function".
;(global as any).window = (global as any).window || {}
if (typeof (global as any).window.dispatchEvent !== 'function') {
  ;(global as any).window.dispatchEvent = (event: any) => {
    if (event?.error) throw event.error
    return true
  }
}
import App from './App'

// These tests cover how App orders a session's exercises: finished ones first,
// then anything with at least one set logged, then the untouched remainder.
// The real WorkoutSelector renders so its "Active Exercise" name and
// "Exercise N of M" counter report the resulting order.

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
  return new Proxy(
    {},
    {
      get: () => () => null,
    },
  )
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

// Stand-in picker: one button per routine so a test can drive selectWorkout.
jest.mock('./components/WorkoutPicker', () => {
  const { Text, TouchableOpacity } = require('react-native')
  return ({ workouts, onValueChange }: any) => (
    <>
      {workouts.map((w: any) => (
        <TouchableOpacity
          key={w.id}
          testID={`pick-${w.id}`}
          onPress={() => onValueChange(w.id)}>
          <Text>{w.name}</Text>
        </TouchableOpacity>
      ))}
    </>
  )
})

const EXERCISES = [
  { id: 'ex1', name: 'Bench Press', sets: 3, reps: 8 },
  { id: 'ex2', name: 'Incline Press', sets: 3, reps: 8 },
  { id: 'ex3', name: 'Shoulder Press', sets: 3, reps: 8 },
  { id: 'ex4', name: 'Lateral Raise', sets: 3, reps: 8 },
]

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
  workouts: [{ id: 'w1', name: 'Push Day', exercises: EXERCISES }],
  loadSettings: jest.fn().mockResolvedValue({}),
  loadWorkouts: jest.fn().mockResolvedValue([]),
  saveSettings: jest.fn(),
  saveWorkouts: jest.fn(),
  setSettings: jest.fn(),
  clearUserScopedCache: jest.fn(),
  syncUserData: jest.fn(),
  addHistoryEntry: jest.fn(),
  isSetCompleted: jest.fn(() => false),
  resetSetsFrom: jest.fn(),
  arePreviousSetsCompleted: jest.fn(() => true),
  getNextUncompletedSet: jest.fn(() => 1),
  fetchAllTodaysCompletions: jest.fn(),
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
  loadActiveSession: jest.fn().mockResolvedValue(null),
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
  }),
}))

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
  useWorkoutTimer: () => mockWorkoutTimerValue,
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

// Report the given sets as logged today, e.g. { ex3: [1, 2, 3], ex4: [1] }.
// Assigned as a fresh jest.fn so the new identity propagates through useData's
// memoised callbacks, the way a real completions update does.
const setCompletions = (completions: Record<string, number[]>) => {
  mockDataHookValue.isSetCompleted = jest.fn(
    (exerciseId: string, setNumber: number) =>
      (completions[exerciseId] ?? []).includes(setNumber),
  )
  mockDataHookValue.todaysCompletions = Object.entries(completions).flatMap(
    ([exerciseId, sets]) => sets.map((set) => ({ exerciseId, set })),
  )
}

describe('App — exercise ordering by completion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setCompletions({})
    mockDataHookValue.arePreviousSetsCompleted.mockReturnValue(true)
    mockDataHookValue.getNextUncompletedSet.mockReturnValue(1)
    mockDataHookValue.loadActiveSession.mockResolvedValue(null)
    mockWorkoutTimerValue.isRunning = false
    mockWorkoutTimerValue.currentSet = { value: 1 }

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

  const selectPushDay = async () => {
    const utils = render(<App />)
    await waitFor(() => expect(utils.getByTestId('pick-w1')).toBeTruthy())
    fireEvent.press(utils.getByTestId('pick-w1'))
    return utils
  }

  it('resumes on a half-finished exercise, ordered behind the finished ones', async () => {
    // Shoulder Press done, Lateral Raise one set in — both were started out of
    // routine order, so they lead and the session resumes on the half-done one.
    setCompletions({ ex3: [1, 2, 3], ex4: [1] })
    const { getByText } = await selectPushDay()

    await waitFor(() => {
      expect(getByText('Lateral Raise')).toBeTruthy()
    })
    expect(getByText('Exercise 2 of 4')).toBeTruthy()
  })

  it('keeps a half-finished exercise ahead of untouched ones with nothing complete', async () => {
    setCompletions({ ex4: [1] })
    const { getByText } = await selectPushDay()

    await waitFor(() => {
      expect(getByText('Lateral Raise')).toBeTruthy()
    })
    expect(getByText('Exercise 1 of 4')).toBeTruthy()
  })

  it('leaves the order alone when no set has been logged', async () => {
    const { getByText } = await selectPushDay()

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy()
    })
    expect(getByText('Exercise 1 of 4')).toBeTruthy()
  })

  it('moves an exercise up as soon as its first set lands, keeping it active', async () => {
    // Start on the last exercise of an untouched routine.
    mockDataHookValue.loadActiveSession.mockResolvedValue({
      workoutId: 'w1',
      exerciseIndex: 3,
    })
    const { getByText, rerender } = render(<App />)
    await waitFor(() => {
      expect(getByText('Exercise 4 of 4')).toBeTruthy()
    })
    expect(getByText('Lateral Raise')).toBeTruthy()

    // Its first set is logged: it jumps to the front and stays on screen.
    setCompletions({ ex4: [1] })
    rerender(<App />)

    await waitFor(() => {
      expect(getByText('Exercise 1 of 4')).toBeTruthy()
    })
    expect(getByText('Lateral Raise')).toBeTruthy()
  })

  it('slots a half-finished exercise behind a finished one when its set lands', async () => {
    setCompletions({ ex1: [1, 2, 3] })
    mockDataHookValue.loadActiveSession.mockResolvedValue({
      workoutId: 'w1',
      exerciseIndex: 3,
    })
    const { getByText, rerender } = render(<App />)
    await waitFor(() => {
      expect(getByText('Lateral Raise')).toBeTruthy()
    })

    setCompletions({ ex1: [1, 2, 3], ex4: [1] })
    rerender(<App />)

    // Behind the finished Bench Press, ahead of the untouched two.
    await waitFor(() => {
      expect(getByText('Exercise 2 of 4')).toBeTruthy()
    })
    expect(getByText('Lateral Raise')).toBeTruthy()
  })
})
