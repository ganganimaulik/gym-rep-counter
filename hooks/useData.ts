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
      const newEntryData = {
        ...entry,
        set,
        date: Timestamp.now(),
      };

      // For anonymous users, save to AsyncStorage
      if (!user) {
        try {
          const newEntry = { ...newEntryData, id: `local-${Date.now()}` };
          const localCompletionsStr = await AsyncStorage.getItem('todaysCompletions');
          const localCompletions = localCompletionsStr ? JSON.parse(localCompletionsStr) : [];

          const updatedCompletions = [...localCompletions, newEntry];

          await AsyncStorage.setItem('todaysCompletions', JSON.stringify(updatedCompletions));
          setTodaysCompletions(prev => [...prev, newEntry]);
        } catch (e) {
          console.error('Failed to save local history entry', e);
        }
        return;
      }

      // For logged-in users, save to Firestore
      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'history')
        const docRef = await addDoc(historyCollectionRef, newEntryData)
        setTodaysCompletions(prev => [...prev, { ...newEntryData, id: docRef.id }])
      } catch (e) {
        console.error('Failed to save history entry', e)
      }
    },
    [],
  )

  const fetchHistory = useCallback(
    async (user: FirebaseUser, lastVisible?: WorkoutSet) => {
      if (!user) return []

      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'history')
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
    },
    [],
  )

  const fetchTodaysCompletions = useCallback(
    async (user: FirebaseUser | null, exerciseId: string) => {
      // For anonymous users, load from AsyncStorage
      if (!user) {
        try {
          const localCompletionsStr = await AsyncStorage.getItem('todaysCompletions');
          if (localCompletionsStr) {
            const localCompletions: any[] = JSON.parse(localCompletionsStr);
            const today = getLocalDateString();

            const todaysSets = localCompletions
              .filter(item => {
                  const itemDate = new Timestamp(item.date.seconds, item.date.nanoseconds).toDate();
                  return getLocalDateString(itemDate) === today && item.exerciseId === exerciseId;
              })
              .map(item => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds)
              }));
            setTodaysCompletions(todaysSets);
          } else {
            setTodaysCompletions([]);
          }
        } catch (e) {
          console.error("Failed to fetch today's local completions", e);
          setTodaysCompletions([]);
        }
        return;
      }

      // For logged-in users, load from Firestore
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startOfToday = Timestamp.fromDate(today)

      try {
        const historyCollectionRef = collection(db, 'users', user.uid, 'history')
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
    async (exerciseId: string, setNumber: number, user: FirebaseUser | null) => {
      const setsToRemove = todaysCompletions.filter(
        (c) => c.exerciseId === exerciseId && c.set >= setNumber,
      );
      if (setsToRemove.length === 0) return;

      const remainingCompletions = todaysCompletions.filter(
        (c) => !setsToRemove.some((r) => r.id === c.id),
      );

      // For anonymous users, update AsyncStorage
      if (!user) {
        try {
          const allLocalCompletionsStr = await AsyncStorage.getItem('todaysCompletions');
          const allLocalCompletions = allLocalCompletionsStr ? JSON.parse(allLocalCompletionsStr) : [];

          const updatedCompletions = allLocalCompletions.filter(
            (c: WorkoutSet) => !setsToRemove.some((r) => r.id === c.id),
          );

          await AsyncStorage.setItem('todaysCompletions', JSON.stringify(updatedCompletions));
          setTodaysCompletions(remainingCompletions);
        } catch (e) {
          console.error('Failed to reset local sets', e);
        }
        return;
      }

      // For logged-in users, update Firestore
      try {
        const batch = writeBatch(db);
        setsToRemove.forEach((s) => {
          // Ensure we don't try to delete local-only ids from firestore
          if (!s.id.startsWith('local-')) {
             const docRef = doc(db, 'users', user.uid, 'history', s.id);
             batch.delete(docRef);
          }
        });
        await batch.commit();

        setTodaysCompletions(remainingCompletions);
      } catch (e) {
        console.error('Failed to reset sets', e);
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