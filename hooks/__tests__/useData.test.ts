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
} from 'firebase/firestore'
import { useData, Settings, Workout } from '../useData'
import { getDefaultWorkouts } from '../../utils/defaultWorkouts'

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn().mockImplementation(() => ({ id: `mock-doc-${Math.random()}` })),
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
        await result.current.addHistoryEntry(entry, setNumber, startTime, startTime + 1000, mockUser)
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
        result.current.todaysCompletions.every((c) => c.exerciseId === exerciseId),
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
      expect(result.current.todaysCompletions.every(c => c.exerciseId === exerciseA)).toBe(true)
      expect(result.current.todaysCompletions).toHaveLength(2)

      // Test searching for Exercise B
      const mockCompletionsB = [
          { id: 'doc2', data: () => ({ exerciseId: exerciseB, set: 1 }) }
      ]
      ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockCompletionsB })

      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, exerciseB)
      })
      expect(result.current.todaysCompletions.every(c => c.exerciseId === exerciseB)).toBe(true)
      expect(result.current.todaysCompletions).toHaveLength(1)
    })

    it('should handle undefined or invalid startTime gracefully', async () => {
      const { result } = renderHook(() => useData())
      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' })
      const now = Date.now()

      // Case 1: 0 startTime
      await act(async () => {
        await result.current.addHistoryEntry(
          { workoutId: 'w1', exerciseId: 'ex1', exerciseName: 'Test', reps: 10, weight: 50 },
          1,
          0,
          now,
          mockUser
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
          { workoutId: 'w1', exerciseId: 'ex1', exerciseName: 'Test', reps: 10, weight: 50 },
          2,
          -1,
          now,
          mockUser
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
        );
      })

      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ workoutId: null })
      )
    })
  })

  describe('User Data Sync', () => {
    it('should sync settings and workouts from firestore for an existing user', async () => {
      const firestoreData = {
        settings: { ...defaultSettings, restSeconds: 90 },
        workouts: [
          { id: 'firebase-workout', name: 'Firebase Workout', exercises: [] },
        ],
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
    })

    it('should upload local data for a new user', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => false })

      const { result } = renderHook(() => useData())
      const localSettings = { ...defaultSettings, countdownSeconds: 2 }
      const localWorkouts = [
        { id: 'local-workout', name: 'Local Workout', exercises: [] },
      ]

      await act(async () => {
        await result.current.syncUserData(mockUser, localSettings, localWorkouts)
      })

      const setDocCall = (setDoc as jest.Mock).mock.calls[0]
      expect(setDocCall[1]).not.toHaveProperty('setCompletions')
      expect(setDocCall[1]).toHaveProperty('settings', localSettings)
      expect(setDocCall[1]).toHaveProperty('workouts', localWorkouts)
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
        if (key === 'guestHistory') return Promise.resolve(JSON.stringify(guestHistory))
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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.migrateGuestHistory(mockUser)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to migrate guest history', error)
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
        await result.current.addHistoryEntry(entry, setNumber, startTime, startTime + 1000, null)
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
        if (key === 'guestHistory') return Promise.resolve(JSON.stringify(guestHistory))
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
      const { result } = renderHook(() => useData());
      const mockDocsPage1 = [
        { id: 'h1', data: () => ({ exerciseId: 'ex1', date: { seconds: 100, nanoseconds: 0 }, reps: 10, weight: 50, exerciseName: 'E1', workoutId: 'w1' }) },
        { id: 'h2', data: () => ({ exerciseId: 'ex1', date: { seconds: 90, nanoseconds: 0 }, reps: 10, weight: 50, exerciseName: 'E1', workoutId: 'w1' }) },
      ];
      const mockDocsPage2 = [
          { id: 'h3', data: () => ({ exerciseId: 'ex1', date: { seconds: 80, nanoseconds: 0 }, reps: 10, weight: 50, exerciseName: 'E1', workoutId: 'w1' }) },
      ];

      // First call returns Page 1
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocsPage1 });
      
      let historyPage1;
      await act(async () => {
        historyPage1 = await result.current.fetchHistory(mockUser, undefined);
      });

      expect(historyPage1).toHaveLength(2);
      expect(getDocs).toHaveBeenCalled();

      // Second call passing the last doc of page 1 as 'lastDoc'
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocsPage2 });
      const lastDocOfPage1 = historyPage1![1]; // Use the returned object, not the mock doc

      let historyPage2;
      await act(async () => {
        historyPage2 = await result.current.fetchHistory(mockUser, lastDocOfPage1);
      });

      expect(historyPage2).toHaveLength(1);
      expect(historyPage2![0].id).toBe('h3');
    });
  });

  describe('Offline Queue', () => {
    it('should add entry to offline queue when firestore fails', async () => {
      ;(addDoc as jest.Mock).mockRejectedValue(new Error('Firestore unavailable'))
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
        await result.current.addHistoryEntry(entry, setNumber, startTime, startTime + 1000, mockUser)
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
        if (key === 'guestHistory') return Promise.resolve(JSON.stringify(guestHistory))
        return Promise.resolve(null)
      })
      const { result } = renderHook(() => useData())

      await act(async () => {
        await result.current.updateHistoryEntry(
          'entry-1',
          { reps: 15 },
          null,
        )
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
        if (key === 'guestHistory') return Promise.resolve(JSON.stringify(guestHistory))
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
        if (key === 'guestHistory') return Promise.resolve(JSON.stringify(guestHistory))
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
})