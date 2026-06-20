import { renderHook, act } from '@testing-library/react-native'
import { useAnalytics } from '../useAnalytics'
import { DataHook, Settings } from '../useData'
import type { WorkoutSet } from '../../declarations'
import { Timestamp } from 'firebase/firestore'

// Mock the analytics utils
jest.mock('../../utils/analyticsUtils', () => ({
  calculatePRs: jest.fn(() => [
    { exerciseId: 'ex1', exerciseName: 'Bench Press', maxWeight: 100 },
  ]),
  calculateStreak: jest.fn(() => ({
    currentStreak: 2,
    longestStreak: 5,
    lastWorkoutDate: new Date(),
    currentWeekWorkouts: 3,
  })),
  calculateVolume: jest.fn(() => [
    { label: 'Week 1', totalVolume: 5000, workoutCount: 3 },
  ]),
  calculateTrends: jest.fn(() => [
    { date: '2024-01-01', avgWeight: 80, avgReps: 10, setCount: 3 },
  ]),
  getUniqueExercises: jest.fn(() => [{ id: 'ex1', name: 'Bench Press' }]),
}))

// Create a mock history entry
const createMockWorkoutSet = (
  overrides: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  id: 'test-id',
  workoutId: 'workout-1',
  exerciseId: 'ex1',
  exerciseName: 'Bench Press',
  weight: 80,
  reps: 10,
  set: 1,
  date: {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  } as unknown as Timestamp,
  ...overrides,
})

describe('useAnalytics Hook', () => {
  const mockFetchFullHistory = jest.fn()

  const createMockDataHook = (overrides: Partial<DataHook> = {}): DataHook => ({
    settings: {} as Settings,
    workouts: [],
    todaysCompletions: [],
    offlineQueue: [],
    weightLogs: [],
    calorieLogs: [],
    journalEntries: [],
    loadSettings: jest.fn(),
    saveSettings: jest.fn(),
    loadWorkouts: jest.fn(),
    saveWorkouts: jest.fn(),
    addHistoryEntry: jest.fn(),
    updateHistoryEntry: jest.fn(),
    deleteHistoryEntry: jest.fn(),
    fetchHistory: jest.fn(),
    fetchTodaysCompletions: jest.fn(),
    fetchAllTodaysCompletions: jest.fn(),
    isSetCompleted: jest.fn(),
    getNextUncompletedSet: jest.fn(),
    resetSetsFrom: jest.fn(),
    arePreviousSetsCompleted: jest.fn(),
    syncUserData: jest.fn(),
    migrateGuestHistory: jest.fn(),
    syncOfflineQueue: jest.fn(),
    fetchFullHistory: mockFetchFullHistory,
    setWorkouts: jest.fn(),
    setSettings: jest.fn(),
    setOfflineQueue: jest.fn(),
    fetchWeightLogs: jest.fn(),
    addWeightLog: jest.fn(),
    updateWeightLog: jest.fn(),
    deleteWeightLog: jest.fn(),
    migrateGuestWeightLogs: jest.fn(),
    fetchCalorieLogs: jest.fn(),
    addCalorieLog: jest.fn(),
    updateCalorieLog: jest.fn(),
    deleteCalorieLog: jest.fn(),
    migrateGuestCalorieLogs: jest.fn(),
    tdeeConfig: null,
    loadTDEEConfig: jest.fn(),
    saveTDEEConfig: jest.fn(),
    deleteTDEEConfig: jest.fn(),
    migrateGuestJournalEntries: jest.fn(),
    fetchJournalEntries: jest.fn(),
    addJournalEntry: jest.fn(),
    updateJournalEntry: jest.fn(),
    deleteJournalEntry: jest.fn(),
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchFullHistory.mockResolvedValue([createMockWorkoutSet()])
  })

  it('should initialize with default values', () => {
    const mockDataHook = createMockDataHook()
    const { result } = renderHook(() => useAnalytics(mockDataHook))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.prs).toEqual([])
    expect(result.current.streak.currentStreak).toBe(0)
    expect(result.current.weeklyVolume).toEqual([])
    expect(result.current.monthlyVolume).toEqual([])
    expect(result.current.exercises).toEqual([])
  })

  it('should fetch and calculate analytics on refreshAnalytics', async () => {
    const mockDataHook = createMockDataHook()
    const { result } = renderHook(() => useAnalytics(mockDataHook))

    await act(async () => {
      await result.current.refreshAnalytics(null)
    })

    expect(mockFetchFullHistory).toHaveBeenCalledWith(null, 90)
    expect(result.current.prs).toHaveLength(1)
    expect(result.current.streak.currentStreak).toBe(2)
    expect(result.current.weeklyVolume).toHaveLength(1)
    expect(result.current.exercises).toHaveLength(1)
  })

  it('should set loading state during refreshAnalytics', async () => {
    const mockDataHook = createMockDataHook()
    const { result } = renderHook(() => useAnalytics(mockDataHook))

    // Initially not loading
    expect(result.current.isLoading).toBe(false)

    // Create a deferred promise to control timing
    let resolvePromise: (value: WorkoutSet[]) => void
    mockFetchFullHistory.mockImplementation(() => {
      return new Promise<WorkoutSet[]>((resolve) => {
        resolvePromise = resolve
      })
    })

    // Start the refresh but don't await
    let refreshPromise: Promise<void>
    act(() => {
      refreshPromise = result.current.refreshAnalytics(null)
    })

    // Should be loading now
    expect(result.current.isLoading).toBe(true)

    // Resolve the promise
    await act(async () => {
      resolvePromise!([])
      await refreshPromise
    })

    // Should be done loading
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle errors during refreshAnalytics', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    mockFetchFullHistory.mockRejectedValue(new Error('Network error'))

    const mockDataHook = createMockDataHook()
    const { result } = renderHook(() => useAnalytics(mockDataHook))

    await act(async () => {
      await result.current.refreshAnalytics(null)
    })

    expect(result.current.error).toBe('Failed to load analytics data')
    expect(result.current.isLoading).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to refresh analytics',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('should return trends for a specific exercise via getExerciseTrends', async () => {
    const mockDataHook = createMockDataHook()
    const { result } = renderHook(() => useAnalytics(mockDataHook))

    // First refresh to populate history
    await act(async () => {
      await result.current.refreshAnalytics(null)
    })

    const trends = result.current.getExerciseTrends('ex1')
    expect(trends).toHaveLength(1)
    expect(trends[0].avgWeight).toBe(80)
  })
})
