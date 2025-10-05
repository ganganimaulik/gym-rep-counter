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
}

export interface Workout {
  id: string
  name: string
  exercises: Exercise[]
}

export interface SetCompletion {
  date: string
  completed: number[]
}

export interface SetCompletions {
  [exerciseId: string]: SetCompletion
}

export interface DataHook {
  settings: Settings
  workouts: Workout[]
  setCompletions: SetCompletions
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
  loadSetCompletions: () => Promise<SetCompletions>
  saveSetCompletions: (
    newCompletions: SetCompletions,
    user: FirebaseUser | null,
  ) => Promise<void>
  markSetAsCompleted: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
  resetSetsFrom: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  syncUserData: (
    firebaseUser: FirebaseUser,
    localSettings: Settings,
    localWorkouts: Workout[],
    localSetCompletions: SetCompletions,
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
  const [setCompletions, setSetCompletions] = useState<SetCompletions>({})

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

  const loadSetCompletions = useCallback(async (): Promise<SetCompletions> => {
    try {
      const saved = await AsyncStorage.getItem('setCompletions')
      if (saved) {
        const parsed: SetCompletions = JSON.parse(saved)
        const today = getLocalDateString()
        // Reset completions if the date is not today
        Object.keys(parsed).forEach((exerciseId) => {
          if (parsed[exerciseId].date !== today) {
            delete parsed[exerciseId]
          }
        })
        setSetCompletions(parsed)
        return parsed
      }
      return {}
    } catch (e) {
      console.error('Failed to load set completions.', e)
      return {}
    }
  }, [])

  const saveSetCompletions = useCallback(
    async (newCompletions: SetCompletions, user: FirebaseUser | null) => {
      try {
        setSetCompletions(newCompletions)
        await AsyncStorage.setItem(
          'setCompletions',
          JSON.stringify(newCompletions),
        )
        if (user) {
          const userDocRef = doc(db, 'users', user.uid)
          await setDoc(
            userDocRef,
            { setCompletions: newCompletions },
            { merge: true },
          )
        }
      } catch (e) {
        console.error('Failed to save set completions', e)
      }
    },
    [],
  )

  const markSetAsCompleted = useCallback(
    async (exerciseId: string, setNumber: number, user: FirebaseUser | null) => {
      const today = getLocalDateString()
      const newCompletions = { ...setCompletions }

      if (
        !newCompletions[exerciseId] ||
        newCompletions[exerciseId].date !== today
      ) {
        newCompletions[exerciseId] = { date: today, completed: [] }
      }

      if (!newCompletions[exerciseId].completed.includes(setNumber)) {
        newCompletions[exerciseId].completed.push(setNumber)
        newCompletions[exerciseId].completed.sort((a, b) => a - b)
      }

      await saveSetCompletions(newCompletions, user)
    },
    [setCompletions, saveSetCompletions],
  )

  const isSetCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      const today = getLocalDateString()
      const completion = setCompletions[exerciseId]
      return (
        completion &&
        completion.date === today &&
        completion.completed.includes(setNumber)
      )
    },
    [setCompletions],
  )

  const resetSetsFrom = useCallback(
    async (exerciseId: string, setNumber: number, user: FirebaseUser | null) => {
      const today = getLocalDateString()
      const newCompletions = { ...setCompletions }

      if (
        newCompletions[exerciseId] &&
        newCompletions[exerciseId].date === today
      ) {
        newCompletions[exerciseId].completed = newCompletions[
          exerciseId
        ].completed.filter((s) => s < setNumber)
      }

      await saveSetCompletions(newCompletions, user)
    },
    [setCompletions, saveSetCompletions],
  )

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
      localSetCompletions: SetCompletions,
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
          // Sync Set Completions
          if (userData.setCompletions) {
            setSetCompletions(userData.setCompletions)
            await AsyncStorage.setItem(
              'setCompletions',
              JSON.stringify(userData.setCompletions),
            )
          }
        } else {
          // New user, upload local data
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
            setCompletions: localSetCompletions,
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
    setCompletions,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    loadSetCompletions,
    saveSetCompletions,
    markSetAsCompleted,
    isSetCompleted,
    resetSetsFrom,
    syncUserData,
    setWorkouts,
    setSettings,
  }
}
