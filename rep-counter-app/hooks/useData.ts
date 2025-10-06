import { useState, Dispatch, SetStateAction, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
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
  id: string
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
  loadRepHistoryFromLocal: () => Promise<RepHistoryLog[]>
  loadRepHistoryFromCloud: (
    user: FirebaseUser | null,
    isInitial?: boolean,
  ) => Promise<void>
  syncHistory: (user: FirebaseUser) => Promise<void>
  logSet: (
    log: Omit<RepHistoryLog, 'date' | 'id'>,
    user: FirebaseUser | null,
  ) => Promise<void>
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
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
    localRepHistory: RepHistoryLog[],
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

// --- Serialization Helpers ---
const serializeHistory = (history: RepHistoryLog[]): string => {
  const serializable = history.map((log) => ({
    ...log,
    date: log.date.toDate().toISOString(),
  }))
  return JSON.stringify(serializable)
}

const deserializeHistory = (jsonString: string | null): RepHistoryLog[] => {
  if (!jsonString) return []
  try {
    const parsed = JSON.parse(jsonString)
    if (!Array.isArray(parsed)) return []
    return parsed.map((log: any) => ({
      ...log,
      id: String(log.id),
      date: Timestamp.fromDate(new Date(log.date)),
    }))
  } catch (e) {
    console.error('Failed to deserialize history', e)
    return []
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

  const saveRepHistoryToLocal = useCallback(
    async (history: RepHistoryLog[]) => {
      try {
        await AsyncStorage.setItem('repHistory', serializeHistory(history))
      } catch (e) {
        console.error('Failed to save rep history locally.', e)
      }
    },
    [],
  )

  const loadRepHistoryFromLocal = useCallback(async (): Promise<RepHistoryLog[]> => {
    try {
      const saved = await AsyncStorage.getItem('repHistory')
      const history = deserializeHistory(saved)
      setRepHistory(history)
      return history
    } catch (e) {
      console.error('Failed to load rep history from local storage.', e)
      return []
    }
  }, [])

  const loadRepHistoryFromCloud = useCallback(
    async (user: FirebaseUser | null, isInitial = false) => {
      if (!user || (loadingHistory && !isInitial) || (!hasMoreHistory && !isInitial)) return
      setLoadingHistory(true)

      const startDoc = isInitial ? null : lastHistoryDoc
      if (isInitial) {
        setLastHistoryDoc(null)
        setHasMoreHistory(true)
      }

      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'repHistory')
        const q = startDoc
          ? query(historyCollectionRef, orderBy('date', 'desc'), startAfter(startDoc), limit(25))
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

        setRepHistory((prev) => {
          const existingIds = new Set(prev.map((log) => log.id))
          const merged = [...prev, ...newHistory.filter((log) => !existingIds.has(log.id))]
          merged.sort((a, b) => b.date.toMillis() - a.date.toMillis())
          return merged
        })
      } catch (e) {
        console.error('Failed to load rep history from cloud.', e)
      } finally {
        setLoadingHistory(false)
      }
    },
    [loadingHistory, hasMoreHistory, lastHistoryDoc],
  )

  const logSet = useCallback(
    async (
      log: Omit<RepHistoryLog, 'date' | 'id'>,
      user: FirebaseUser | null,
    ) => {
      const newDocRef = doc(collection(db, 'dummy_for_id_generation'))
      const newLog: RepHistoryLog = {
        id: newDocRef.id,
        ...log,
        date: Timestamp.now(),
      }

      const updatedHistory = [newLog, ...repHistory].sort((a, b) => b.date.toMillis() - a.date.toMillis())
      setRepHistory(updatedHistory)
      await saveRepHistoryToLocal(updatedHistory)

      if (user) {
        try {
          const historyDocRef = doc(db, 'users', user.uid, 'repHistory', newLog.id)
          await setDoc(historyDocRef, {
            exerciseId: newLog.exerciseId,
            setNumber: newLog.setNumber,
            reps: newLog.reps,
            weight: newLog.weight,
            date: newLog.date,
          })
        } catch (e) {
          console.error('Failed to log set to Firestore.', e)
        }
      }
    },
    [repHistory, saveRepHistoryToLocal],
  )

  const isSetCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      const { start, end } = getTodayTimestamps()
      return repHistory.some((log) => log.exerciseId === exerciseId && log.setNumber === setNumber && log.date >= start && log.date <= end)
    },
    [repHistory],
  )

  const getNextUncompletedSet = useCallback(
    (exerciseId: string): number => {
      const { start } = getTodayTimestamps()
      const completedSets = repHistory.filter((log) => log.exerciseId === exerciseId && log.date >= start).map((log) => log.setNumber).sort((a, b) => a - b)
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
    async (
      exerciseId: string,
      setNumber: number,
      user: FirebaseUser | null,
    ) => {
      const { start, end } = getTodayTimestamps()
      const logsToKeep = repHistory.filter((log) => !(log.exerciseId === exerciseId && log.date >= start && log.date <= end && log.setNumber >= setNumber))
      const logsToDelete = repHistory.filter((log) => log.exerciseId === exerciseId && log.date >= start && log.date <= end && log.setNumber >= setNumber)

      setRepHistory(logsToKeep)
      await saveRepHistoryToLocal(logsToKeep)

      if (user && logsToDelete.length > 0) {
        try {
          const batch = writeBatch(db)
          const historyCollectionRef = collection(db, 'users', user.uid, 'repHistory')
          logsToDelete.forEach(log => {
            batch.delete(doc(historyCollectionRef, log.id))
          })
          await batch.commit()
        } catch (e) {
          console.error('Failed to reset sets in Firestore.', e)
        }
      }
    },
    [repHistory, saveRepHistoryToLocal],
  )

  const arePreviousSetsCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      if (setNumber <= 1) {
        return true
      }
      const { start } = getTodayTimestamps()
      const completedSets = new Set(repHistory.filter((log) => log.exerciseId === exerciseId && log.date >= start).map((log) => log.setNumber))
      const requiredSets = Array.from({ length: setNumber - 1 }, (_, i) => i + 1)
      return requiredSets.every((s) => completedSets.has(s))
    },
    [repHistory],
  )

  const syncHistory = useCallback(
    async (user: FirebaseUser) => {
      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'repHistory')
        const cloudSnapshot = await getDocs(historyCollectionRef)
        const cloudHistory: RepHistoryLog[] = []
        cloudSnapshot.forEach((doc) => {
          cloudHistory.push({ id: doc.id, ...doc.data() } as RepHistoryLog)
        })
        const cloudHistoryMap = new Map(cloudHistory.map(log => [log.id, log]))

        const localHistory = repHistory
        const localHistoryMap = new Map(localHistory.map(log => [log.id, log]))

        const toUpload = localHistory.filter(log => !cloudHistoryMap.has(log.id))
        const toDownload = cloudHistory.filter(log => !localHistoryMap.has(log.id))

        if (toUpload.length > 0) {
          const batch = writeBatch(db)
          toUpload.forEach(log => {
            const docRef = doc(historyCollectionRef, log.id)
            batch.set(docRef, {
                exerciseId: log.exerciseId,
                setNumber: log.setNumber,
                reps: log.reps,
                weight: log.weight,
                date: log.date,
            })
          })
          await batch.commit()
        }

        if (toDownload.length > 0) {
          const finalHistory = [...localHistory, ...toDownload].sort((a, b) => b.date.toMillis() - a.date.toMillis())
          setRepHistory(finalHistory)
          await saveRepHistoryToLocal(finalHistory)
        }
      } catch (error) {
        console.error('Error syncing history:', error)
      }
    },
    [repHistory, saveRepHistoryToLocal],
  )

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
      localRepHistory: RepHistoryLog[],
    ) => {
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      try {
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (userData.settings) {
            setSettings(userData.settings)
            await AsyncStorage.setItem('repCounterSettings', JSON.stringify(userData.settings))
          }
          if (userData.workouts && Array.isArray(userData.workouts) && userData.workouts.length > 0) {
            setWorkouts(userData.workouts)
            await AsyncStorage.setItem('workouts', JSON.stringify(userData.workouts))
          } else {
            const defaultWorkouts = getDefaultWorkouts()
            setWorkouts(defaultWorkouts)
            await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts))
            await setDoc(userDocRef, { workouts: defaultWorkouts }, { merge: true })
          }

          if (userData.repHistory && Array.isArray(userData.repHistory)) {
            const historyCollectionRef = collection(db, 'users', firebaseUser.uid, 'repHistory')
            const batch = writeBatch(db)
            userData.repHistory.forEach((oldLog: any) => {
              const newDocRef = doc(historyCollectionRef)
              batch.set(newDocRef, {
                ...oldLog,
                date: Timestamp.fromDate(new Date(oldLog.date))
              })
            });
            await batch.commit()
            await setDoc(userDocRef, { repHistory: deleteField() }, { merge: true })
          }

        } else {
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
          })
          if (localRepHistory.length > 0) {
            const historyCollectionRef = collection(db, 'users', firebaseUser.uid, 'repHistory')
            const batch = writeBatch(db)
            localRepHistory.forEach(log => {
              const { id, ...logData } = log
              const docRef = doc(historyCollectionRef, id)
              batch.set(docRef, logData)
            })
            await batch.commit()
          }
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
    loadRepHistoryFromLocal,
    loadRepHistoryFromCloud,
    syncHistory,
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