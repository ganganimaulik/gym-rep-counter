import {
  useState,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
  deleteField,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getDefaultWorkouts } from '../utils/defaultWorkouts'
import type { User as FirebaseUser } from 'firebase/auth'
import type {
  WorkoutSet,
  WeightLog,
  CalorieLog,
  TDEEConfig,
  JournalEntry,
  SupplementLog,
} from '../declarations'
import getLocalDateString from '../utils/getLocalDateString'

// Interface for a WorkoutSet object that has been serialized to JSON
// where the Firestore Timestamp is just a plain object.
interface SerializedWorkoutSetData extends Omit<WorkoutSet, 'date'> {
  date: {
    seconds: number
    nanoseconds: number
  }
}

interface SerializedJournalEntry {
  id: string
  note: string
  date: {
    seconds: number
    nanoseconds: number
  }
  supplements?: SupplementLog[]
}

interface SerializedWeightLog {
  id: string
  weight: number
  date: {
    seconds: number
    nanoseconds: number
  }
}

interface SerializedCalorieLog {
  id: string
  calories: number
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
  countdownAnnouncementThreshold: number
  volume: number
  supplementSuggestions?: { name: string; defaultDosage: string }[]
  statRemindersEnabled?: boolean
  statRemindersUseAutoSleep?: boolean
  statRemindersSleepStart?: number
  statRemindersSleepEnd?: number
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
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
  journalEntries: JournalEntry[]
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
    entry: Omit<WorkoutSet, 'id' | 'date' | 'set' | 'startTime'>,
    set: number,
    startTime: number,
    endTime: number, // When set ended (rest timer started) - used for date field
    user: FirebaseUser | null,
  ) => Promise<void>
  updateHistoryEntry: (
    entryId: string,
    updates: { reps?: number; weight?: number },
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteHistoryEntry: (
    entryId: string,
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
  migrateGuestWeightLogs: (user: FirebaseUser) => Promise<WeightLog[]>
  migrateGuestCalorieLogs: (user: FirebaseUser) => Promise<CalorieLog[]>
  migrateGuestJournalEntries: (user: FirebaseUser) => Promise<JournalEntry[]>
  syncOfflineQueue: (user: FirebaseUser) => Promise<void>
  fetchFullHistory: (
    user: FirebaseUser | null,
    daysBack?: number,
  ) => Promise<WorkoutSet[]>
  fetchWeightLogs: (user: FirebaseUser | null) => Promise<WeightLog[]>
  addWeightLog: (
    weight: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  updateWeightLog: (
    id: string,
    weight: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteWeightLog: (id: string, user: FirebaseUser | null) => Promise<void>
  fetchCalorieLogs: (user: FirebaseUser | null) => Promise<CalorieLog[]>
  addCalorieLog: (
    calories: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  updateCalorieLog: (
    id: string,
    calories: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteCalorieLog: (id: string, user: FirebaseUser | null) => Promise<void>
  tdeeConfig: TDEEConfig | null
  loadTDEEConfig: (user?: FirebaseUser | null) => Promise<TDEEConfig | null>
  saveTDEEConfig: (
    config: TDEEConfig,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteTDEEConfig: (user: FirebaseUser | null) => Promise<void>
  fetchJournalEntries: (user: FirebaseUser | null) => Promise<JournalEntry[]>
  addJournalEntry: (
    note: string,
    date: Date,
    user: FirebaseUser | null,
    supplements?: SupplementLog[],
  ) => Promise<void>
  updateJournalEntry: (
    id: string,
    note: string,
    date: Date,
    user: FirebaseUser | null,
    supplements?: SupplementLog[],
  ) => Promise<void>
  deleteJournalEntry: (id: string, user: FirebaseUser | null) => Promise<void>
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
              (item) =>
                item && item.date && typeof item.date.seconds === 'number',
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
        // Merge with defaults to ensure new settings properties have values for existing users
        const mergedSettings = { ...defaultSettings, ...parsed }
        setSettings(mergedSettings)
        return mergedSettings
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
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'history',
        )
        const q = query(historyCollectionRef, where('date', '>=', startOfToday))
        const querySnapshot = await getDocs(q)
        const todaysSets = querySnapshot.docs.map((doc) => ({
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
      entry: Omit<WorkoutSet, 'id' | 'date' | 'set' | 'startTime'>,
      set: number,
      startTime: number,
      endTime: number, // When set ended (rest timer started) - used for date field
      user: FirebaseUser | null,
    ) => {
      const newEntryBase = {
        ...entry,
        set,
        startTime:
          startTime > 0
            ? Timestamp.fromMillis(startTime)
            : Timestamp.fromMillis(Date.now()),
        date: endTime > 0 ? Timestamp.fromMillis(endTime) : Timestamp.now(),
      }

      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const docRef = await addDoc(historyCollectionRef, newEntryBase)
          setTodaysCompletions((prev) => [
            ...prev,
            { ...newEntryBase, id: docRef.id },
          ])
        } catch (e) {
          console.error('Failed to save history entry, queuing offline.', e)
          const offlineEntry: WorkoutSet = {
            ...newEntryBase,
            id: `${Date.now()}-${entry.exerciseId}-${set}`,
          }
          setTodaysCompletions((prev) => [...prev, offlineEntry])
          setOfflineQueue((prev) => {
            const updatedQueue = [...prev, offlineEntry]
            AsyncStorage.setItem('offlineQueue', JSON.stringify(updatedQueue))
            return updatedQueue
          })
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

          setTodaysCompletions((prev) => [...prev, newEntry])
        } catch (e) {
          console.error('Failed to save guest history entry', e)
        }
      }
    },
    [],
  )

  const updateHistoryEntry = useCallback(
    async (
      entryId: string,
      updates: { reps?: number; weight?: number },
      user: FirebaseUser | null,
    ) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'history', entryId)
          await updateDoc(docRef, updates)
        } catch (e) {
          console.error('Failed to update history entry', e)
        }
      } else {
        // Guest user
        try {
          // Update in full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.map((item: WorkoutSet) =>
              item.id === entryId ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }

          // Update in today's completions if it's from today
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw)
            const updatedCompletions = allCompletions.map((item: WorkoutSet) =>
              item.id === entryId ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }
        } catch (e) {
          console.error('Failed to update guest history entry', e)
        }
      }
    },
    [],
  )

  const deleteHistoryEntry = useCallback(
    async (entryId: string, user: FirebaseUser | null) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'history', entryId)
          await deleteDoc(docRef)
        } catch (e) {
          console.error('Failed to delete history entry', e)
        }
      } else {
        // Guest user
        try {
          // Delete from full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.filter(
              (item: WorkoutSet) => item.id !== entryId,
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }

          // Delete from today's completions if applicable
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw)
            const updatedCompletions = allCompletions.filter(
              (item: WorkoutSet) => item.id !== entryId,
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }
        } catch (e) {
          console.error('Failed to delete guest history entry', e)
        }
      }
    },
    [],
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
          const newHistory = querySnapshot.docs.map((doc) => ({
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
            .sort(
              (a: WorkoutSet, b: WorkoutSet) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          const startIndex = lastVisible
            ? allHistory.findIndex(
                (item: WorkoutSet) => item.id === lastVisible.id,
              ) + 1
            : 0

          if (startIndex >= allHistory.length) return []

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
          const todaysSets = querySnapshot.docs.map((doc) => ({
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
        (c) => c.exerciseId === exerciseId && c.set === setNumber,
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
        .filter((c) => c.exerciseId === exerciseId)
        .map((c) => c.set)

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
        .filter((c) => c.exerciseId === exerciseId)
        .map((c) => c.set)
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
          (c) => c.exerciseId === exerciseId && c.set >= setNumber,
        )
        if (setsToRemove.length === 0) return

        try {
          const batch = writeBatch(db)
          setsToRemove.forEach((s) => {
            const docRef = doc(db, 'users', user.uid, 'history', s.id)
            batch.delete(docRef)
          })
          await batch.commit()

          setTodaysCompletions((prev) =>
            prev.filter((c) => !setsToRemove.some((r) => r.id === c.id)),
          )
        } catch (e) {
          console.error('Failed to reset sets', e)
        }
      } else {
        // Guest user
        const setsToKeep = todaysCompletions.filter(
          (c) => c.exerciseId !== exerciseId || c.set < setNumber,
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
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedWorkoutSetData) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestHistory.length === 0) return []

        const batch = writeBatch(db)
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'history',
        )
        const migratedEntries: WorkoutSet[] = []

        guestHistory.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(historyCollectionRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migratedEntries.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(historyKey)
        await AsyncStorage.removeItem(
          `todaysCompletions-${getLocalDateString()}`,
        )

        console.log('Guest history migrated successfully.')
        return migratedEntries
      } catch (e) {
        console.error('Failed to migrate guest history', e)
        return []
      }
    },
    [],
  )

  const migrateGuestWeightLogs = useCallback(
    async (user: FirebaseUser): Promise<WeightLog[]> => {
      try {
        const key = 'guestWeightLogs'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestLogs: WeightLog[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedWeightLog) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestLogs.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'weightLogs')
        const migrated: WeightLog[] = []

        guestLogs.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest weight logs', e)
        return []
      }
    },
    [],
  )

  const migrateGuestCalorieLogs = useCallback(
    async (user: FirebaseUser): Promise<CalorieLog[]> => {
      try {
        const key = 'guestCalorieLogs'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestLogs: CalorieLog[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedCalorieLog) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestLogs.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'calorieLogs')
        const migrated: CalorieLog[] = []

        guestLogs.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest calorie logs', e)
        return []
      }
    },
    [],
  )

  const migrateGuestJournalEntries = useCallback(
    async (user: FirebaseUser): Promise<JournalEntry[]> => {
      try {
        const key = 'guestJournalEntries'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestEntries: JournalEntry[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedJournalEntry) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestEntries.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'journalEntries')
        const migrated: JournalEntry[] = []

        guestEntries.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest journal entries', e)
        return []
      }
    },
    [],
  )

  const migrateGuestTDEEConfig = useCallback(
    async (user: FirebaseUser): Promise<void> => {
      try {
        const key = 'tdeeConfig'
        const saved = await AsyncStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved) as TDEEConfig
          const docRef = doc(db, 'users', user.uid)
          await setDoc(docRef, { tdeeConfig: parsed }, { merge: true })
        }
      } catch (e) {
        console.error('Failed to migrate guest TDEE config', e)
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

      offlineQueue.forEach((entry) => {
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
        await migrateGuestWeightLogs(firebaseUser)
        await migrateGuestCalorieLogs(firebaseUser)
        await migrateGuestJournalEntries(firebaseUser)
        await migrateGuestTDEEConfig(firebaseUser)
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
            // Merge with defaults to ensure new settings properties have values for existing users
            const mergedSettings = { ...defaultSettings, ...userData.settings }
            setSettings(mergedSettings)
            await AsyncStorage.setItem(
              'repCounterSettings',
              JSON.stringify(mergedSettings),
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
          // Sync TDEE Config
          if (userData.tdeeConfig) {
            setTdeeConfig(userData.tdeeConfig)
            await AsyncStorage.setItem(
              'tdeeConfig',
              JSON.stringify(userData.tdeeConfig),
            )
          }
        }

        // Step 4: Fetch a fresh copy of today's completions
        await fetchAllTodaysCompletions(firebaseUser)
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    },
    [
      migrateGuestHistory,
      migrateGuestWeightLogs,
      migrateGuestCalorieLogs,
      migrateGuestJournalEntries,
      migrateGuestTDEEConfig,
      syncOfflineQueue,
      fetchAllTodaysCompletions,
    ],
  )

  const fetchFullHistory = useCallback(
    async (
      user: FirebaseUser | null,
      daysBack: number = 90,
    ): Promise<WorkoutSet[]> => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysBack)
      cutoffDate.setHours(0, 0, 0, 0)
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate)

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
            where('date', '>=', cutoffTimestamp),
            orderBy('date', 'desc'),
          )
          const querySnapshot = await getDocs(q)
          return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]
        } catch (e) {
          console.error('Failed to fetch full history', e)
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
            .filter((item: WorkoutSet) => item.date.toDate() >= cutoffDate)
            .sort(
              (a: WorkoutSet, b: WorkoutSet) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          return allHistory
        } catch (e) {
          console.error('Failed to fetch guest full history', e)
          return []
        }
      }
    },
    [],
  )

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [calorieLogs, setCalorieLogs] = useState<CalorieLog[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])

  const fetchWeightLogs = useCallback(
    async (user: FirebaseUser | null): Promise<WeightLog[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'weightLogs')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const logs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WeightLog[]
          setWeightLogs(logs)
          return logs
        } catch (e) {
          console.error('Failed to fetch weight logs', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setWeightLogs([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestLogs = parsed
            .map((item: SerializedWeightLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: WeightLog, b: WeightLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setWeightLogs(guestLogs)
          return guestLogs
        } catch (e) {
          console.error('Failed to fetch guest weight logs', e)
          return []
        }
      }
    },
    [],
  )

  const addWeightLog = useCallback(
    async (weight: number, date: Date, user: FirebaseUser | null) => {
      const newLogBase = {
        weight,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'weightLogs')
          const docRef = await addDoc(collRef, newLogBase)
          const newEntry = {
            id: docRef.id,
            ...newLogBase,
          }
          setWeightLogs((prev) =>
            [newEntry, ...prev].sort(
              (a, b) => b.date.toMillis() - a.date.toMillis(),
            ),
          )
        } catch (e) {
          console.error('Failed to add weight log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestLogs = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...newLogBase,
          }
          const updatedLogs = [newEntry, ...guestLogs]
          await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

          // Reconstruct Timestamp for local state
          const stateLogs = updatedLogs
            .map((item: SerializedWeightLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: WeightLog, b: WeightLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setWeightLogs(stateLogs)
        } catch (e) {
          console.error('Failed to add guest weight log', e)
        }
      }
    },
    [],
  )

  const updateWeightLog = useCallback(
    async (
      id: string,
      weight: number,
      date: Date,
      user: FirebaseUser | null,
    ) => {
      const updates = {
        weight,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'weightLogs', id)
          await updateDoc(docRef, updates)
          setWeightLogs((prev) =>
            prev
              .map((item) => (item.id === id ? { ...item, ...updates } : item))
              .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
          )
        } catch (e) {
          console.error('Failed to update weight log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.map((item: SerializedWeightLog) =>
              item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedWeightLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: WeightLog, b: WeightLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setWeightLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to update guest weight log', e)
        }
      }
    },
    [],
  )

  const deleteWeightLog = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'weightLogs', id)
          await deleteDoc(docRef)
          setWeightLogs((prev) => prev.filter((item) => item.id !== id))
        } catch (e) {
          console.error('Failed to delete weight log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.filter(
              (item: SerializedWeightLog) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedWeightLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: WeightLog, b: WeightLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setWeightLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to delete guest weight log', e)
        }
      }
    },
    [],
  )

  const fetchCalorieLogs = useCallback(
    async (user: FirebaseUser | null): Promise<CalorieLog[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'calorieLogs')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const logs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as CalorieLog[]
          setCalorieLogs(logs)
          return logs
        } catch (e) {
          console.error('Failed to fetch calorie logs', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setCalorieLogs([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestLogs = parsed
            .map((item: SerializedCalorieLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: CalorieLog, b: CalorieLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setCalorieLogs(guestLogs)
          return guestLogs
        } catch (e) {
          console.error('Failed to fetch guest calorie logs', e)
          return []
        }
      }
    },
    [],
  )

  const addCalorieLog = useCallback(
    async (calories: number, date: Date, user: FirebaseUser | null) => {
      const newLogBase = {
        calories,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'calorieLogs')
          const docRef = await addDoc(collRef, newLogBase)
          const newEntry = {
            id: docRef.id,
            ...newLogBase,
          }
          setCalorieLogs((prev) =>
            [newEntry, ...prev].sort(
              (a, b) => b.date.toMillis() - a.date.toMillis(),
            ),
          )
        } catch (e) {
          console.error('Failed to add calorie log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestLogs = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...newLogBase,
          }
          const updatedLogs = [newEntry, ...guestLogs]
          await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

          // Reconstruct Timestamp for local state
          const stateLogs = updatedLogs
            .map((item: SerializedCalorieLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: CalorieLog, b: CalorieLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setCalorieLogs(stateLogs)
        } catch (e) {
          console.error('Failed to add guest calorie log', e)
        }
      }
    },
    [],
  )

  const updateCalorieLog = useCallback(
    async (
      id: string,
      calories: number,
      date: Date,
      user: FirebaseUser | null,
    ) => {
      const updates = {
        calories,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'calorieLogs', id)
          await updateDoc(docRef, updates)
          setCalorieLogs((prev) =>
            prev
              .map((item) => (item.id === id ? { ...item, ...updates } : item))
              .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
          )
        } catch (e) {
          console.error('Failed to update calorie log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.map((item: SerializedCalorieLog) =>
              item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedCalorieLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: CalorieLog, b: CalorieLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setCalorieLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to update guest calorie log', e)
        }
      }
    },
    [],
  )

  const deleteCalorieLog = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'calorieLogs', id)
          await deleteDoc(docRef)
          setCalorieLogs((prev) => prev.filter((item) => item.id !== id))
        } catch (e) {
          console.error('Failed to delete calorie log', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.filter(
              (item: SerializedCalorieLog) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedCalorieLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: CalorieLog, b: CalorieLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setCalorieLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to delete guest calorie log', e)
        }
      }
    },
    [],
  )

  // TDEE Config persistence
  const [tdeeConfig, setTdeeConfig] = useState<TDEEConfig | null>(null)

  const loadTDEEConfig = useCallback(
    async (user?: FirebaseUser | null): Promise<TDEEConfig | null> => {
      try {
        const saved = await AsyncStorage.getItem('tdeeConfig')
        if (saved) {
          const parsed = JSON.parse(saved) as TDEEConfig
          setTdeeConfig(parsed)
          return parsed
        }

        if (user) {
          const userDocRef = doc(db, 'users', user.uid)
          const userDoc = await getDoc(userDocRef)
          if (userDoc.exists()) {
            const userData = userDoc.data()
            if (userData && userData.tdeeConfig) {
              setTdeeConfig(userData.tdeeConfig)
              await AsyncStorage.setItem(
                'tdeeConfig',
                JSON.stringify(userData.tdeeConfig),
              )
              return userData.tdeeConfig
            }
          }
        }
        return null
      } catch (e) {
        console.error('Failed to load TDEE config', e)
        return null
      }
    },
    [],
  )

  const saveTDEEConfig = useCallback(
    async (config: TDEEConfig, user: FirebaseUser | null): Promise<void> => {
      try {
        setTdeeConfig(config)
        await AsyncStorage.setItem('tdeeConfig', JSON.stringify(config))

        if (user) {
          try {
            const docRef = doc(db, 'users', user.uid)
            await setDoc(docRef, { tdeeConfig: config }, { merge: true })
          } catch (e) {
            console.error('Failed to sync TDEE config to Firestore', e)
          }
        }
      } catch (e) {
        console.error('Failed to save TDEE config', e)
      }
    },
    [],
  )

  const deleteTDEEConfig = useCallback(
    async (user: FirebaseUser | null): Promise<void> => {
      try {
        setTdeeConfig(null)
        await AsyncStorage.removeItem('tdeeConfig')
        if (user) {
          try {
            const docRef = doc(db, 'users', user.uid)
            await updateDoc(docRef, { tdeeConfig: deleteField() })
          } catch (e) {
            console.error('Failed to delete TDEE config from Firestore', e)
          }
        }
      } catch (e) {
        console.error('Failed to delete TDEE config', e)
      }
    },
    [],
  )

  const fetchJournalEntries = useCallback(
    async (user: FirebaseUser | null): Promise<JournalEntry[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'journalEntries')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const entries = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as JournalEntry[]
          setJournalEntries(entries)
          return entries
        } catch (e) {
          console.error('Failed to fetch journal entries', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setJournalEntries([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestEntries = parsed
            .map((item: SerializedJournalEntry) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: JournalEntry, b: JournalEntry) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setJournalEntries(guestEntries)
          return guestEntries
        } catch (e) {
          console.error('Failed to fetch guest journal entries', e)
          return []
        }
      }
    },
    [],
  )

  const addJournalEntry = useCallback(
    async (
      note: string,
      date: Date,
      user: FirebaseUser | null,
      supplements?: SupplementLog[],
    ) => {
      const newEntryBase = {
        note,
        date: Timestamp.fromDate(date),
        supplements: supplements || [],
      }

      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'journalEntries')
          const docRef = await addDoc(collRef, newEntryBase)
          const newEntry = {
            id: docRef.id,
            ...newEntryBase,
          }
          setJournalEntries((prev) =>
            [newEntry, ...prev].sort(
              (a, b) => b.date.toMillis() - a.date.toMillis(),
            ),
          )
        } catch (e) {
          console.error('Failed to add journal entry', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestEntries = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...newEntryBase,
          }
          const updatedEntries = [newEntry, ...guestEntries]
          await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

          // Reconstruct Timestamp for local state
          const stateEntries = updatedEntries
            .map((item: SerializedJournalEntry) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: JournalEntry, b: JournalEntry) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setJournalEntries(stateEntries)
        } catch (e) {
          console.error('Failed to add guest journal entry', e)
        }
      }
    },
    [],
  )

  const updateJournalEntry = useCallback(
    async (
      id: string,
      note: string,
      date: Date,
      user: FirebaseUser | null,
      supplements?: SupplementLog[],
    ) => {
      const updates = {
        note,
        date: Timestamp.fromDate(date),
        supplements: supplements || [],
      }

      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'journalEntries', id)
          await updateDoc(docRef, updates)
          setJournalEntries((prev) =>
            prev
              .map((item) => (item.id === id ? { ...item, ...updates } : item))
              .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
          )
        } catch (e) {
          console.error('Failed to update journal entry', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestEntries = JSON.parse(savedRaw)
            const updatedEntries = guestEntries.map((item: SerializedJournalEntry) =>
              item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

            const stateEntries = updatedEntries
              .map((item: SerializedJournalEntry) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: JournalEntry, b: JournalEntry) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setJournalEntries(stateEntries)
          }
        } catch (e) {
          console.error('Failed to update guest journal entry', e)
        }
      }
    },
    [],
  )

  const deleteJournalEntry = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'journalEntries', id)
          await deleteDoc(docRef)
          setJournalEntries((prev) => prev.filter((item) => item.id !== id))
        } catch (e) {
          console.error('Failed to delete journal entry', e)
        }
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestEntries = JSON.parse(savedRaw)
            const updatedEntries = guestEntries.filter(
              (item: SerializedJournalEntry) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

            const stateEntries = updatedEntries
              .map((item: SerializedJournalEntry) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: JournalEntry, b: JournalEntry) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setJournalEntries(stateEntries)
          }
        } catch (e) {
          console.error('Failed to delete guest journal entry', e)
        }
      }
    },
    [],
  )

  return useMemo(
    () => ({
      settings,
      workouts,
      todaysCompletions,
      offlineQueue,
      weightLogs,
      calorieLogs,
      journalEntries,
      loadSettings,
      saveSettings,
      loadWorkouts,
      saveWorkouts,
      addHistoryEntry,
      updateHistoryEntry,
      deleteHistoryEntry,
      fetchHistory,
      fetchTodaysCompletions,
      fetchAllTodaysCompletions,
      isSetCompleted,
      getNextUncompletedSet,
      resetSetsFrom,
      arePreviousSetsCompleted,
      syncUserData,
      migrateGuestHistory,
      migrateGuestWeightLogs,
      syncOfflineQueue,
      fetchFullHistory,
      fetchWeightLogs,
      addWeightLog,
      updateWeightLog,
      deleteWeightLog,
      fetchCalorieLogs,
      addCalorieLog,
      updateCalorieLog,
      deleteCalorieLog,
      migrateGuestCalorieLogs,
      tdeeConfig,
      loadTDEEConfig,
      saveTDEEConfig,
      deleteTDEEConfig,
      migrateGuestJournalEntries,
      fetchJournalEntries,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      setWorkouts,
      setSettings,
      setOfflineQueue,
    }),
    [
      settings,
      workouts,
      todaysCompletions,
      offlineQueue,
      weightLogs,
      calorieLogs,
      journalEntries,
      loadSettings,
      saveSettings,
      loadWorkouts,
      saveWorkouts,
      addHistoryEntry,
      updateHistoryEntry,
      deleteHistoryEntry,
      fetchHistory,
      fetchTodaysCompletions,
      fetchAllTodaysCompletions,
      isSetCompleted,
      getNextUncompletedSet,
      resetSetsFrom,
      arePreviousSetsCompleted,
      syncUserData,
      migrateGuestHistory,
      migrateGuestWeightLogs,
      syncOfflineQueue,
      fetchFullHistory,
      fetchWeightLogs,
      addWeightLog,
      updateWeightLog,
      deleteWeightLog,
      fetchCalorieLogs,
      addCalorieLog,
      updateCalorieLog,
      deleteCalorieLog,
      migrateGuestCalorieLogs,
      tdeeConfig,
      loadTDEEConfig,
      saveTDEEConfig,
      deleteTDEEConfig,
      migrateGuestJournalEntries,
      fetchJournalEntries,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      setWorkouts,
      setSettings,
      setOfflineQueue,
    ],
  )
}
