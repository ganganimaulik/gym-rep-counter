import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
// react-test-renderer reports uncaught errors thrown inside effects via
// window.dispatchEvent, which the RN test env doesn't define. Without this
// shim an error in an effect surfaces only as "window.dispatchEvent is not a
// function", masking the real cause. Re-throw so the true stack shows up.
;(global as any).window = (global as any).window || {}
if (typeof (global as any).window.dispatchEvent !== 'function') {
  ;(global as any).window.dispatchEvent = (event: any) => {
    if (event?.error) throw event.error
    return true
  }
}
import App from './App'

// These tests exercise the dynamic-set wiring in App.tsx (the "+" add-set
// button and the long-press remove-set gesture). Unlike App.test.tsx, the real
// WorkoutSelector is rendered so its set-tracker buttons drive App's
// addExtraSet / handleDeleteSet handlers end to end. Only WorkoutSelector's own
// leaf dependencies (picker, icons, toast) are mocked.

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

// WorkoutSelector's picker leaf — render nothing so the surrounding tracker
// stays intact.
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
      exercises: [{ id: 'ex1', name: 'Bench Press', sets: 3, reps: 8 }],
    },
  ],
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
  // Restore an active session on mount so a workout is selected and the
  // set tracker renders without any user interaction.
  loadActiveSession: jest
    .fn()
    .mockResolvedValue({ workoutId: 'w1', exerciseIndex: 0 }),
  clearActiveSession: jest.fn(),
}
jest.mock('./hooks/useData', () => ({
  useData: () => mockDataHookValue,
}))

const mockSpeak = jest.fn()
jest.mock('./hooks/useAudio', () => ({
  useAudio: () => ({
    speak: mockSpeak,
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

const Toast = require('react-native-toast-message')

describe('App — dynamic sets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the shared mock objects to their defaults; individual tests mutate
    // them before rendering to set up specific scenarios.
    mockDataHookValue.todaysCompletions = []
    mockDataHookValue.isSetCompleted.mockReturnValue(false)
    mockDataHookValue.arePreviousSetsCompleted.mockReturnValue(true)
    mockDataHookValue.getNextUncompletedSet.mockReturnValue(1)
    mockDataHookValue.loadActiveSession.mockResolvedValue({
      workoutId: 'w1',
      exerciseIndex: 0,
    })
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

  // Render the app and wait until the restored workout's set tracker appears.
  const renderWithTracker = async () => {
    const utils = render(<App />)
    await waitFor(() => {
      expect(utils.getByTestId('set-tracker-button-3')).toBeTruthy()
    })
    Toast.show.mockClear()
    return utils
  }

  describe('adding sets', () => {
    it('adds a set and shows a confirmation toast when "+" is pressed', async () => {
      const { getByTestId, queryByTestId } = await renderWithTracker()

      // Base exercise has 3 sets; there is no 4th yet.
      expect(queryByTestId('set-tracker-button-4')).toBeNull()

      fireEvent.press(getByTestId('add-set-button'))

      await waitFor(() => {
        expect(getByTestId('set-tracker-button-4')).toBeTruthy()
      })
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Set Added',
          text2: 'Bench Press: 4 sets for this session.',
        }),
      )
    })

    it('adds multiple sets on repeated presses', async () => {
      const { getByTestId, queryByTestId } = await renderWithTracker()

      fireEvent.press(getByTestId('add-set-button'))
      await waitFor(() =>
        expect(getByTestId('set-tracker-button-4')).toBeTruthy(),
      )

      fireEvent.press(getByTestId('add-set-button'))
      await waitFor(() =>
        expect(getByTestId('set-tracker-button-5')).toBeTruthy(),
      )

      expect(queryByTestId('set-tracker-button-6')).toBeNull()
    })
  })

  describe('removing sets', () => {
    it('removes a pending set on long-press and shows a confirmation toast', async () => {
      const { getByTestId, queryByTestId } = await renderWithTracker()

      fireEvent(getByTestId('set-tracker-button-3'), 'longPress')

      await waitFor(() => {
        expect(queryByTestId('set-tracker-button-3')).toBeNull()
      })
      expect(getByTestId('set-tracker-button-2')).toBeTruthy()
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Set Removed',
          text2: 'Bench Press: 2 sets for this session.',
        }),
      )
    })

    it('blocks removing a set that has already been logged', async () => {
      mockDataHookValue.todaysCompletions = [{ exerciseId: 'ex1', set: 1 }]
      mockDataHookValue.isSetCompleted.mockImplementation(
        (_id: string, setNumber: number) => setNumber === 1,
      )

      const { getByTestId } = await renderWithTracker()

      fireEvent(getByTestId('set-tracker-button-1'), 'longPress')

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            text1: 'Set Already Logged',
          }),
        )
      })
      // The set count must be unchanged.
      expect(getByTestId('set-tracker-button-3')).toBeTruthy()
    })

    it('blocks removing the last remaining set', async () => {
      const { getByTestId, queryByTestId } = await renderWithTracker()

      // Trim down to a single set first (3 -> 2 -> 1).
      fireEvent(getByTestId('set-tracker-button-3'), 'longPress')
      await waitFor(() =>
        expect(queryByTestId('set-tracker-button-3')).toBeNull(),
      )
      fireEvent(getByTestId('set-tracker-button-2'), 'longPress')
      await waitFor(() =>
        expect(queryByTestId('set-tracker-button-2')).toBeNull(),
      )

      Toast.show.mockClear()
      // Attempt to remove the only set left.
      fireEvent(getByTestId('set-tracker-button-1'), 'longPress')

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            text1: 'Cannot Remove Set',
          }),
        )
      })
      expect(getByTestId('set-tracker-button-1')).toBeTruthy()
    })

    it('blocks removing the set currently in progress', async () => {
      mockWorkoutTimerValue.isRunning = true
      mockWorkoutTimerValue.currentSet = { value: 3 }

      const { getByTestId } = await renderWithTracker()

      fireEvent(getByTestId('set-tracker-button-3'), 'longPress')

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            text1: 'Set In Progress',
          }),
        )
      })
      expect(getByTestId('set-tracker-button-3')).toBeTruthy()
    })

    it('completes the exercise when the deleted set was the only one left unlogged', async () => {
      // Sets 1 and 2 are logged; resting toward set 3. Deleting the pending set
      // 3 leaves every remaining set logged, so the exercise must finish.
      mockDataHookValue.todaysCompletions = [
        { exerciseId: 'ex1', set: 1 },
        { exerciseId: 'ex1', set: 2 },
      ]
      mockDataHookValue.isSetCompleted.mockImplementation(
        (_id: string, setNumber: number) => setNumber === 1 || setNumber === 2,
      )

      const { getByTestId } = await renderWithTracker()

      fireEvent(getByTestId('set-tracker-button-3'), 'longPress')

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', text1: 'Set Removed' }),
        )
      })
      // Finishing the last exercise wraps up the whole workout.
      expect(mockWorkoutTimerValue.stopWorkout).toHaveBeenCalled()
      expect(mockSpeak).toHaveBeenCalledWith('Workout Complete!')
      expect(mockDataHookValue.clearActiveSession).toHaveBeenCalled()
    })
  })

  it('applies add then remove to the same session delta', async () => {
    // Adding a set (3 -> 4) then removing the newly added set returns the
    // tracker to the routine's original count.
    const { getByTestId, queryByTestId } = await renderWithTracker()

    fireEvent.press(getByTestId('add-set-button'))
    await waitFor(() =>
      expect(getByTestId('set-tracker-button-4')).toBeTruthy(),
    )

    // Long-pressing the 4th (pending) circle drops the delta back to zero.
    fireEvent(getByTestId('set-tracker-button-4'), 'longPress')
    await waitFor(() =>
      expect(queryByTestId('set-tracker-button-4')).toBeNull(),
    )
    expect(getByTestId('set-tracker-button-3')).toBeTruthy()
  })
})
