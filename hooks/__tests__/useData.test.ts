import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
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
  Timestamp: class {
    seconds: number
    nanoseconds: number
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static now: any = jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromDate: any = jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Case 1: 0 startTime
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

      // Verify handled (e.g., set to undefined or excluded if logic dictates, or saved as 0 if allowed)
      // Based on fix in previous task, 0 might be converted to undefined or treated specifically.
      // The requirement was: "startTime: startTime > 0 ? Timestamp.fromMillis(startTime) : undefined"
      // So checking that we don't crash and arguments are correct.
      expect(addDoc).toHaveBeenCalled()

      // Case 2: Undefined startTime (simulated by passing 0 and checking argument logic inside if accessible, or just no crash)
      // Since the function signature expects number, we pass 0 or a negative number.
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
    })

    it('should allow saving history without a workoutId', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'doc-no-workout' })
      const startTime = Date.now()

      await act(async () => {
        await result.current.addHistoryEntry(
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let history: any
      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        history = await result.current.fetchHistory(null as any)
      })

      expect(history).toHaveLength(1)
      expect(history[0].id).toBe('guest-1')
    })
  })

  describe('Authenticated User History Pagination', () => {
    it('should fetch history with pagination', async () => {
      const { result } = renderHook(() => useData())
      const mockDocsPage1 = [
        {
          id: 'h1',
          data: () => ({
            exerciseId: 'ex1',
            date: { seconds: 100, nanoseconds: 0 },
            reps: 10,
            weight: 50,
            exerciseName: 'E1',
            workoutId: 'w1',
          }),
        },
        {
          id: 'h2',
          data: () => ({
            exerciseId: 'ex1',
            date: { seconds: 90, nanoseconds: 0 },
            reps: 10,
            weight: 50,
            exerciseName: 'E1',
            workoutId: 'w1',
          }),
        },
      ]
      const mockDocsPage2 = [
        {
          id: 'h3',
          data: () => ({
            exerciseId: 'ex1',
            date: { seconds: 80, nanoseconds: 0 },
            reps: 10,
            weight: 50,
            exerciseName: 'E1',
            workoutId: 'w1',
          }),
        },
      ]

      // First call returns Page 1
      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocsPage1 })

      let historyPage1
      await act(async () => {
        historyPage1 = await result.current.fetchHistory(mockUser, undefined)
      })

      expect(historyPage1).toHaveLength(2)
      expect(getDocs).toHaveBeenCalled()

      // Second call passing the last doc of page 1 as 'lastDoc'
      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocsPage2 })
      const lastDocOfPage1 = historyPage1![1] // Use the returned object, not the mock doc

      let historyPage2
      await act(async () => {
        historyPage2 = await result.current.fetchHistory(
          mockUser,
          lastDocOfPage1,
        )
      })

      expect(historyPage2).toHaveLength(1)
      expect(historyPage2![0].id).toBe('h3')
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    it('should update history entry for guest user', async () => {
      const guestHistory = [
        {
          id: 'entry-1',
          exerciseId: 'ex1',
          reps: 10,
          weight: 50,
          date: { seconds: 1672531200, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.updateHistoryEntry('entry-1', { reps: 15 }, null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        expect.any(String),
      )
    })

    it('should delete history entry for authenticated user', async () => {
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.deleteHistoryEntry('entry-id', mockUser)
      })

      expect(deleteDoc).toHaveBeenCalled()
    })

    it('should delete history entry for guest user', async () => {
      const guestHistory = [
        {
          id: 'entry-1',
          exerciseId: 'ex1',
          reps: 10,
          weight: 50,
          date: { seconds: 1672531200, nanoseconds: 0 },
        },
        {
          id: 'entry-2',
          exerciseId: 'ex1',
          reps: 12,
          weight: 55,
          date: { seconds: 1672531300, nanoseconds: 0 },
        },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'guestHistory')
          return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.deleteHistoryEntry('entry-1', null)
      })

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'guestHistory',
        expect.any(String),
      )
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
})
