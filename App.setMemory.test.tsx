import React from 'react'
import { render, act, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadSetPreferences } from './utils/exerciseSetPreference'
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

// Proves App.tsx remembers, per exercise, how the user last logged a set —
// weight unit and rep count — and feeds those back as the Set Complete modal's
// defaults. Especially: ending a set during the "Get Ready" countdown reports
// 0 reps, and the modal must then fall back to the remembered reps (or the
// target) instead of showing 0. The real exerciseSetPreference util +
// in-memory AsyncStorage persist for real, so this is a full round-trip.

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

jest.mock('./components/WorkoutPicker', () => {
  const { View } = require('react-native')
  return View
})

const mockUseAuth = jest.fn()
jest.mock('./hooks/useAuth', () => ({
  useAuth: (onSuccess: any) => mockUseAuth(onSuccess),
}))

const mockDataHookValue: any = {
  // maxReps here (3) is only the last-resort rep fallback; the exercise's own
  // target is 8. They differ so the test can tell which default is used.
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
  // ex1 is configured to log in kg.
  workouts: [
    {
      id: 'w1',
      name: 'Push Day',
      exercises: [
        { id: 'ex1', name: 'Bench Press', sets: 3, reps: 8, weightUnit: 'kg' },
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
  syncOfflineQueue: jest.fn(),
  fetchWeightLogs: jest.fn(),
  fetchCalorieLogs: jest.fn(),
  fetchMeasurementLogs: jest.fn(),
  loadTDEEConfig: jest.fn(),
  fetchJournalEntries: jest.fn(),
  weightLogs: [],
  calorieLogs: [],
  measurementLogs: [],
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
  }),
}))

// Capture the onSetComplete callback App passes to the timer so the test can
// fire a set completion without a real timer.
const mockTimerCapture: any = { onSetComplete: null }
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
    mockTimerCapture.onSetComplete = args[3]
    return mockWorkoutTimerValue
  },
}))

// Capture the props App feeds the Set Complete modal.
const mockModalCapture: any = {
  visible: false,
  initialReps: undefined,
  defaultWeightUnit: undefined,
  onSubmit: null,
  onClose: null,
}
jest.mock('./components/AddSetDetailsModal', () => (props: any) => {
  mockModalCapture.visible = props.visible
  mockModalCapture.initialReps = props.initialReps
  mockModalCapture.defaultWeightUnit = props.defaultWeightUnit
  mockModalCapture.onSubmit = props.onSubmit
  mockModalCapture.onClose = props.onClose
  return null
})

jest.mock('./components/SettingsModal', () => () => null)
jest.mock('./components/WorkoutManagementModal', () => () => null)
jest.mock('./components/layout/MainDisplay', () => () => null)
jest.mock('./components/layout/Controls', () => () => null)
jest.mock('./components/layout/RepJumper', () => () => null)
jest.mock('./components/SplashScreen', () => () => null)
jest.mock('./components/HistoryScreen', () => () => null)
jest.mock('./components/ProgressScreen', () => () => null)
jest.mock('./components/JournalScreen', () => () => null)

// Fire the timer's onSetComplete with the given rep count. reps === 0 mimics
// ending a set during the "Get Ready" countdown (no rep was ever counted).
const completeSet = (set: number, reps: number) =>
  act(() => {
    mockTimerCapture.onSetComplete({
      exerciseId: 'ex1',
      reps,
      set,
      startTime: set * 10,
      endTime: set * 10 + 5,
    })
  })

describe('App — remembers last set unit and reps per exercise', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
    mockTimerCapture.onSetComplete = null
    mockModalCapture.visible = false
    mockModalCapture.initialReps = undefined
    mockModalCapture.defaultWeightUnit = undefined
    mockDataHookValue.loadActiveSession.mockResolvedValue({
      workoutId: 'w1',
      exerciseIndex: 0,
    })
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

  // Render and wait until the restored workout is active (its set tracker
  // renders), so completedExercise resolves for ex1.
  const renderActive = async () => {
    const utils = render(<App />)
    await waitFor(() => {
      expect(utils.getByTestId('set-tracker-button-3')).toBeTruthy()
    })
    return utils
  }

  it('falls back to the target reps (not 0) when a set is ended during the countdown', async () => {
    await renderActive()

    // Ending during "Get Ready" reports 0 reps. With no memory yet, the modal
    // must default to the exercise's configured rep target (8), never 0.
    await completeSet(1, 0)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    expect(mockModalCapture.initialReps).toBe(8)
    expect(mockModalCapture.defaultWeightUnit).toBe('kg')
  })

  it('defaults to the reps and unit last saved for the exercise', async () => {
    await renderActive()

    // Log a set: user overrides to plates and 10 reps.
    await completeSet(1, 0)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    await act(async () => {
      mockModalCapture.onSubmit(10, 100, 'plates')
    })
    await waitFor(async () => {
      expect((await loadSetPreferences()).ex1).toEqual({
        weightUnit: 'plates',
        reps: 10,
      })
    })

    // Next set is also ended during the countdown (0 reps). The modal now
    // defaults to the remembered 10 reps and plates — values that can only come
    // from memory, since the config says kg and the fallback reps is 3.
    await completeSet(2, 0)
    await waitFor(() => expect(mockModalCapture.initialReps).toBe(10))
    expect(mockModalCapture.defaultWeightUnit).toBe('plates')
  })

  it('shows the actual counted reps when the timer did count them', async () => {
    await renderActive()

    // Remember 10 reps first.
    await completeSet(1, 0)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    await act(async () => {
      mockModalCapture.onSubmit(10, 100, 'plates')
    })
    await waitFor(async () => {
      expect((await loadSetPreferences()).ex1?.reps).toBe(10)
    })

    // A normally-completed set counted 7 reps: the actual count wins over the
    // remembered 10, but the remembered unit still applies.
    await completeSet(2, 7)
    await waitFor(() => expect(mockModalCapture.initialReps).toBe(7))
    expect(mockModalCapture.defaultWeightUnit).toBe('plates')
  })

  it('does not remember anything when the modal is dismissed without a choice', async () => {
    await renderActive()

    await completeSet(1, 0)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))

    // Dismissing (Android back / tap-away) logs the set with no chosen unit.
    await act(async () => {
      mockModalCapture.onClose()
    })

    expect(await loadSetPreferences()).toEqual({})
  })
})
