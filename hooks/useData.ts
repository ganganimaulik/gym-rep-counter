import { useState, Dispatch, SetStateAction, useCallback } from 'react'
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
  setWorkouts: Dispatch<SetStateAction<Workout[]>>
  setSettings: Dispatch<SetStateAction<Settings>>
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
      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const newEntry = {
            ...entry,
            set,
            date: Timestamp.now(),
          }
          const docRef = await addDoc(historyCollectionRef, newEntry)
          setTodaysCompletions(prev => [...prev, { ...newEntry, id: docRef.id }])
        } catch (e) {
          console.error('Failed to save history entry', e)
        }
      } else {
        // Guest user
        try {
          const newEntry: WorkoutSet = {
            ...entry,
            set,
            id: `${Date.now()}-${entry.exerciseId}-${set}`,
            date: Timestamp.now(),
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
    [todaysCompletions],
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
            .map((item: any) => ({
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
              (item: any) => ({
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

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
    ) => {
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      try {
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
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
          } else {
            const defaultWorkouts = getDefaultWorkouts()
            setWorkouts(defaultWorkouts)
            await AsyncStorage.setItem(
              'workouts',
              JSON.stringify(defaultWorkouts),
            )
            await setDoc(
              userDocRef,
              { workouts: defaultWorkouts },
              { merge: true },
            )
          }
        } else {
          // New user, upload local data
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
          })
        }
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    },
    [],
  )

  return {
    settings,
    workouts,
    todaysCompletions,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    addHistoryEntry,
    fetchHistory,
    fetchTodaysCompletions,
    isSetCompleted,
    getNextUncompletedSet,
    resetSetsFrom,
    arePreviousSetsCompleted,
    syncUserData,
    setWorkouts,
    setSettings,
  }
}