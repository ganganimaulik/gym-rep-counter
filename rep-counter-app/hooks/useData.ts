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
  getDocs,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  deleteField,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getDefaultWorkouts } from '../utils/defaultWorkouts'
import type { User as FirebaseUser } from 'firebase/auth'

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

export interface RepHistoryLog {
  id?: string // Add id for keying in lists
  exerciseId: string
  setNumber: number
  reps: number
  weight: number
  date: Timestamp
}

export interface DataHook {
  settings: Settings
  workouts: Workout[]
  repHistory: RepHistoryLog[]
  loadingHistory: boolean
  hasMoreHistory: boolean
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
  loadRepHistory: (user: FirebaseUser | null, isInitial?: boolean) => Promise<void>
  loadTodaysHistory: (user: FirebaseUser | null) => Promise<void>
  logSet: (
    log: Omit<RepHistoryLog, 'date' | 'id'>,
    user: FirebaseUser | null,
  ) => Promise<void>
  isSetCompleted: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<boolean>
  resetSetsFrom: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  arePreviousSetsCompleted: (exerciseId: string, setNumber: number) => boolean
  getNextUncompletedSet: (exerciseId: string) => number
  syncUserData: (
    firebaseUser: FirebaseUser,
    localSettings: Settings,
    localWorkouts: Workout[],
  ) => Promise<void>
  setWorkouts: Dispatch<SetStateAction<Workout[]>>
  setSettings: Dispatch<SetStateAction<Settings>>
  setRepHistory: Dispatch<SetStateAction<RepHistoryLog[]>>
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

const getTodayTimestamps = () => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  )
  return {
    start: Timestamp.fromDate(startOfDay),
    end: Timestamp.fromDate(endOfDay),
  }
}

export const useData = (): DataHook => {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    getDefaultWorkouts(),
  )
  const [repHistory, setRepHistory] = useState<RepHistoryLog[]>([])
  const [lastHistoryDoc, setLastHistoryDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)

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

  const loadRepHistory = useCallback(
    async (user: FirebaseUser | null, isInitial = false) => {
      if (!user || loadingHistory || (!hasMoreHistory && !isInitial)) return
      setLoadingHistory(true)

      // On a fresh load, reset pagination
      const startDoc = isInitial ? null : lastHistoryDoc
      if (isInitial) {
        setRepHistory([])
        setLastHistoryDoc(null)
        setHasMoreHistory(true)
      }

      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'repHistory')

        const q = startDoc
          ? query(
              historyCollectionRef,
              orderBy('date', 'desc'),
              startAfter(startDoc),
              limit(25),
            )
          : query(historyCollectionRef, orderBy('date', 'desc'), limit(25))

        const querySnapshot = await getDocs(q)
        const newHistory: RepHistoryLog[] = []
        querySnapshot.forEach((doc) => {
          newHistory.push({ id: doc.id, ...doc.data() } as RepHistoryLog)
        })

        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1]
        setLastHistoryDoc(lastVisible)

        if (querySnapshot.empty || querySnapshot.docs.length < 25) {
          setHasMoreHistory(false)
        }

        if (isInitial) {
          setRepHistory(newHistory)
        } else {
          setRepHistory((prev) => [...prev, ...newHistory])
        }
      } catch (e) {
        console.error('Failed to load rep history.', e)
      } finally {
        setLoadingHistory(false)
      }
    },
    [loadingHistory, hasMoreHistory, lastHistoryDoc],
  )

  const loadTodaysHistory = useCallback(async (user: FirebaseUser | null) => {
    if (!user) return

    try {
      const { start, end } = getTodayTimestamps()
      const historyCollectionRef = collection(
        db,
        'users',
        user.uid,
        'repHistory',
      )
      const q = query(
        historyCollectionRef,
        where('date', '>=', start),
        where('date', '<=', end),
      )

      const querySnapshot = await getDocs(q)
      const todaysHistory: RepHistoryLog[] = []
      querySnapshot.forEach((doc) => {
        todaysHistory.push({ id: doc.id, ...doc.data() } as RepHistoryLog)
      })

      setRepHistory((prev) => {
        const otherDaysHistory = prev.filter(
          (log) => log.date < start || log.date > end,
        )
        const updatedHistory = [...otherDaysHistory, ...todaysHistory]
        updatedHistory.sort((a, b) => b.date.toMillis() - a.date.toMillis())
        return updatedHistory
      })
    } catch (e) {
      console.error('Failed to load todays rep history.', e)
    }
  }, [])

  const logSet = useCallback(
    async (log: Omit<RepHistoryLog, 'date' | 'id'>, user: FirebaseUser | null) => {
      if (!user) return

      const newLog: Omit<RepHistoryLog, 'id'> = {
        ...log,
        date: Timestamp.now(),
      }

      try {
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'repHistory',
        )
        const docRef = await addDoc(historyCollectionRef, newLog)

        // Add to local state for immediate UI update
        setRepHistory((prev) =>
          [{ id: docRef.id, ...newLog } as RepHistoryLog, ...prev].sort(
            (a, b) => b.date.toMillis() - a.date.toMillis(),
          ),
        )

      } catch (e) {
        console.error('Failed to log set.', e)
      }
    },
    [],
  )

  const isSetCompleted = useCallback(
    async (
      exerciseId: string,
      setNumber: number,
      user: FirebaseUser | null,
    ): Promise<boolean> => {
      if (!user) return false

      const { start, end } = getTodayTimestamps()

      // Check local state first for quick feedback
      const completedLocally = repHistory.some(log =>
        log.exerciseId === exerciseId &&
        log.setNumber === setNumber &&
        log.date >= start &&
        log.date <= end
      )
      if (completedLocally) return true

      try {
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'repHistory',
        )
        const q = query(
          historyCollectionRef,
          where('exerciseId', '==', exerciseId),
          where('setNumber', '==', setNumber),
          where('date', '>=', start),
          where('date', '<=', end),
          limit(1)
        )

        const querySnapshot = await getDocs(q)
        return !querySnapshot.empty
      } catch (e) {
        console.error('Failed to check if set is completed.', e)
        return false
      }
    },
    [repHistory],
  )

  const getNextUncompletedSet = useCallback(
    (exerciseId: string): number => {
      const { start } = getTodayTimestamps()

      const completedSets = repHistory
        .filter(
          (log) =>
            log.exerciseId === exerciseId && log.date >= start,
        )
        .map((log) => log.setNumber)
        .sort((a, b) => a - b)

      if (completedSets.length === 0) {
        return 1
      }

      for (let i = 0; i < completedSets.length; i++) {
        if (completedSets[i] !== i + 1) {
          return i + 1
        }
      }

      return completedSets.length + 1
    },
    [repHistory],
  )

  const resetSetsFrom = useCallback(
    async (exerciseId: string, setNumber: number, user: FirebaseUser | null) => {
      if (!user) return

      const { start, end } = getTodayTimestamps()
      try {
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'repHistory',
        )
        const q = query(
          historyCollectionRef,
          where('exerciseId', '==', exerciseId),
          where('setNumber', '>=', setNumber),
          where('date', '>=', start),
          where('date', '<=', end),
        )

        const snapshot = await getDocs(q)
        const batch = writeBatch(db)
        const idsToDelete: string[] = []
        snapshot.forEach((doc) => {
          batch.delete(doc.ref)
          idsToDelete.push(doc.id)
        })
        await batch.commit()

        setRepHistory((prev) =>
          prev.filter((log) => !idsToDelete.includes(log.id!)),
        )
      } catch (e) {
        console.error('Failed to reset sets.', e)
      }
    },
    [],
  )

  const arePreviousSetsCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      if (setNumber <= 1) {
        return true
      }

      const { start } = getTodayTimestamps()

      const completedSets = new Set(
        repHistory
          .filter(
            (log) =>
              log.exerciseId === exerciseId && log.date >= start,
          )
          .map((log) => log.setNumber),
      )

      const requiredSets = Array.from({ length: setNumber - 1 }, (_, i) => i + 1)
      return requiredSets.every((s) => completedSets.has(s))
    },
    [repHistory],
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
          if (userData.settings) {
            setSettings(userData.settings)
            await AsyncStorage.setItem(
              'repCounterSettings',
              JSON.stringify(userData.settings),
            )
          }
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

          if (userData.repHistory) {
            await setDoc(userDocRef, { repHistory: deleteField() }, { merge: true });
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
    repHistory,
    loadingHistory,
    hasMoreHistory,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    loadRepHistory,
    loadTodaysHistory,
    logSet,
    isSetCompleted,
    resetSetsFrom,
    arePreviousSetsCompleted,
    getNextUncompletedSet,
    syncUserData,
    setWorkouts,
    setSettings,
    setRepHistory,
  }
}
