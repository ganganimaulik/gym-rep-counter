import { useState, Dispatch, SetStateAction, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
  weight: number
}

export interface Workout {
  id: string
  name: string
  exercises: Exercise[]
}

export interface RepHistoryLog {
  exerciseId: string
  setNumber: number
  repsCompleted: number
  weight: number
  timestamp: number // Unix timestamp
}

export interface DataHook {
  settings: Settings
  workouts: Workout[]
  history: RepHistoryLog[]
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
  loadHistory: () => Promise<RepHistoryLog[]>
  saveHistory: (
    newHistory: RepHistoryLog[],
    user: FirebaseUser | null,
  ) => Promise<void>
  logCompletedSet: (
    exerciseId: string,
    setNumber: number,
    repsCompleted: number,
    weight: number,
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
    localHistory: RepHistoryLog[],
  ) => Promise<void>
  setWorkouts: Dispatch<SetStateAction<Workout[]>>
  setSettings: Dispatch<SetStateAction<Settings>>
  setHistory: Dispatch<SetStateAction<RepHistoryLog[]>>
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

const getLocalDateString = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useData = (): DataHook => {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    getDefaultWorkouts(),
  )
  const [history, setHistory] = useState<RepHistoryLog[]>([])

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

  const loadHistory = useCallback(async (): Promise<RepHistoryLog[]> => {
    try {
      const savedHistory = await AsyncStorage.getItem('repHistory')
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory)
        setHistory(parsed)
        return parsed
      }
      return []
    } catch (e) {
      console.error('Failed to load history.', e)
      return []
    }
  }, [])

  const saveHistory = useCallback(
    async (newHistory: RepHistoryLog[], user: FirebaseUser | null) => {
      try {
        setHistory(newHistory)
        await AsyncStorage.setItem('repHistory', JSON.stringify(newHistory))

        if (user) {
          const userDocRef = doc(db, 'users', user.uid)
          await setDoc(userDocRef, { history: newHistory }, { merge: true })
        }
      } catch (e) {
        console.error('Failed to save history.', e)
      }
    },
    [],
  )

  const logCompletedSet = useCallback(
    async (
      exerciseId: string,
      setNumber: number,
      repsCompleted: number,
      weight: number,
      user: FirebaseUser | null,
    ) => {
      const newLog: RepHistoryLog = {
        exerciseId,
        setNumber,
        repsCompleted,
        weight,
        timestamp: Date.now(),
      }

      const newHistory = [...history, newLog]
      await saveHistory(newHistory, user)
    },
    [history, saveHistory],
  )

  const getTodaysCompletions = useCallback(
    (exerciseId: string): RepHistoryLog[] => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const startOfDayTimestamp = startOfDay.getTime()

      return history.filter(
        (log) =>
          log.exerciseId === exerciseId && log.timestamp >= startOfDayTimestamp,
      )
    },
    [history],
  )

  const isSetCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      const todaysCompletions = getTodaysCompletions(exerciseId)
      return todaysCompletions.some((log) => log.setNumber === setNumber)
    },
    [getTodaysCompletions],
  )

  const getNextUncompletedSet = useCallback(
    (exerciseId: string): number => {
      const todaysCompletions = getTodaysCompletions(exerciseId)
      const completedSets = todaysCompletions.map((log) => log.setNumber)

      if (completedSets.length === 0) {
        return 1
      }

      const maxSet = Math.max(...completedSets)
      return maxSet + 1
    },
    [getTodaysCompletions],
  )

  const resetSetsFrom = useCallback(
    async (exerciseId: string, setNumber: number, user: FirebaseUser | null) => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const startOfDayTimestamp = startOfDay.getTime()

      const newHistory = history.filter(
        (log) =>
          !(
            log.exerciseId === exerciseId &&
            log.timestamp >= startOfDayTimestamp &&
            log.setNumber >= setNumber
          ),
      )

      if (newHistory.length !== history.length) {
        await saveHistory(newHistory, user)
      }
    },
    [history, saveHistory],
  )

  const arePreviousSetsCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      if (setNumber <= 1) {
        return true
      }

      const todaysCompletions = getTodaysCompletions(exerciseId)
      const completedSetNumbers = todaysCompletions.map((log) => log.setNumber)
      const requiredSets = Array.from({ length: setNumber - 1 }, (_, i) => i + 1)

      return requiredSets.every((s) => completedSetNumbers.includes(s))
    },
    [getTodaysCompletions],
  )

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
      localHistory: RepHistoryLog[],
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
          // Sync History
          if (userData.history) {
            setHistory(userData.history)
            await AsyncStorage.setItem(
              'repHistory',
              JSON.stringify(userData.history),
            )
          }
        } else {
          // New user, upload local data
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
            history: localHistory,
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
    history,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    loadHistory,
    saveHistory,
    logCompletedSet,
    isSetCompleted,
    resetSetsFrom,
    arePreviousSetsCompleted,
    getNextUncompletedSet,
    syncUserData,
    setWorkouts,
    setSettings,
    setHistory,
  }
}
