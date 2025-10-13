import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  setDoc,
  getDoc,
  addDoc,
  getDocs,
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
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  Timestamp: class {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }
    static now = jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    }))
    static fromDate = jest.fn(date => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
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
  }
  const defaultSettings: Settings = {
    countdownSeconds: 5,
    restSeconds: 60,
    maxReps: 15,
    maxSets: 3,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
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

      await act(async () => {
        await result.current.addHistoryEntry(entry, setNumber, mockUser)
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
          mockUser,
        )
      })

      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true)
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false)
    })

    it('should get the next uncompleted set', async () => {
      const { result } = renderHook(() => useData())
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
          mockUser,
        )
      })
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(4)
    })

    it('should reset sets from a given set number', async () => {
      const { result } = renderHook(() => useData())

      await act(async () => {
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          mockUser,
        )
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          mockUser,
        )
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          3,
          mockUser,
        )
      })
      result.current.todaysCompletions[0].id = 'doc1'
      result.current.todaysCompletions[1].id = 'doc2'
      result.current.todaysCompletions[2].id = 'doc3'

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
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestHistory),
      )
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

      await act(async () => {
        await result.current.addHistoryEntry(entry, setNumber, null)
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
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(guestHistory),
      )
      const { result } = renderHook(() => useData())

      let history
      await act(async () => {
        history = await result.current.fetchHistory(null)
      })

      expect(history).toHaveLength(1)
      expect(history[0].id).toBe('guest-1')
    })
  })

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

      await act(async () => {
        await result.current.addHistoryEntry(entry, setNumber, mockUser)
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
      const offlineEntry = {
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
      const offlineEntry = { id: 'offline-1' }

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
})