import { useState, Dispatch, SetStateAction, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getDefaultWorkouts } from '../utils/defaultWorkouts'
import type { User as FirebaseUser } from 'firebase/auth'
import type { WorkoutSet } from '../declarations'
import getLocalDateString from '../utils/getLocalDateString'

// Interface for a WorkoutSet object that has been serialized to JSON
// where the Firestore Timestamp is just a plain object.
interface SerializedWorkoutSetData extends Omit<WorkoutSet, 'date'> {
  date: {
    seconds: number
    nanoseconds: number
  }
}

// Interfaces
export interface Settings {
  countdownSeconds: number
  restSeconds: number
  maxReps: number
  maxSets: number
  concentricSeconds: number
  eccentricSeconds: number
  eccentricCountdownEnabled: boolean
  volume: number
}

export interface Exercise {
  id: string
  name: string
  sets: number
  reps: number
}

export interface Workout {
  id: string
  name: string
  exercises: Exercise[]
}

export interface DataHook {
  settings: Settings
  workouts: Workout[]
  todaysCompletions: WorkoutSet[]
  offlineQueue: WorkoutSet[]
  loadSettings: () => Promise<Settings>
  saveSettings: (
    newSettings: Settings,
    user: FirebaseUser | null,
  ) => Promise<void>
  loadWorkouts: () => Promise<Workout[]>
  saveWorkouts: (
    newWorkouts: Workout[],
    user: FirebaseUser | null,
  ) => Promise<void>
  addHistoryEntry: (
    entry: Omit<WorkoutSet, 'id' | 'date' | 'set'>,
    set: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  fetchHistory: (
    user: FirebaseUser,
    lastVisible?: WorkoutSet,
  ) => Promise<WorkoutSet[]>
  fetchTodaysCompletions: (
    user: FirebaseUser,
    exerciseId: string,
  ) => Promise<void>
  fetchAllTodaysCompletions: (user: FirebaseUser | null) => Promise<void>
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
  getNextUncompletedSet: (exerciseId: string) => number
  resetSetsFrom: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  arePreviousSetsCompleted: (exerciseId: string, setNumber: number) => boolean
  syncUserData: (
    firebaseUser: FirebaseUser,
    localSettings: Settings,
    localWorkouts: Workout[],
  ) => Promise<void>
  migrateGuestHistory: (user: FirebaseUser) => Promise<WorkoutSet[]>
  syncOfflineQueue: (user: FirebaseUser) => Promise<void>
  setWorkouts: Dispatch<SetStateAction<Workout[]>>
  setSettings: Dispatch<SetStateAction<Settings>>
  setOfflineQueue: Dispatch<SetStateAction<WorkoutSet[]>>
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

export const useData = (): DataHook => {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    getDefaultWorkouts(),
  )
  const [todaysCompletions, setTodaysCompletions] = useState<WorkoutSet[]>([])
  const [offlineQueue, setOfflineQueue] = useState<WorkoutSet[]>([])

  const loadOfflineQueue = useCallback(async () => {
    try {
      const queue = await AsyncStorage.getItem('offlineQueue')
      if (queue) {
        const parsedQueue = JSON.parse(queue)
        if (Array.isArray(parsedQueue)) {
          const validQueue = parsedQueue
            .filter(
              item => item && item.date && typeof item.date.seconds === 'number',
            )
            .map((item: SerializedWorkoutSetData) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
          setOfflineQueue(validQueue)
        }
      }
    } catch (e) {
      console.error('Failed to load offline queue.', e)
    }
  }, [])

  useEffect(() => {
    loadOfflineQueue()
  }, [loadOfflineQueue])

  const loadSettings = useCallback(async (): Promise<Settings> => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings(parsed)
        return parsed
      }
      setSettings(defaultSettings)
      return defaultSettings
    } catch (e) {
      console.error('Failed to load settings.', e)
      return defaultSettings
    }
  }, [])

  const saveSettings = useCallback(
    async (newSettings: Settings, user: FirebaseUser | null) => {
      try {
        setSettings(newSettings)
        await AsyncStorage.setItem(
          'repCounterSettings',
          JSON.stringify(newSettings),
        )

        if (user) {
          const userDocRef = doc(db, 'users', user.uid)
          await setDoc(userDocRef, { settings: newSettings }, { merge: true })
        }
      } catch (e) {
        console.error('Failed to save settings.', e)
      }
    },
    [],
  )

  const fetchAllTodaysCompletions = useCallback(
    async (user: FirebaseUser | null) => {
      if (!user) {
        setTodaysCompletions([])
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startOfToday = Timestamp.fromDate(today)

      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'history')
        const q = query(historyCollectionRef, where('date', '>=', startOfToday))
        const querySnapshot = await getDocs(q)
        const todaysSets = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as WorkoutSet[]
        setTodaysCompletions(todaysSets)
      } catch (e) {
        console.error("Failed to fetch all of today's completions", e)
        setTodaysCompletions([])
      }
    },
    [],
  )

  const loadWorkouts = useCallback(async (): Promise<Workout[]> => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts')
      if (savedWorkouts) {
        const parsed = JSON.parse(savedWorkouts)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkouts(parsed)
          return parsed
        }
      }
      const defaultWorkouts = getDefaultWorkouts()
      setWorkouts(defaultWorkouts)
      await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts))
      return defaultWorkouts
    } catch (e) {
      console.error('Failed to load workouts.', e)
      const defaultWorkouts = getDefaultWorkouts()
      setWorkouts(defaultWorkouts)
      return defaultWorkouts
    }
  }, [])

  const saveWorkouts = useCallback(
    async (newWorkouts: Workout[], user: FirebaseUser | null) => {
      try {
        setWorkouts(newWorkouts)
        await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts))
        if (user) {
          const userDocRef = doc(db, 'users', user.uid)
          await setDoc(userDocRef, { workouts: newWorkouts }, { merge: true })
        }
      } catch (e) {
        console.error('Failed to save workouts', e)
      }
    },
    [],
  )

  const addHistoryEntry = useCallback(
    async (
      entry: Omit<WorkoutSet, 'id' | 'date' | 'set'>,
      set: number,
      user: FirebaseUser | null,
    ) => {
      const newEntryBase = { ...entry, set, date: Timestamp.now() }

      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const docRef = await addDoc(historyCollectionRef, newEntryBase)
          setTodaysCompletions(prev => [
            ...prev,
            { ...newEntryBase, id: docRef.id },
          ])
        } catch (e) {
          console.error('Failed to save history entry, queuing offline.', e)
          const offlineEntry: WorkoutSet = {
            ...newEntryBase,
            id: `${Date.now()}-${entry.exerciseId}-${set}`,
          }
          setTodaysCompletions(prev => [...prev, offlineEntry])
          const updatedQueue = [...offlineQueue, offlineEntry]
          setOfflineQueue(updatedQueue)
          await AsyncStorage.setItem(
            'offlineQueue',
            JSON.stringify(updatedQueue),
          )
        }
      } else {
        // Guest user
        try {
          const newEntry: WorkoutSet = {
            ...newEntryBase,
            id: `${Date.now()}-${entry.exerciseId}-${set}`,
          }

          // Save to today's completions
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          const savedCompletions = savedCompletionsRaw
            ? JSON.parse(savedCompletionsRaw)
            : []
          const updatedCompletions = [...savedCompletions, newEntry]
          await AsyncStorage.setItem(
            todayKey,
            JSON.stringify(updatedCompletions),
          )

          // Save to full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          const savedHistory = savedHistoryRaw
            ? JSON.parse(savedHistoryRaw)
            : []
          const updatedHistory = [...savedHistory, newEntry]
          await AsyncStorage.setItem(historyKey, JSON.stringify(updatedHistory))

          setTodaysCompletions(prev => [...prev, newEntry])
        } catch (e) {
          console.error('Failed to save guest history entry', e)
        }
      }
    },
    [todaysCompletions, offlineQueue],
  )

  const fetchHistory = useCallback(
    async (user: FirebaseUser | null, lastVisible?: WorkoutSet) => {
      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const q = query(
            historyCollectionRef,
            orderBy('date', 'desc'),
            limit(20),
            ...(lastVisible ? [startAfter(lastVisible.date)] : []),
          )

          const querySnapshot = await getDocs(q)
          const newHistory = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]

          return newHistory
        } catch (e) {
          console.error('Failed to fetch history', e)
          return []
        }
      } else {
        // Guest user
        try {
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (!savedHistoryRaw) return []

          const allHistory = JSON.parse(savedHistoryRaw)
            .map((item: SerializedWorkoutSetData) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort((a: WorkoutSet, b: WorkoutSet) => b.date.toMillis() - a.date.toMillis())

          const startIndex = lastVisible
            ? allHistory.findIndex((item: WorkoutSet) => item.id === lastVisible.id) + 1
            : 0

          if (startIndex >= allHistory.length) return [];

          const newHistory = allHistory.slice(startIndex, startIndex + 20)
          return newHistory
        } catch (e) {
          console.error('Failed to fetch guest history', e)
          return []
        }
      }
    },
    [],
  )

  const fetchTodaysCompletions = useCallback(
    async (user: FirebaseUser | null, exerciseId: string) => {
      if (user) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const startOfToday = Timestamp.fromDate(today)

        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const q = query(
            historyCollectionRef,
            where('exerciseId', '==', exerciseId),
            where('date', '>=', startOfToday),
          )
          const querySnapshot = await getDocs(q)
          const todaysSets = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]
          setTodaysCompletions(todaysSets)
        } catch (e) {
          console.error("Failed to fetch today's completions", e)
          setTodaysCompletions([])
        }
      } else {
        // Guest user
        try {
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw).map(
              (item: SerializedWorkoutSetData) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }),
            )
            const exerciseCompletions = allCompletions.filter(
              (c: WorkoutSet) => c.exerciseId === exerciseId,
            )
            setTodaysCompletions(exerciseCompletions)
          } else {
            setTodaysCompletions([])
          }
        } catch (e) {
          console.error("Failed to fetch guest's today's completions", e)
          setTodaysCompletions([])
        }
      }
    },
    [],
  )

  const isSetCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      return todaysCompletions.some(
        c => c.exerciseId === exerciseId && c.set === setNumber,
      )
    },
    [todaysCompletions],
  )

  const arePreviousSetsCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      if (setNumber <= 1) {
        return true
      }

      const completedSets = todaysCompletions
        .filter(c => c.exerciseId === exerciseId)
        .map(c => c.set)

      for (let i = 1; i < setNumber; i++) {
        if (!completedSets.includes(i)) {
          return false
        }
      }
      return true
    },
    [todaysCompletions],
  )

  const getNextUncompletedSet = useCallback(
    (exerciseId: string): number => {
      const completedSets = todaysCompletions
        .filter(c => c.exerciseId === exerciseId)
        .map(c => c.set)
        .sort((a, b) => a - b)

      if (completedSets.length === 0) return 1

      let nextSet = 1
      for (const set of completedSets) {
        if (set === nextSet) {
          nextSet++
        } else {
          break
        }
      }
      return nextSet
    },
    [todaysCompletions],
  )

  const resetSetsFrom = useCallback(
    async (
      exerciseId: string,
      setNumber: number,
      user: FirebaseUser | null,
    ) => {
      if (user) {
        const setsToRemove = todaysCompletions.filter(
          c => c.exerciseId === exerciseId && c.set >= setNumber,
        )
        if (setsToRemove.length === 0) return

        try {
          const batch = writeBatch(db)
          setsToRemove.forEach(s => {
            const docRef = doc(db, 'users', user.uid, 'history', s.id)
            batch.delete(docRef)
          })
          await batch.commit()

          setTodaysCompletions(prev =>
            prev.filter(c => !setsToRemove.some(r => r.id === c.id)),
          )
        } catch (e) {
          console.error('Failed to reset sets', e)
        }
      } else {
        // Guest user
        const setsToKeep = todaysCompletions.filter(
          c => c.exerciseId !== exerciseId || c.set < setNumber,
        )
        setTodaysCompletions(setsToKeep)

        try {
          // Update today's completions in AsyncStorage
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw)
            const updatedCompletions = allCompletions.filter(
              (c: WorkoutSet) =>
                c.exerciseId !== exerciseId || c.set < setNumber,
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }

          // Update full history in AsyncStorage
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.filter(
              (c: WorkoutSet) =>
                c.exerciseId !== exerciseId || c.set < setNumber,
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }
        } catch (e) {
          console.error('Failed to reset guest sets', e)
        }
      }
    },
    [todaysCompletions],
  )

  const migrateGuestHistory = useCallback(
    async (user: FirebaseUser): Promise<WorkoutSet[]> => {
      try {
        const historyKey = 'guestHistory'
        const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
        if (!savedHistoryRaw) return []

        const parsedHistory = JSON.parse(savedHistoryRaw)
        if (!Array.isArray(parsedHistory)) {
          console.warn(
            'Guest history in AsyncStorage is not an array, skipping migration.',
          )
          return []
        }

        const guestHistory: WorkoutSet[] = parsedHistory
          .filter(item => item && item.date && typeof item.date.seconds === 'number')
          .map((item: SerializedWorkoutSetData) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestHistory.length === 0) return []

        const batch = writeBatch(db)
        const historyCollectionRef = collection(db, 'users', user.uid, 'history')
        const migratedEntries: WorkoutSet[] = []

        guestHistory.forEach(entry => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(historyCollectionRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migratedEntries.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(historyKey)
        await AsyncStorage.removeItem(`todaysCompletions-${getLocalDateString()}`)

        console.log('Guest history migrated successfully.')
        return migratedEntries
      } catch (e) {
        console.error('Failed to migrate guest history', e)
        return []
      }
    },
    [],
  )

  const syncOfflineQueue = useCallback(
    async (user: FirebaseUser) => {
      if (offlineQueue.length === 0) return

      console.log(`Syncing ${offlineQueue.length} offline entries...`)
      const batch = writeBatch(db)
      const historyCollectionRef = collection(db, 'users', user.uid, 'history')

      offlineQueue.forEach(entry => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataToUpload } = entry
        const docRef = doc(historyCollectionRef) // Create a new doc with a new ID
        batch.set(docRef, dataToUpload)
      })

      try {
        await batch.commit()
        setOfflineQueue([])
        await AsyncStorage.removeItem('offlineQueue')
        console.log('Offline queue synced successfully.')
      } catch (e) {
        console.error('Failed to sync offline queue', e)
      }
    },
    [offlineQueue],
  )

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
    ) => {
      try {
        // Step 1: Migrate local data to Firestore
        await migrateGuestHistory(firebaseUser)
        await syncOfflineQueue(firebaseUser)

        const userDocRef = doc(db, 'users', firebaseUser.uid)
        const userDoc = await getDoc(userDocRef)

        // Step 2: Create user document if it doesn't exist
        if (!userDoc.exists()) {
          console.log('New user detected, creating document...')
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
          })
        }

        // Step 3: Fetch all data from Firestore to ensure local state is a mirror of the server
        console.log('Fetching latest user data from Firestore...')
        const freshUserDoc = await getDoc(userDocRef) // Re-fetch in case it was just created
        if (freshUserDoc.exists()) {
          const userData = freshUserDoc.data()
          // Sync Settings
          if (userData.settings) {
            setSettings(userData.settings)
            await AsyncStorage.setItem(
              'repCounterSettings',
              JSON.stringify(userData.settings),
            )
          }
          // Sync Workouts
          if (
            userData.workouts &&
            Array.isArray(userData.workouts) &&
            userData.workouts.length > 0
          ) {
            setWorkouts(userData.workouts)
            await AsyncStorage.setItem(
              'workouts',
              JSON.stringify(userData.workouts),
            )
          }
        }

        // Step 4: Fetch a fresh copy of today's completions
        await fetchAllTodaysCompletions(firebaseUser)
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    },
    [migrateGuestHistory, syncOfflineQueue, fetchAllTodaysCompletions],
  )

  return {
    settings,
    workouts,
    todaysCompletions,
    offlineQueue,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    addHistoryEntry,
    fetchHistory,
    fetchTodaysCompletions,
    fetchAllTodaysCompletions,
    isSetCompleted,
    getNextUncompletedSet,
    resetSetsFrom,
    arePreviousSetsCompleted,
    syncUserData,
    migrateGuestHistory,
    syncOfflineQueue,
    setWorkouts,
    setSettings,
    setOfflineQueue,
  }
}