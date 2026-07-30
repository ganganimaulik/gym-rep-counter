import React from 'react'
import { render, act, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadSetPreferences } from '../utils/exerciseSetPreference'
// See App.dynamicSets.test.tsx: re-throw effect errors so their real stack
// surfaces instead of "window.dispatchEvent is not a function".
;(global as any).window = (global as any).window || {}
if (typeof (global as any).window.dispatchEvent !== 'function') {
  ;(global as any).window.dispatchEvent = (event: any) => {
    if (event?.error) throw event.error
    return true
  }
}
import App from '../App'

// The Set Complete modal offers a variant picker for the exercise just
// performed, so a set can be logged as e.g. "Standing" vs "Sitting". App reads
// those options off currentWorkout — a copy of the routine taken when the
// session started — so these tests also cover a routine edited mid-session:
// adding variants (or any other exercise field) must reach the live session
// instead of leaving it on a stale snapshot. The variant of the last saved set
// is remembered per exercise and preselected on the next one; the real
// exerciseSetPreference util + in-memory AsyncStorage make that a full
// round-trip.

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

jest.mock('../components/WorkoutPicker', () => {
  const { View } = require('react-native')
  return View
})

const mockUseAuth = jest.fn()
jest.mock('../hooks/useAuth', () => ({
  useAuth: (onSuccess: any) => mockUseAuth(onSuccess),
}))

const exercise = (variants?: string[]) => ({
  id: 'ex1',
  name: 'Calf Raise',
  sets: 3,
  reps: 8,
  weightUnit: 'kg',
  ...(variants ? { variants } : {}),
})

const mockDataHookValue: any = {
  settings: {
    volume: 1,
    countdownSeconds: 3,
    restSeconds: 5,
    maxReps: 8,
    maxSets: 2,
    concentricSeconds: 1,
    eccentricSeconds: 2,
    eccentricCountdownEnabled: true,
  },
  workouts: [{ id: 'w1', name: 'Legs', exercises: [exercise()] }],
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
jest.mock('../hooks/useData', () => ({
  useData: () => mockDataHookValue,
}))

jest.mock('../hooks/useAudio', () => ({
  useAudio: () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    queueSpeak: jest.fn(),
    speakEccentric: jest.fn(),
    setAudioSessionMode: jest.fn(),
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
jest.mock('../hooks/useWorkoutTimer', () => ({
  useWorkoutTimer: (...args: any[]) => {
    mockTimerCapture.onSetComplete = args[3]
    return mockWorkoutTimerValue
  },
}))

// Capture the props App feeds the Set Complete modal.
const mockModalCapture: any = {
  visible: false,
  variants: undefined,
  defaultVariant: undefined,
}
jest.mock('../components/AddSetDetailsModal', () => (props: any) => {
  mockModalCapture.visible = props.visible
  mockModalCapture.variants = props.variants
  mockModalCapture.defaultVariant = props.defaultVariant
  mockModalCapture.onSubmit = props.onSubmit
  return null
})

jest.mock('../components/SettingsModal', () => () => null)
jest.mock('../components/WorkoutManagementModal', () => () => null)
jest.mock('../components/layout/MainDisplay', () => () => null)
jest.mock('../components/layout/Controls', () => () => null)
jest.mock('../components/layout/RepJumper', () => () => null)
jest.mock('../components/SplashScreen', () => () => null)
jest.mock('../components/HistoryScreen', () => () => null)
jest.mock('../components/ProgressScreen', () => () => null)
jest.mock('../components/JournalScreen', () => () => null)

const completeSet = (set: number) =>
  act(() => {
    mockTimerCapture.onSetComplete({
      exerciseId: 'ex1',
      reps: 8,
      set,
      startTime: set * 10,
      endTime: set * 10 + 5,
    })
  })

describe('App — variant options on the Set Complete modal', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
    mockTimerCapture.onSetComplete = null
    mockModalCapture.visible = false
    mockModalCapture.variants = undefined
    mockModalCapture.defaultVariant = undefined
    mockDataHookValue.workouts = [
      { id: 'w1', name: 'Legs', exercises: [exercise()] },
    ]
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

  it("passes the exercise's configured variants to the modal", async () => {
    mockDataHookValue.workouts = [
      {
        id: 'w1',
        name: 'Legs',
        exercises: [exercise(['Standing', 'Sitting'])],
      },
    ]
    await renderActive()

    await completeSet(1)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    expect(mockModalCapture.variants).toEqual(['Standing', 'Sitting'])
  })

  it('picks up variants added to the routine mid-session', async () => {
    const { rerender } = await renderActive()

    await completeSet(1)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    expect(mockModalCapture.variants).toBeUndefined()

    // The user configures variants in Workout Management without ending the
    // session. currentWorkout is a snapshot, so it has to be rebuilt from the
    // edited routine — otherwise the picker never shows up for the sets that
    // follow.
    mockDataHookValue.workouts = [
      {
        id: 'w1',
        name: 'Legs',
        exercises: [exercise(['Standing', 'Sitting'])],
      },
    ]
    rerender(<App />)

    await completeSet(2)
    await waitFor(() =>
      expect(mockModalCapture.variants).toEqual(['Standing', 'Sitting']),
    )
  })

  it('defaults to the variant the last set was logged with', async () => {
    mockDataHookValue.workouts = [
      {
        id: 'w1',
        name: 'Legs',
        exercises: [exercise(['Standing', 'Sitting'])],
      },
    ]
    await renderActive()

    // First set has nothing to go on, and is saved as Sitting.
    await completeSet(1)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    expect(mockModalCapture.defaultVariant).toBeUndefined()
    await act(async () => {
      mockModalCapture.onSubmit(15, 40, 'kg', 'Sitting')
    })

    // The next set opens on Sitting, so a run of them needs no re-picking.
    await completeSet(2)
    await waitFor(() => expect(mockModalCapture.defaultVariant).toBe('Sitting'))
  })

  it('forgets the variant once a set is saved without one', async () => {
    mockDataHookValue.workouts = [
      {
        id: 'w1',
        name: 'Legs',
        exercises: [exercise(['Standing', 'Sitting'])],
      },
    ]
    await renderActive()

    await completeSet(1)
    await waitFor(() => expect(mockModalCapture.visible).toBe(true))
    await act(async () => {
      mockModalCapture.onSubmit(15, 40, 'kg', 'Sitting')
    })

    // Set 2 opens on the remembered Sitting; the user deselects it and saves.
    await completeSet(2)
    await waitFor(() => expect(mockModalCapture.defaultVariant).toBe('Sitting'))
    await act(async () => {
      mockModalCapture.onSubmit(15, 40, 'kg', undefined)
    })
    await waitFor(async () => {
      expect((await loadSetPreferences()).ex1?.variant).toBeUndefined()
    })

    // Deselecting has to stick: Sitting must not come back on the next set.
    await completeSet(3)
    await waitFor(() => {
      expect(mockModalCapture.visible).toBe(true)
      expect(mockModalCapture.defaultVariant).toBeUndefined()
    })
  })
})
