import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import App from './App'

// Mock dependencies
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
  Reanimated.ReanimatedLogLevel = {
    warn: 'warn',
    error: 'error',
  }
  return Reanimated
})

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
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

// Mock hooks
const mockUseAuth = jest.fn(() => ({
  user: null,
  initializing: false,
  isSigningIn: false,
  onGoogleButtonPress: jest.fn(),
  disconnectAccount: jest.fn(),
}))
jest.mock('./hooks/useAuth', () => ({
  useAuth: (onSuccess: any) => mockUseAuth(onSuccess),
}))

const mockDataHookValue = {
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
  syncUserData: jest.fn(),
  addHistoryEntry: jest.fn(),
  isSetCompleted: jest.fn(),
  resetSetsFrom: jest.fn(),
  arePreviousSetsCompleted: jest.fn(),
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
  }),
}))

const mockWorkoutTimerValue = {
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
jest.mock('./components/layout/WorkoutSelector', () => () => null)
jest.mock('./components/layout/MainDisplay', () => () => null)
jest.mock('./components/layout/Controls', () => () => null)
jest.mock('./components/layout/RepJumper', () => () => null)
jest.mock('./components/AddSetDetailsModal', () => () => null)
jest.mock('./components/SplashScreen', () => () => null)

jest.mock('./components/HistoryScreen', () => {
  const { Text } = require('react-native')
  return ({ visible }: any) => (visible ? <Text>HISTORY</Text> : null)
})

jest.mock('./components/ProgressScreen', () => {
  const { Text } = require('react-native')
  return ({ visible }: any) => (visible ? <Text>PROGRESS</Text> : null)
})

jest.mock('./components/JournalScreen', () => {
  const { Text } = require('react-native')
  return ({ visible }: any) => (visible ? <Text>JOURNAL</Text> : null)
})

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders splash screen and transitions to main app content when not initializing', async () => {
    const { getByText } = render(<App />)

    // Wait for the app content to mount
    await waitFor(() => {
      expect(getByText('Workout')).toBeTruthy()
    })
  })

  it('switches tabs correctly', async () => {
    const { getByText } = render(<App />)

    await waitFor(() => {
      expect(getByText('Workout')).toBeTruthy()
    })

    // Click on history tab button
    // The bottom nav text or testID can be clicked
    // Let's check how tabs are rendered. The nav bar has text: Workout, History, Progress, Journal, TDEE, etc.
    const historyTabButton = getByText('History')
    fireEvent.press(historyTabButton)

    await waitFor(() => {
      // History tab shows "HISTORY" header
      expect(getByText('HISTORY')).toBeTruthy()
    })

    // Switch to analytics/progress
    const progressTabButton = getByText('Analytics')
    fireEvent.press(progressTabButton)

    await waitFor(() => {
      expect(getByText('PROGRESS')).toBeTruthy()
    })
  })

  it('triggers onAuthSuccess callback and syncs data on mount when user is authenticated', async () => {
    let authCallback: any
    mockUseAuth.mockImplementation((onSuccess) => {
      authCallback = onSuccess
      return {
        user: { uid: 'auth-user-id' } as any,
        initializing: false,
        isSigningIn: false,
        onGoogleButtonPress: jest.fn(),
        disconnectAccount: jest.fn(),
      }
    })

    render(<App />)

    await act(async () => {
      if (authCallback) {
        await authCallback({ uid: 'auth-user-id' })
      }
    })

    expect(mockDataHookValue.syncUserData).toHaveBeenCalled()
    expect(mockDataHookValue.fetchWeightLogs).toHaveBeenCalledWith({
      uid: 'auth-user-id',
    })
  })
  it('calls loadActiveSession on mount to restore workout state', async () => {
    render(<App />)
    await waitFor(() => {
      expect(mockDataHookValue.loadActiveSession).toHaveBeenCalled()
    })
  })
})
