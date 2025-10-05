import { useState, Dispatch, SetStateAction, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { getDefaultWorkouts } from '../utils/defaultWorkouts';
import type { User as FirebaseUser } from 'firebase/auth';

// Interfaces
export interface Settings {
  countdownSeconds: number;
  restSeconds: number;
  maxReps: number;
  maxSets: number;
  concentricSeconds: number;
  eccentricSeconds: number;
  eccentricCountdownEnabled: boolean;
  volume: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
}

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface DataHook {
  settings: Settings;
  workouts: Workout[];
  loadSettings: () => Promise<Settings>;
  saveSettings: (newSettings: Settings, user: FirebaseUser | null) => Promise<void>;
  loadWorkouts: () => Promise<Workout[]>;
  saveWorkouts: (newWorkouts: Workout[], user: FirebaseUser | null) => Promise<void>;
  syncUserData: (firebaseUser: FirebaseUser, localSettings: Settings, localWorkouts: Workout[]) => Promise<void>;
  setWorkouts: Dispatch<SetStateAction<Workout[]>>;
  setSettings: Dispatch<SetStateAction<Settings>>;
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
};

export const useData = (): DataHook => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const loadSettings = useCallback(async (): Promise<Settings> => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        return parsed;
      }
      setSettings(defaultSettings);
      return defaultSettings;
    } catch (e) {
      console.error('Failed to load settings.', e);
      return defaultSettings;
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: Settings, user: FirebaseUser | null) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem('repCounterSettings', JSON.stringify(newSettings));

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to save settings.', e);
    }
  }, []);

  const loadWorkouts = useCallback(async (): Promise<Workout[]> => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts');
      if (savedWorkouts) {
        const parsed = JSON.parse(savedWorkouts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkouts(parsed);
          return parsed;
        }
      }
      const defaultWorkouts = getDefaultWorkouts();
      setWorkouts(defaultWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts));
      return defaultWorkouts;
    } catch (e) {
      console.error('Failed to load workouts.', e);
      const defaultWorkouts = getDefaultWorkouts();
      setWorkouts(defaultWorkouts);
      return defaultWorkouts;
    }
  }, []);

  const saveWorkouts = useCallback(async (newWorkouts: Workout[], user: FirebaseUser | null) => {
    try {
      setWorkouts(newWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { workouts: newWorkouts }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to save workouts', e);
    }
  }, []);

  const syncUserData = useCallback(async (firebaseUser: FirebaseUser, localSettings: Settings, localWorkouts: Workout[]) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.settings) {
          setSettings(userData.settings);
          await AsyncStorage.setItem('repCounterSettings', JSON.stringify(userData.settings));
        }
        if (userData.workouts && Array.isArray(userData.workouts) && userData.workouts.length > 0) {
          setWorkouts(userData.workouts);
          await AsyncStorage.setItem('workouts', JSON.stringify(userData.workouts));
        } else {
          const defaultWorkouts = getDefaultWorkouts();
          setWorkouts(defaultWorkouts);
          await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts));
          await setDoc(userDocRef, { workouts: defaultWorkouts }, { merge: true });
        }
      } else {
        await setDoc(userDocRef, {
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          settings: localSettings,
          workouts: localWorkouts,
        });
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  }, []);

  return {
    settings,
    workouts,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    syncUserData,
    setWorkouts,
    setSettings,
  };
};