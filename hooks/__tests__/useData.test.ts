import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import { useData, Settings, Workout } from '../useData'
import { getDefaultWorkouts } from '../../utils/defaultWorkouts'
import getLocalDateString from '../../utils/getLocalDateString'

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest
    .fn()
    .mockImplementation(() => ({ id: `mock-doc-${Math.random()}` })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  documentId: jest.fn(),
  Timestamp: class {
    seconds: number
    nanoseconds: number
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }

    static now: any = jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    }))

    static fromDate: any = jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }))

    static fromMillis: any = jest.fn((millis: number) => ({
      toDate: () => new Date(millis),
      toMillis: () => millis,
    }))
    toDate() {
      return new Date(this.seconds * 1000)
    }
    toMillis() {
      return this.seconds * 1000 + this.nanoseconds / 1000000
    }
  },
  writeBatch: jest.fn(),
  deleteField: jest.fn(),
}))

const mockBatch = {
  set: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
}
;(writeBatch as jest.Mock).mockReturnValue(mockBatch)

// Mock default workouts
jest.mock('../../utils/defaultWorkouts')
const mockDefaultWorkouts = [
  { id: '1', name: 'Default Workout', exercises: [] },
]
;(getDefaultWorkouts as jest.Mock).mockReturnValue(mockDefaultWorkouts)

describe('useData Hook', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@test.com',
    displayName: 'Test User',
  } as any
  const defaultSettings: Settings = {
    countdownSeconds: 5,
    restSeconds: 60,
    maxReps: 15,
    maxSets: 3,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
    countdownAnnouncementThreshold: 15,
    volume: 1.0,
    statRemindersEnabled: true,
    statRemindersUseAutoSleep: true,
    statRemindersSleepStart: 23,
    statRemindersSleepEnd: 7,
    supplementSuggestions: [
      { name: 'Creatine', defaultDosage: '5g' },
      { name: 'Whey Protein', defaultDosage: '1 scoop' },
      { name: 'Pre-workout', defaultDosage: '1 scoop' },
      { name: 'Fish Oil', defaultDosage: '1 cap' },
      { name: 'Vitamin D3', defaultDosage: '5000 IU' },
      { name: 'Caffeine', defaultDosage: '200mg' },
      { name: 'Multivitamin', defaultDosage: '1 tab' },
      { name: 'Zinc', defaultDosage: '50mg' },
      { name: 'Magnesium', defaultDosage: '400mg' },
      { name: 'BCAA', defaultDosage: '5g' },
      { name: 'Ashwagandha', defaultDosage: '600mg' },
      { name: 'Beta-Alanine', defaultDosage: '3g' },
      { name: 'Citrulline Malate', defaultDosage: '6g' },
      { name: 'L-Glutamine', defaultDosage: '5g' },
      { name: 'L-Theanine', defaultDosage: '200mg' },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockBatch.set.mockClear()
    mockBatch.delete.mockClear()
    mockBatch.commit.mockClear()
  })

  describe('Settings', () => {
    it('should load default settings if none are in storage', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.loadSettings()
      })

      expect(result.current.settings).toEqual(defaultSettings)
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('repCounterSettings')
    })

    it('should load settings from AsyncStorage', async () => {
      const customSettings = { ...defaultSettings, countdownSeconds: 10 }
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(customSettings),
      )
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.loadSettings()
      })

      expect(result.current.settings).toEqual(customSettings)
    })

    it('should save settings to AsyncStorage and Firestore', async () => {
      const { result } = renderHook(() => useData())
      const newSettings = { ...defaultSettings, volume: 0.5 }

      await act(async () => {
        await result.current.saveSettings(newSettings, mockUser)
      })

      expect(result.current.settings).toEqual(newSettings)
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'repCounterSettings',
        JSON.stringify(newSettings),
      )
      expect(setDoc).toHaveBeenCalled()
    })
  })

  describe('Workouts', () => {
    it('should load default workouts if none are in storage', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.loadWorkouts()
      })

      expect(result.current.workouts).toEqual(mockDefaultWorkouts)
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(mockDefaultWorkouts),
      )
    })

    it('should load workouts from AsyncStorage', async () => {
      const customWorkouts: Workout[] = [
        { id: '2', name: 'My Workout', exercises: [] },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(customWorkouts),
      )
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.loadWorkouts()
      })

      expect(result.current.workouts).toEqual(customWorkouts)
    })

    it('should save workouts to AsyncStorage and Firestore', async () => {
      const { result } = renderHook(() => useData())
      const newWorkouts: Workout[] = [
        { id: '3', name: 'New Workout', exercises: [] },
      ]

      await act(async () => {
        await result.current.saveWorkouts(newWorkouts, mockUser)
      })

      expect(result.current.workouts).toEqual(newWorkouts)
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(newWorkouts),
      )
      expect(setDoc).toHaveBeenCalled()
    })
  })

  describe('Workout History & Completions', () => {
    const exerciseId = 'ex1'
    const workoutId = 'w1'

    it('should add a history entry and update todaysCompletions', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })

      const entry = {
        workoutId,
        exerciseId,
        exerciseName: 'Test Exercise',
        reps: 10,
        weight: 50,
      }
      const setNumber = 1
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          entry,
          setNumber,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ ...entry, set: setNumber }),
      )
      expect(result.current.todaysCompletions).toHaveLength(1)
      expect(result.current.todaysCompletions[0]).toMatchObject({
        ...entry,
        set: setNumber,
      })
    })

    it("should fetch today's completions for a given exercise", async () => {
      const mockCompletions = [
        { id: 'doc1', data: () => ({ exerciseId, set: 1 }) },
        { id: 'doc3', data: () => ({ exerciseId, set: 2 }) },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({ docs: mockCompletions })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, exerciseId)
      })

      expect(getDocs).toHaveBeenCalled()
      expect(result.current.todaysCompletions).toHaveLength(2)
      expect(
        result.current.todaysCompletions.every(
          (c) => c.exerciseId === exerciseId,
        ),
      ).toBe(true)
    })

    it('should correctly identify if a set is completed', async () => {
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      await act(async () => {
        ;(addDoc as jest.Mock).mockResolvedValue({ id: 'doc1' })
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true)
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false)
    })

    it('should get the next uncompleted set', async () => {
      const { result } = renderHook(() => useData())
      const startTime = Date.now()
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(1)

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2)

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          3,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2)

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(4)
    })

    it('should reset sets from a given set number', async () => {
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      // Mock addDoc to return unique IDs for each call
      ;(addDoc as jest.Mock)
        .mockResolvedValueOnce({ id: 'doc1' })
        .mockResolvedValueOnce({ id: 'doc2' })
        .mockResolvedValueOnce({ id: 'doc3' })

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          3,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      await act(async () => {
        await result.current.resetSetsFrom(exerciseId, 2, mockUser)
      })

      expect(mockBatch.delete).toHaveBeenCalledTimes(2)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
      expect(result.current.todaysCompletions).toHaveLength(1)
      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true)
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false)
      expect(result.current.isSetCompleted(exerciseId, 3)).toBe(false)
    })
    it('should prevent cross-exercise pollution in todays completions', async () => {
      const { result } = renderHook(() => useData())
      const exerciseA = 'exA'
      const exerciseB = 'exB'

      const mockCompletionsA = [
        { id: 'doc1', data: () => ({ exerciseId: exerciseA, set: 1 }) },
        { id: 'doc3', data: () => ({ exerciseId: exerciseA, set: 2 }) },
      ]

      // Mock initial call for Exercise A
      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockCompletionsA })

      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, exerciseA)
      })

      // The hook might filter locally or rely on the query.
      // If logic relies on query (where calls), we verify the query was constructed correctly.
      // Or if it filters the results, we check result.current.todaysCompletions.
      // Assuming existing implementation processes the returned docs:
      expect(
        result.current.todaysCompletions.every(
          (c) => c.exerciseId === exerciseA,
        ),
      ).toBe(true)
      expect(result.current.todaysCompletions).toHaveLength(2)

      // Test searching for Exercise B
      const mockCompletionsB = [
        { id: 'doc2', data: () => ({ exerciseId: exerciseB, set: 1 }) },
      ]
      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockCompletionsB })

      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, exerciseB)
      })
      expect(
        result.current.todaysCompletions.every(
          (c) => c.exerciseId === exerciseB,
        ),
      ).toBe(true)
      expect(result.current.todaysCompletions).toHaveLength(1)
    })

    it('should handle undefined or invalid startTime gracefully', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const now = Date.now()

      // Case 1: 0 startTime — should be saved as null (Firestore rejects undefined)
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test',
            reps: 10,
            weight: 50,
          },
          1,
          0,
          now,
          mockUser,
        )
      })

      expect(addDoc).toHaveBeenNthCalledWith(
        1,
        undefined, // first arg is collection ref (mocked or ignored usually)
        expect.objectContaining({ startTime: null }),
      )

      // Case 2: Negative startTime — should also be saved as null
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test',
            reps: 10,
            weight: 50,
          },
          2,
          -1,
          now,
          mockUser,
        )
      })
      expect(addDoc).toHaveBeenCalledTimes(2)
      expect(addDoc).toHaveBeenNthCalledWith(
        2,
        undefined,
        expect.objectContaining({ startTime: null }),
      )
    })

    it('should prevent duplicate addHistoryEntry calls with same dedup key', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'doc-1' })
      const startTime = Date.now()
      const endTime = startTime + 1000

      // First call should succeed
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          endTime,
          mockUser,
        )
      })

      expect(addDoc).toHaveBeenCalledTimes(1)
      expect(result.current.todaysCompletions).toHaveLength(1)

      // Second call with same exerciseId, set, and endTime should be blocked
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          endTime,
          mockUser,
        )
      })

      // addDoc should still have been called only once
      expect(addDoc).toHaveBeenCalledTimes(1)
      // todaysCompletions should still have only one entry
      expect(result.current.todaysCompletions).toHaveLength(1)
    })

    it('should allow different sets with same endTime (no false dedup)', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock)
        .mockResolvedValueOnce({ id: 'doc-1' })
        .mockResolvedValueOnce({ id: 'doc-2' })
      const startTime = Date.now()
      const endTime = startTime + 1000

      // Set 1
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          endTime,
          mockUser,
        )
      })

      // Set 2 (different set number, same endTime — should NOT be blocked)
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          startTime,
          endTime,
          mockUser,
        )
      })

      expect(addDoc).toHaveBeenCalledTimes(2)
      expect(result.current.todaysCompletions).toHaveLength(2)
    })

    it('should allow saving history without a workoutId', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'doc-no-workout' })
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: null as any, // Simulate no workout
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ workoutId: null }),
      )
    })
  })

  describe('User Data Sync', () => {
    it('should sync settings, workouts, and TDEE config from firestore for an existing user', async () => {
      const firestoreData = {
        settings: { ...defaultSettings, restSeconds: 90 },
        workouts: [
          { id: 'firebase-workout', name: 'Firebase Workout', exercises: [] },
        ],
        tdeeConfig: {
          gender: 'male',
          weight: 80,
          height: 180,
        },
      }
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => firestoreData,
      })

      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.syncUserData(mockUser, {} as Settings, [])
      })

      expect(result.current.settings).toEqual(firestoreData.settings)
      expect(result.current.workouts).toEqual(firestoreData.workouts)
      expect(result.current.tdeeConfig).toEqual(firestoreData.tdeeConfig)
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'setCompletions',
        expect.any(String),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'repCounterSettings',
        JSON.stringify(firestoreData.settings),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(firestoreData.workouts),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'tdeeConfig',
        JSON.stringify(firestoreData.tdeeConfig),
      )
    })

    it('should upload local data for a new user', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => false })

      const { result } = renderHook(() => useData())
      const localSettings = { ...defaultSettings, countdownSeconds: 2 }
      const localWorkouts = [
        { id: 'local-workout', name: 'Local Workout', exercises: [] },
      ]

      await act(async () => {
        await result.current.syncUserData(
          mockUser,
          localSettings,
          localWorkouts,
        )
      })

      const setDocCall = (setDoc as jest.Mock).mock.calls.find(
        (call) => call[1] && call[1].settings,
      )
      expect(setDocCall).toBeDefined()
      expect(setDocCall[1]).not.toHaveProperty('setCompletions')
      expect(setDocCall[1]).toHaveProperty('settings', localSettings)
      expect(setDocCall[1]).toHaveProperty('workouts', localWorkouts)
    })

    it('should migrate guest TDEE config to Firestore on sync', async () => {
      const mockTDEEConfig = {
        gender: 'male',
        weight: 80,
        height: 180,
      }
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'tdeeConfig')
          return Promise.resolve(JSON.stringify(mockTDEEConfig))
        return Promise.resolve(null)
      })
      ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => false })

      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.syncUserData(mockUser, {} as Settings, [])
      })

      expect(setDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tdeeConfig: mockTDEEConfig }),
        { merge: true },
      )
    })

    it('should migrate guest history to firestore', async () => {
      const guestHistory = [
        {
          id: 'guest-1',
          exerciseId: 'ex1',
          set: 1,
          date: { seconds: 1672531200, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => false }) // Simulate new user
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.migrateGuestHistory(mockUser)
      })

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('guestHistory')
      expect(writeBatch).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('guestHistory')
    })

    it('should handle guest history migration failure', async () => {
      const error = new Error('Migration failed')
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(error)
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.migrateGuestHistory(mockUser)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to migrate guest history',
        error,
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Guest User Data', () => {
    it('should add history entry for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())
      const entry = {
        workoutId: 'w1',
        exerciseId: 'ex1',
        exerciseName: 'Test Exercise',
        reps: 10,
        weight: 50,
      }
      const setNumber = 1
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          entry,
          setNumber,
          startTime,
          startTime + 1000,
          null,
        )
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('todaysCompletions'),
        expect.any(String),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        expect.any(String),
      )
      expect(result.current.todaysCompletions).toHaveLength(1)
    })

    it('should fetch history for guest user', async () => {
      const guestHistory = [
        {
          id: 'guest-1',
          exerciseId: 'ex1',
          set: 1,
          date: { seconds: 1672531200, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(null as any)
      })

      expect(history).toHaveLength(1)
      expect(history[0].id).toBe('guest-1')
    })
  })

  describe('Authenticated User History Pagination & Tiebreaker', () => {
    it('should build query with orderBy date/documentId and startAfter date/id', async () => {
      const { result } = renderHook(() => useData())
      const {
        orderBy,
        documentId,
        startAfter,
        limit,
        getDocs,
      } = require('firebase/firestore')

      const lastVisibleMock: any = {
        id: 'h2',
        date: { seconds: 90, nanoseconds: 0 },
      }

      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] })

      await act(async () => {
        await result.current.fetchHistory(mockUser, lastVisibleMock)
      })

      expect(orderBy).toHaveBeenCalledWith('date', 'desc')
      expect(documentId).toHaveBeenCalled()
      expect(startAfter).toHaveBeenCalledWith(
        lastVisibleMock.date,
        lastVisibleMock.id,
      )
      expect(limit).toHaveBeenCalledWith(20)
    })

    it('returns empty array when getDocs throws', async () => {
      const { result } = renderHook(() => useData())
      const { getDocs } = require('firebase/firestore')
      ;(getDocs as jest.Mock).mockRejectedValueOnce(
        new Error('Firestore error'),
      )

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(mockUser, undefined)
      })

      expect(history).toEqual([])
    })
  })

  describe('Guest History Pagination & Sorting', () => {
    it('returns second page of 20 starting after lastVisible.id', async () => {
      const guestHistory = Array.from({ length: 30 }, (_, i) => ({
        id: `guest-${i}`,
        exerciseId: 'ex1',
        set: 1,
        date: { seconds: 1000 - i, nanoseconds: 0 },
      }))

      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(null, {
          id: 'guest-9',
          date: { seconds: 991, nanoseconds: 0 },
        } as any)
      })

      // guest-9 is at index 9, so next page should start at index 10 (guest-10)
      expect(history).toHaveLength(20)
      expect(history[0].id).toBe('guest-10')
      expect(history[19].id).toBe('guest-29')
    })

    it('returns [] when lastVisible.id is beyond the end', async () => {
      const guestHistory = Array.from({ length: 5 }, (_, i) => ({
        id: `guest-${i}`,
        exerciseId: 'ex1',
        set: 1,
        date: { seconds: 1000 - i, nanoseconds: 0 },
      }))

      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(null, {
          id: 'guest-4',
          date: { seconds: 996, nanoseconds: 0 },
        } as any)
      })

      expect(history).toEqual([])
    })

    it('starts from index 0 when lastVisible.id is not found in stored history', async () => {
      const guestHistory = Array.from({ length: 5 }, (_, i) => ({
        id: `guest-${i}`,
        exerciseId: 'ex1',
        set: 1,
        date: { seconds: 1000 - i, nanoseconds: 0 },
      }))

      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(null, {
          id: 'guest-nonexistent',
          date: { seconds: 996, nanoseconds: 0 },
        } as any)
      })

      expect(history).toHaveLength(5)
      expect(history[0].id).toBe('guest-0')
    })

    it('sorts entries descending by date regardless of insertion order', async () => {
      const unsortedHistory = [
        {
          id: 'guest-old',
          exerciseId: 'ex1',
          set: 1,
          date: { seconds: 100, nanoseconds: 0 },
        },
        {
          id: 'guest-new',
          exerciseId: 'ex1',
          set: 1,
          date: { seconds: 300, nanoseconds: 0 },
        },
        {
          id: 'guest-mid',
          exerciseId: 'ex1',
          set: 1,
          date: { seconds: 200, nanoseconds: 0 },
        },
      ]

      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(unsortedHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())

      let history: any
      await act(async () => {
        history = await result.current.fetchHistory(null)
      })

      expect(history).toHaveLength(3)
      expect(history[0].id).toBe('guest-new')
      expect(history[1].id).toBe('guest-mid')
      expect(history[2].id).toBe('guest-old')
    })
  })

  describe('Offline Queue', () => {
    it('should add entry to offline queue when firestore fails', async () => {
      ;(addDoc as jest.Mock).mockRejectedValue(
        new Error('Firestore unavailable'),
      )
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())

      const entry = {
        workoutId: 'w1',
        exerciseId: 'ex1',
        exerciseName: 'Test Exercise',
        reps: 10,
        weight: 50,
      }
      const setNumber = 1
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          entry,
          setNumber,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      expect(result.current.offlineQueue).toHaveLength(1)
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offlineQueue',
        expect.any(String),
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save history entry, queuing offline.',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it('should sync offline queue to firestore', async () => {
      const { result } = renderHook(() => useData())

      const offlineEntry: any = {
        id: 'offline-1',
        exerciseId: 'ex1',
        set: 1,
        date: { seconds: 1672531200, nanoseconds: 0 },
      }

      await act(async () => {
        result.current.setOfflineQueue([offlineEntry])
      })

      await act(async () => {
        await result.current.syncOfflineQueue(mockUser)
      })

      expect(writeBatch).toHaveBeenCalled()
      expect(mockBatch.set).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offlineQueue')
      expect(result.current.offlineQueue).toHaveLength(0)
    })

    it('should not sync empty offline queue', async () => {
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.syncOfflineQueue(mockUser)
      })

      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('should handle offline queue sync failure', async () => {
      ;(mockBatch.commit as jest.Mock).mockRejectedValue(
        new Error('Sync failed'),
      )
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())

      const offlineEntry: any = { id: 'offline-1' }

      await act(async () => {
        result.current.setOfflineQueue([offlineEntry])
      })

      await act(async () => {
        await result.current.syncOfflineQueue(mockUser)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to sync offline queue',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it('should not commit the same queue twice when syncs overlap', async () => {
      const { result } = renderHook(() => useData())

      let resolveCommit!: () => void
      mockBatch.commit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveCommit = resolve
          }),
      )

      const offlineEntry: any = { id: 'offline-1' }
      await act(async () => {
        result.current.setOfflineQueue([offlineEntry])
      })

      await act(async () => {
        const first = result.current.syncOfflineQueue(mockUser)
        const second = result.current.syncOfflineQueue(mockUser)
        resolveCommit()
        await Promise.all([first, second])
      })

      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
      expect(mockBatch.set).toHaveBeenCalledTimes(1)
      expect(result.current.offlineQueue).toHaveLength(0)
    })

    it('should preserve entries queued while a sync is in flight', async () => {
      const { result } = renderHook(() => useData())

      let resolveCommit!: () => void
      mockBatch.commit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveCommit = resolve
          }),
      )

      const firstEntry: any = { id: 'offline-1' }
      const lateEntry: any = { id: 'offline-2' }
      await act(async () => {
        result.current.setOfflineQueue([firstEntry])
      })

      await act(async () => {
        const syncPromise = result.current.syncOfflineQueue(mockUser)
        result.current.setOfflineQueue((prev) => [...prev, lateEntry])
        resolveCommit()
        await syncPromise
      })

      expect(result.current.offlineQueue).toHaveLength(1)
      expect(result.current.offlineQueue[0].id).toBe('offline-2')
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('offlineQueue')
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offlineQueue',
        JSON.stringify([lateEntry]),
      )
    })
  })

  describe('Update and Delete History Entry', () => {
    it('should update history entry for authenticated user', async () => {
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.updateHistoryEntry(
          'entry-id',
          { reps: 12, weight: 60 },
          mockUser,
        )
      })

      expect(updateDoc).toHaveBeenCalled()
    })

    it('should update guestHistory, todaysCompletions keys, and in-memory state for guest user', async () => {
      const guestHistory = [
        {
          id: 'entry-1',
          exerciseId: 'ex1',
          reps: 10,
          weight: 50,
          date: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        },
      ]
      const todayKey = `todaysCompletions-${getLocalDateString()}`
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        if (key === todayKey)
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchTodaysCompletions(null, 'ex1')
      })

      await act(async () => {
        await result.current.updateHistoryEntry(
          'entry-1',
          { reps: 15, weight: 60 },
          null,
        )
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        expect.any(String),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        todayKey,
        expect.any(String),
      )
      expect(result.current.todaysCompletions).toHaveLength(1)
      expect(result.current.todaysCompletions[0].reps).toBe(15)
      expect(result.current.todaysCompletions[0].weight).toBe(60)
    })

    it('should delete guestHistory, todaysCompletions keys, and in-memory state for guest user', async () => {
      const guestHistory = [
        {
          id: 'entry-1',
          exerciseId: 'ex1',
          reps: 10,
          weight: 50,
          date: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        },
      ]
      const todayKey = `todaysCompletions-${getLocalDateString()}`
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        if (key === todayKey)
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchTodaysCompletions(null, 'ex1')
      })

      await act(async () => {
        await result.current.deleteHistoryEntry('entry-1', null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        JSON.stringify([]),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        todayKey,
        JSON.stringify([]),
      )
      expect(result.current.todaysCompletions).toHaveLength(0)
    })

    it('should leave todaysCompletions untouched when firestore write fails on update/delete', async () => {
      ;(updateDoc as jest.Mock).mockRejectedValueOnce(
        new Error('Update failed'),
      )
      ;(deleteDoc as jest.Mock).mockRejectedValueOnce(
        new Error('Delete failed'),
      )
      ;(addDoc as jest.Mock).mockResolvedValueOnce({ id: 'doc1' })

      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      // Attempt update
      await act(async () => {
        await result.current.updateHistoryEntry('doc1', { reps: 20 }, mockUser)
      })

      expect(result.current.todaysCompletions[0].reps).toBe(10)

      // Attempt delete
      await act(async () => {
        await result.current.deleteHistoryEntry('doc1', mockUser)
      })

      expect(result.current.todaysCompletions).toHaveLength(1)

      consoleErrorSpy.mockRestore()
    })

    it('guest addHistoryEntry appends to both keys and bumps historyVersion', async () => {
      const todayKey = `todaysCompletions-${getLocalDateString()}`
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())

      const versionBefore = result.current.historyVersion

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          Date.now(),
          Date.now() + 1000,
          null,
        )
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        expect.any(String),
      )
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        todayKey,
        expect.any(String),
      )
      expect(result.current.historyVersion).toBe(versionBefore + 1)
    })

    it('should reflect entry updates in todaysCompletions for authenticated user', async () => {
      ;(addDoc as jest.Mock).mockResolvedValueOnce({ id: 'doc1' })
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      await act(async () => {
        await result.current.updateHistoryEntry(
          'doc1',
          { reps: 15, weight: 60 },
          mockUser,
        )
      })

      expect(result.current.todaysCompletions).toHaveLength(1)
      expect(result.current.todaysCompletions[0].reps).toBe(15)
      expect(result.current.todaysCompletions[0].weight).toBe(60)
    })

    it('should remove a deleted entry from todaysCompletions for authenticated user', async () => {
      ;(addDoc as jest.Mock).mockResolvedValueOnce({ id: 'doc1' })
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      expect(result.current.isSetCompleted('ex1', 1)).toBe(true)

      await act(async () => {
        await result.current.deleteHistoryEntry('doc1', mockUser)
      })

      expect(result.current.todaysCompletions).toHaveLength(0)
      expect(result.current.isSetCompleted('ex1', 1)).toBe(false)
    })
  })

  describe('resetSetsFrom (guest)', () => {
    it("should only delete today's entries, preserving previous days' history", async () => {
      const baseEntry = { exerciseId: 'ex1', reps: 10, weight: 50 }
      const oldEntry = {
        ...baseEntry,
        id: 'old-day-set2',
        set: 2,
        date: { seconds: 1672531200, nanoseconds: 0 },
      }
      const todaySet1 = {
        ...baseEntry,
        id: 'today-set1',
        set: 1,
        date: { seconds: 1672617600, nanoseconds: 0 },
      }
      const todaySet2 = {
        ...baseEntry,
        id: 'today-set2',
        set: 2,
        date: { seconds: 1672617700, nanoseconds: 0 },
      }
      const todayKey = `todaysCompletions-${getLocalDateString()}`
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === todayKey)
          return Promise.resolve(JSON.stringify([todaySet1, todaySet2]))
        if (key === 'guestHistory')
          return Promise.resolve(
            JSON.stringify([oldEntry, todaySet1, todaySet2]),
          )
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.resetSetsFrom('ex1', 2, null)
      })

      const historyWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        ([key]) => key === 'guestHistory',
      )
      expect(historyWrite).toBeDefined()
      const savedHistory = JSON.parse(historyWrite![1])
      expect(savedHistory.map((e: { id: string }) => e.id).sort()).toEqual([
        'old-day-set2',
        'today-set1',
      ])

      const todayWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        ([key]) => key === todayKey,
      )
      expect(todayWrite).toBeDefined()
      expect(
        JSON.parse(todayWrite![1]).map((e: { id: string }) => e.id),
      ).toEqual(['today-set1'])

      // History screen refreshes on version change
      expect(result.current.historyVersion).toBe(1)
    })
  })

  describe('resetSetsFrom (authenticated)', () => {
    it('should bump historyVersion so the history screen refreshes', async () => {
      // An earlier test leaves commit mocked as rejected; restore success
      mockBatch.commit.mockResolvedValue(undefined)
      ;(addDoc as jest.Mock).mockResolvedValueOnce({ id: 'doc1' })
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId: 'w1',
            exerciseId: 'ex1',
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })
      const versionBefore = result.current.historyVersion

      await act(async () => {
        await result.current.resetSetsFrom('ex1', 1, mockUser)
      })

      expect(result.current.historyVersion).toBe(versionBefore + 1)
    })

    it("deletes only today's entries for the given exercise with set >= N", async () => {
      mockBatch.commit.mockResolvedValue(undefined)
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      // Seed mock completions
      const sets = [
        {
          id: 'set-ex1-s1',
          exerciseId: 'ex1',
          set: 1,
          reps: 10,
          weight: 50,
          date: { seconds: Math.floor(startTime / 1000) },
        },
        {
          id: 'set-ex1-s2',
          exerciseId: 'ex1',
          set: 2,
          reps: 10,
          weight: 50,
          date: { seconds: Math.floor(startTime / 1000) },
        },
        {
          id: 'set-ex2-s2',
          exerciseId: 'ex2',
          set: 2,
          reps: 10,
          weight: 50,
          date: { seconds: Math.floor(startTime / 1000) },
        },
      ]

      ;(getDocs as jest.Mock).mockResolvedValueOnce({
        docs: sets.map((s) => ({
          id: s.id,
          data: () => s,
        })),
      })

      // Fetch completions to populate in-memory state
      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, 'ex1')
      })

      mockBatch.delete.mockClear()
      const originalDoc = (doc as jest.Mock).getMockImplementation()
      ;(doc as jest.Mock).mockImplementation(
        (_db, _collection, _uid, _sub, id) => ({ id }),
      )

      await act(async () => {
        await result.current.resetSetsFrom('ex1', 2, mockUser)
      })

      expect(mockBatch.delete).toHaveBeenCalledTimes(1)
      const deletedRef = mockBatch.delete.mock.calls[0][0]
      expect(deletedRef.id).toBe('set-ex1-s2')
      ;(doc as jest.Mock).mockImplementation(originalDoc)
    })
  })

  describe('arePreviousSetsCompleted', () => {
    const exerciseId = 'ex1'
    const workoutId = 'w1'

    it('should return true for set 1 (no previous sets)', () => {
      const { result } = renderHook(() => useData())
      expect(result.current.arePreviousSetsCompleted(exerciseId, 1)).toBe(true)
    })

    it('should return true when all previous sets are completed', async () => {
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      ;(addDoc as jest.Mock)
        .mockResolvedValueOnce({ id: 'doc1' })
        .mockResolvedValueOnce({ id: 'doc2' })

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      expect(result.current.arePreviousSetsCompleted(exerciseId, 3)).toBe(true)
    })

    it('should return false when a previous set is missing', async () => {
      const { result } = renderHook(() => useData())
      const startTime = Date.now()

      ;(addDoc as jest.Mock).mockResolvedValueOnce({ id: 'doc1' })

      // Complete set 1, skip set 2
      await act(async () => {
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          startTime,
          startTime + 1000,
          mockUser,
        )
      })

      // Trying to start set 3 without set 2 completed
      expect(result.current.arePreviousSetsCompleted(exerciseId, 3)).toBe(false)
    })
  })

  describe('fetchAllTodaysCompletions', () => {
    it('should fetch all completions for today for authenticated user', async () => {
      const mockCompletions = [
        { id: 'doc1', data: () => ({ exerciseId: 'ex1', set: 1 }) },
        { id: 'doc2', data: () => ({ exerciseId: 'ex2', set: 1 }) },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({ docs: mockCompletions })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.fetchAllTodaysCompletions(mockUser)
      })

      expect(getDocs).toHaveBeenCalled()
      expect(result.current.todaysCompletions).toHaveLength(2)
    })

    it('should set empty array when user is null', async () => {
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.fetchAllTodaysCompletions(null)
      })

      expect(result.current.todaysCompletions).toEqual([])
    })
  })

  describe('fetchFullHistory', () => {
    it('should fetch history with date filter for authenticated user', async () => {
      const mockHistory = [
        { id: 'doc1', data: () => ({ exerciseId: 'ex1', reps: 10 }) },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({ docs: mockHistory })
      const { result } = renderHook(() => useData())

      let history
      await act(async () => {
        history = await result.current.fetchFullHistory(mockUser, 30)
      })

      expect(getDocs).toHaveBeenCalled()
      expect(history).toHaveLength(1)
    })

    it('should fetch filtered history for guest user', async () => {
      const now = new Date()
      const guestHistory = [
        {
          id: 'recent',
          exerciseId: 'ex1',
          reps: 10,
          date: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      let history
      await act(async () => {
        history = await result.current.fetchFullHistory(null, 30)
      })

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('guestHistory')
      expect(history).toHaveLength(1)
    })

    it('should return empty array on error', async () => {
      ;(getDocs as jest.Mock).mockRejectedValue(new Error('Fetch failed'))
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())

      let history
      await act(async () => {
        history = await result.current.fetchFullHistory(mockUser, 30)
      })

      expect(history).toEqual([])
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Weight Logs', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      mockBatch.commit.mockResolvedValue(undefined)
    })

    it('should fetch weight logs for guest user', async () => {
      const guestLogs = [
        { id: '1', weight: 80, date: { seconds: 1672531200, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())

      let logs
      await act(async () => {
        logs = await result.current.fetchWeightLogs(null)
      })

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('guestWeightLogs')
      expect(logs).toHaveLength(1)
      expect(logs![0].weight).toBe(80)
      expect(result.current.weightLogs).toHaveLength(1)
    })

    it('should fetch weight logs for logged-in user from firestore', async () => {
      const dbLogs = [
        {
          id: '1',
          weight: 85,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ weight: log.weight, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())

      let logs
      await act(async () => {
        logs = await result.current.fetchWeightLogs(mockUser)
      })

      expect(getDocs).toHaveBeenCalled()
      expect(logs).toHaveLength(1)
      expect(logs![0].weight).toBe(85)
      expect(result.current.weightLogs).toHaveLength(1)
    })

    it('should add weight log for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.addWeightLog(75, new Date(), null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestWeightLogs',
        expect.stringContaining('75'),
      )
      expect(result.current.weightLogs).toHaveLength(1)
      expect(result.current.weightLogs[0].weight).toBe(75)
    })

    it('should add weight log for logged-in user in firestore', async () => {
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.addWeightLog(78, new Date(), mockUser)
      })

      expect(addDoc).toHaveBeenCalled()
      expect(result.current.weightLogs).toHaveLength(1)
      expect(result.current.weightLogs[0].id).toBe('new-doc-id')
      expect(result.current.weightLogs[0].weight).toBe(78)
    })

    it('should update weight log for guest user', async () => {
      const guestLogs = [
        { id: '1', weight: 80, date: { seconds: 1672531200, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())

      // fetch first to populate local state
      await act(async () => {
        await result.current.fetchWeightLogs(null)
      })

      await act(async () => {
        await result.current.updateWeightLog('1', 82, new Date(), null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestWeightLogs',
        expect.stringContaining('82'),
      )
      expect(result.current.weightLogs[0].weight).toBe(82)
    })

    it('should update weight log for logged-in user in firestore', async () => {
      ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
      const dbLogs = [
        {
          id: '1',
          weight: 80,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ weight: log.weight, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())

      // fetch first to populate state
      await act(async () => {
        await result.current.fetchWeightLogs(mockUser)
      })

      await act(async () => {
        await result.current.updateWeightLog('1', 83, new Date(), mockUser)
      })

      expect(updateDoc).toHaveBeenCalled()
      expect(result.current.weightLogs[0].weight).toBe(83)
    })

    it('should delete weight log for guest user', async () => {
      const guestLogs = [
        { id: '1', weight: 80, date: { seconds: 1672531200, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())

      // fetch first to populate local state
      await act(async () => {
        await result.current.fetchWeightLogs(null)
      })

      await act(async () => {
        await result.current.deleteWeightLog('1', null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('guestWeightLogs', '[]')
      expect(result.current.weightLogs).toHaveLength(0)
    })

    it('should delete weight log for logged-in user in firestore', async () => {
      ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)
      const dbLogs = [
        {
          id: '1',
          weight: 80,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ weight: log.weight, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())

      // fetch first to populate state
      await act(async () => {
        await result.current.fetchWeightLogs(mockUser)
      })

      await act(async () => {
        await result.current.deleteWeightLog('1', mockUser)
      })

      expect(deleteDoc).toHaveBeenCalled()
      expect(result.current.weightLogs).toHaveLength(0)
    })

    it('should migrate guest weight logs to firestore', async () => {
      const guestLogs = [
        {
          id: 'guest-1',
          weight: 70,
          date: { seconds: 1672531200, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestWeightLogs')
          return Promise.resolve(JSON.stringify(guestLogs))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.migrateGuestWeightLogs(mockUser)
      })

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('guestWeightLogs')
      expect(writeBatch).toHaveBeenCalled()
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('guestWeightLogs')
    })
  })

  describe('Calorie Logs', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      mockBatch.commit.mockResolvedValue(undefined)
    })

    it('should fetch calorie logs for guest user with no data', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())
      let logs
      await act(async () => {
        logs = await result.current.fetchCalorieLogs(null)
      })
      expect(logs).toEqual([])
    })

    it('should fetch calorie logs for guest user with data', async () => {
      const guestLogs = [
        { id: '1', calories: 2000, date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())
      let logs
      await act(async () => {
        logs = await result.current.fetchCalorieLogs(null)
      })
      expect(logs).toHaveLength(1)
      expect(logs![0].calories).toBe(2000)
    })

    it('should fetch calorie logs for authenticated user', async () => {
      const dbLogs = [
        {
          id: '1',
          calories: 2500,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ calories: log.calories, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      let logs
      await act(async () => {
        logs = await result.current.fetchCalorieLogs(mockUser)
      })
      expect(getDocs).toHaveBeenCalled()
      expect(logs).toHaveLength(1)
      expect(logs![0].calories).toBe(2500)
    })

    it('should add calorie log for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.addCalorieLog(2200, new Date(), null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestCalorieLogs',
        expect.stringContaining('2200'),
      )
      expect(result.current.calorieLogs[0].calories).toBe(2200)
    })

    it('should add calorie log for authenticated user', async () => {
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.addCalorieLog(2300, new Date(), mockUser)
      })
      expect(addDoc).toHaveBeenCalled()
      expect(result.current.calorieLogs[0].calories).toBe(2300)
    })

    it('should update calorie log for guest user', async () => {
      const guestLogs = [
        { id: '1', calories: 2000, date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchCalorieLogs(null)
      })
      await act(async () => {
        await result.current.updateCalorieLog('1', 2100, new Date(), null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestCalorieLogs',
        expect.stringContaining('2100'),
      )
      expect(result.current.calorieLogs[0].calories).toBe(2100)
    })

    it('should update calorie log for authenticated user', async () => {
      ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
      const dbLogs = [
        {
          id: '1',
          calories: 2000,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ calories: log.calories, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchCalorieLogs(mockUser)
      })
      await act(async () => {
        await result.current.updateCalorieLog('1', 2400, new Date(), mockUser)
      })
      expect(updateDoc).toHaveBeenCalled()
      expect(result.current.calorieLogs[0].calories).toBe(2400)
    })

    it('should delete calorie log for guest user', async () => {
      const guestLogs = [
        { id: '1', calories: 2000, date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestLogs),
      )
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchCalorieLogs(null)
      })
      await act(async () => {
        await result.current.deleteCalorieLog('1', null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestCalorieLogs',
        '[]',
      )
      expect(result.current.calorieLogs).toHaveLength(0)
    })

    it('should delete calorie log for authenticated user', async () => {
      ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)
      const dbLogs = [
        {
          id: '1',
          calories: 2000,
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbLogs.map((log) => ({
          id: log.id,
          data: () => ({ calories: log.calories, date: log.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchCalorieLogs(mockUser)
      })
      await act(async () => {
        await result.current.deleteCalorieLog('1', mockUser)
      })
      expect(deleteDoc).toHaveBeenCalled()
      expect(result.current.calorieLogs).toHaveLength(0)
    })

    it('should migrate guest calorie logs - success', async () => {
      const guestLogs = [
        { id: '1', calories: 2000, date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestCalorieLogs')
          return Promise.resolve(JSON.stringify(guestLogs))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.migrateGuestCalorieLogs(mockUser)
      })
      expect(writeBatch).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('guestCalorieLogs')
    })

    it('should migrate guest calorie logs - empty', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestCalorieLogs') return Promise.resolve('[]')
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.migrateGuestCalorieLogs(mockUser)
      })
      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('should migrate guest calorie logs - error', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Migration Error'),
      )
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.migrateGuestCalorieLogs(mockUser)
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to migrate guest calorie logs',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Journal Entries', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      mockBatch.commit.mockResolvedValue(undefined)
    })

    it('should fetch journal entries for guest user with no data', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())
      let entries
      await act(async () => {
        entries = await result.current.fetchJournalEntries(null)
      })
      expect(entries).toEqual([])
    })

    it('should fetch journal entries for guest user with data', async () => {
      const guestEntries = [
        { id: '1', note: 'Test note', date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestEntries),
      )
      const { result } = renderHook(() => useData())
      let entries
      await act(async () => {
        entries = await result.current.fetchJournalEntries(null)
      })
      expect(entries).toHaveLength(1)
      expect(entries![0].note).toBe('Test note')
    })

    it('should fetch journal entries for authenticated user', async () => {
      const dbEntries = [
        {
          id: '1',
          note: 'DB note',
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbEntries.map((entry) => ({
          id: entry.id,
          data: () => ({ note: entry.note, date: entry.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      let entries
      await act(async () => {
        entries = await result.current.fetchJournalEntries(mockUser)
      })
      expect(getDocs).toHaveBeenCalled()
      expect(entries).toHaveLength(1)
      expect(entries![0].note).toBe('DB note')
    })

    it('should add journal entry for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.addJournalEntry('New note', new Date(), null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        expect.stringContaining('New note'),
      )
      expect(result.current.journalEntries[0].note).toBe('New note')
    })

    it('should add journal entry with supplements for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())
      const supplements = [{ name: 'Creatine', dosage: '5g' }]
      await act(async () => {
        await result.current.addJournalEntry(
          'New note with supps',
          new Date(),
          null,
          supplements,
        )
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        expect.stringContaining('"name":"Creatine"'),
      )
      expect(result.current.journalEntries[0].note).toBe('New note with supps')
      expect(result.current.journalEntries[0].supplements).toEqual(supplements)
    })

    it('should add journal entry with duplicate supplements for guest user', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]')
      const { result } = renderHook(() => useData())
      const supplements = [
        { name: 'Creatine', dosage: '5g' },
        { name: 'Creatine', dosage: '5g' },
      ]
      await act(async () => {
        await result.current.addJournalEntry(
          'New note with duplicate supps',
          new Date(),
          null,
          supplements,
        )
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        expect.stringContaining('"name":"Creatine"'),
      )
      expect(result.current.journalEntries[0].note).toBe(
        'New note with duplicate supps',
      )
      expect(result.current.journalEntries[0].supplements).toEqual(supplements)
    })

    it('should add journal entry for authenticated user', async () => {
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.addJournalEntry(
          'New db note',
          new Date(),
          mockUser,
        )
      })
      expect(addDoc).toHaveBeenCalled()
      expect(result.current.journalEntries[0].note).toBe('New db note')
    })

    it('should add journal entry with supplements for authenticated user', async () => {
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const { result } = renderHook(() => useData())
      const supplements = [{ name: 'Whey Protein', dosage: '1 scoop' }]
      await act(async () => {
        await result.current.addJournalEntry(
          'New db note with supps',
          new Date(),
          mockUser,
          supplements,
        )
      })
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          note: 'New db note with supps',
          supplements: supplements,
        }),
      )
      expect(result.current.journalEntries[0].note).toBe(
        'New db note with supps',
      )
      expect(result.current.journalEntries[0].supplements).toEqual(supplements)
    })

    it('should update journal entry for guest user', async () => {
      const guestEntries = [
        { id: '1', note: 'Old note', date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestEntries),
      )
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchJournalEntries(null)
      })
      await act(async () => {
        await result.current.updateJournalEntry(
          '1',
          'Updated note',
          new Date(),
          null,
        )
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        expect.stringContaining('Updated note'),
      )
      expect(result.current.journalEntries[0].note).toBe('Updated note')
    })

    it('should update journal entry with supplements for guest user', async () => {
      const guestEntries = [
        {
          id: '1',
          note: 'Old note',
          date: { seconds: 1000, nanoseconds: 0 },
          supplements: [],
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestEntries),
      )
      const { result } = renderHook(() => useData())
      const supplements = [{ name: 'Creatine', dosage: '5g' }]
      await act(async () => {
        await result.current.fetchJournalEntries(null)
      })
      await act(async () => {
        await result.current.updateJournalEntry(
          '1',
          'Updated note with supps',
          new Date(),
          null,
          supplements,
        )
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        expect.stringContaining('"name":"Creatine"'),
      )
      expect(result.current.journalEntries[0].note).toBe(
        'Updated note with supps',
      )
      expect(result.current.journalEntries[0].supplements).toEqual(supplements)
    })

    it('should update journal entry for authenticated user', async () => {
      ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
      const dbEntries = [
        {
          id: '1',
          note: 'Old note',
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbEntries.map((entry) => ({
          id: entry.id,
          data: () => ({ note: entry.note, date: entry.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchJournalEntries(mockUser)
      })
      await act(async () => {
        await result.current.updateJournalEntry(
          '1',
          'Updated DB note',
          new Date(),
          mockUser,
        )
      })
      expect(updateDoc).toHaveBeenCalled()
      expect(result.current.journalEntries[0].note).toBe('Updated DB note')
    })

    it('should update journal entry with supplements for authenticated user', async () => {
      ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
      const dbEntries = [
        {
          id: '1',
          note: 'Old note',
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbEntries.map((entry) => ({
          id: entry.id,
          data: () => ({ note: entry.note, date: entry.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      const supplements = [{ name: 'Whey Protein', dosage: '1 scoop' }]
      await act(async () => {
        await result.current.fetchJournalEntries(mockUser)
      })
      await act(async () => {
        await result.current.updateJournalEntry(
          '1',
          'Updated DB note with supps',
          new Date(),
          mockUser,
          supplements,
        )
      })
      expect(updateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          note: 'Updated DB note with supps',
          supplements: supplements,
        }),
      )
      expect(result.current.journalEntries[0].note).toBe(
        'Updated DB note with supps',
      )
      expect(result.current.journalEntries[0].supplements).toEqual(supplements)
    })

    it('should delete journal entry for guest user', async () => {
      const guestEntries = [
        { id: '1', note: 'Note', date: { seconds: 1000, nanoseconds: 0 } },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestEntries),
      )
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchJournalEntries(null)
      })
      await act(async () => {
        await result.current.deleteJournalEntry('1', null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestJournalEntries',
        '[]',
      )
      expect(result.current.journalEntries).toHaveLength(0)
    })

    it('should delete journal entry for authenticated user', async () => {
      ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)
      const dbEntries = [
        {
          id: '1',
          note: 'Note',
          date: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ]
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: dbEntries.map((entry) => ({
          id: entry.id,
          data: () => ({ note: entry.note, date: entry.date }),
        })),
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.fetchJournalEntries(mockUser)
      })
      await act(async () => {
        await result.current.deleteJournalEntry('1', mockUser)
      })
      expect(deleteDoc).toHaveBeenCalled()
      expect(result.current.journalEntries).toHaveLength(0)
    })

    it('should migrate guest journal entries - success', async () => {
      const guestEntries = [
        {
          id: '1',
          note: 'Migrate note',
          date: { seconds: 1000, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestJournalEntries')
          return Promise.resolve(JSON.stringify(guestEntries))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.migrateGuestJournalEntries(mockUser)
      })
      expect(writeBatch).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'guestJournalEntries',
      )
    })

    it('should migrate guest journal entries - failure', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Migration Error'),
      )
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.migrateGuestJournalEntries(mockUser)
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to migrate guest journal entries',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('TDEE Config', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const mockTDEEConfig = {
      gender: 'male',
      weight: 80,
      height: 180,
      age: 25,
      activityLevel: 'moderate',
      goal: 'maintain',
    }

    it('should load TDEE config - no saved config', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useData())
      let config
      await act(async () => {
        config = await result.current.loadTDEEConfig()
      })
      expect(config).toBeNull()
      expect(result.current.tdeeConfig).toBeNull()
    })

    it('should load TDEE config from Firestore if not in AsyncStorage', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ tdeeConfig: mockTDEEConfig }),
      })

      const { result } = renderHook(() => useData())
      let config
      await act(async () => {
        config = await result.current.loadTDEEConfig(mockUser)
      })
      expect(config).toEqual(mockTDEEConfig)
      expect(result.current.tdeeConfig).toEqual(mockTDEEConfig)
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'tdeeConfig',
        JSON.stringify(mockTDEEConfig),
      )
    })

    it('should load TDEE config - with saved config', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTDEEConfig),
      )
      const { result } = renderHook(() => useData())
      let config
      await act(async () => {
        config = await result.current.loadTDEEConfig()
      })
      expect(config).toEqual(mockTDEEConfig)
      expect(result.current.tdeeConfig).toEqual(mockTDEEConfig)
    })

    it('should handle load TDEE config error', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Load error'),
      )
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())
      let config
      await act(async () => {
        config = await result.current.loadTDEEConfig()
      })
      expect(config).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load TDEE config',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it('should save TDEE config for guest user', async () => {
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.saveTDEEConfig(mockTDEEConfig as any, null)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'tdeeConfig',
        JSON.stringify(mockTDEEConfig),
      )
      expect(result.current.tdeeConfig).toEqual(mockTDEEConfig)
      expect(setDoc).not.toHaveBeenCalled()
    })

    it('should save TDEE config for authenticated user', async () => {
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.saveTDEEConfig(mockTDEEConfig as any, mockUser)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'tdeeConfig',
        JSON.stringify(mockTDEEConfig),
      )
      expect(setDoc).toHaveBeenCalled()
      expect(result.current.tdeeConfig).toEqual(mockTDEEConfig)
    })

    it('should handle save TDEE config Firestore failure', async () => {
      ;(setDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'))
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.saveTDEEConfig(mockTDEEConfig as any, mockUser)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'tdeeConfig',
        JSON.stringify(mockTDEEConfig),
      )
      expect(result.current.tdeeConfig).toEqual(mockTDEEConfig)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to sync TDEE config to Firestore',
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it('should delete TDEE config for guest user', async () => {
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.deleteTDEEConfig(null)
      })
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdeeConfig')
      expect(result.current.tdeeConfig).toBeNull()
    })

    it('should delete TDEE config for authenticated user', async () => {
      ;(deleteField as jest.Mock).mockReturnValue('deleteField()')
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.deleteTDEEConfig(mockUser)
      })
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdeeConfig')
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
        { tdeeConfig: 'deleteField()' },
      )
      expect(result.current.tdeeConfig).toBeNull()
    })
  })

  describe('Active Session Persistence', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('saveActiveSession writes correct data to AsyncStorage', async () => {
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.saveActiveSession('workout-123', 2)
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'activeWorkoutSession',
        JSON.stringify({ workoutId: 'workout-123', exerciseIndex: 2 }),
      )
    })

    it('loadActiveSession reads and returns persisted session', async () => {
      const originalGetItem = AsyncStorage.getItem as jest.Mock
      const defaultImpl = originalGetItem.getMockImplementation()
      originalGetItem.mockImplementation((key: string) => {
        if (key === 'activeWorkoutSession') {
          return Promise.resolve(
            JSON.stringify({ workoutId: 'workout-456', exerciseIndex: 3 }),
          )
        }
        return defaultImpl ? defaultImpl(key) : Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())
      let session: { workoutId: string; exerciseIndex: number } | null = null
      await act(async () => {
        session = await result.current.loadActiveSession()
      })
      expect(session).toEqual({ workoutId: 'workout-456', exerciseIndex: 3 })
      originalGetItem.mockImplementation(defaultImpl)
    })

    it('loadActiveSession returns null when no session exists', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
      const { result } = renderHook(() => useData())
      let session: { workoutId: string; exerciseIndex: number } | null = null
      await act(async () => {
        session = await result.current.loadActiveSession()
      })
      expect(session).toBeNull()
    })

    it('loadActiveSession returns null for invalid data', async () => {
      const originalGetItem = AsyncStorage.getItem as jest.Mock
      const defaultImpl = originalGetItem.getMockImplementation()
      originalGetItem.mockImplementation((key: string) => {
        if (key === 'activeWorkoutSession') {
          return Promise.resolve(JSON.stringify({ exerciseIndex: 1 }))
        }
        return defaultImpl ? defaultImpl(key) : Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())
      let session: { workoutId: string; exerciseIndex: number } | null = null
      await act(async () => {
        session = await result.current.loadActiveSession()
      })
      expect(session).toBeNull()
      originalGetItem.mockImplementation(defaultImpl)
    })

    it('clearActiveSession removes the key', async () => {
      const { result } = renderHook(() => useData())
      await act(async () => {
        await result.current.clearActiveSession()
      })
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'activeWorkoutSession',
      )
    })
  })
})
