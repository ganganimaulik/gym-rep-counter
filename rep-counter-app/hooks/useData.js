import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { getDefaultWorkouts } from '../utils/defaultWorkouts';

const defaultSettings = {
  countdownSeconds: 5,
  restSeconds: 60,
  maxReps: 15,
  maxSets: 3,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  volume: 1.0,
};

export const useData = (user) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [workouts, setWorkouts] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings');
      const parsed = savedSettings ? JSON.parse(savedSettings) : defaultSettings;
      setSettings(parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to load settings.', e);
      return defaultSettings;
    }
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
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
  }, [user]);

  const loadWorkouts = useCallback(async () => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts');
      if (savedWorkouts) {
        const parsed = JSON.parse(savedWorkouts);
        setWorkouts(parsed);
        return parsed;
      }
      const defaultWorkouts = getDefaultWorkouts();
      setWorkouts(defaultWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts));
      return defaultWorkouts;
    } catch (e) {
      console.error('Failed to load workouts.', e);
      return [];
    }
  }, []);

  const saveWorkouts = useCallback(async (newWorkouts) => {
    setWorkouts(newWorkouts);
    await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { workouts: newWorkouts }, { merge: true });
    }
  }, [user]);

  const syncUserData = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      // User signed out, load local data
      await loadSettings();
      await loadWorkouts();
      return;
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Merge remote data with local, remote taking precedence
      if (userData.settings) {
        await saveSettings(userData.settings);
      }
      if (userData.workouts) {
        await saveWorkouts(userData.workouts);
      }
    } else {
      // New user, push local data to remote
      const localSettings = await loadSettings();
      const localWorkouts = await loadWorkouts();
      await setDoc(userDocRef, {
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        settings: localSettings,
        workouts: localWorkouts,
      });
    }
  }, [loadSettings, saveSettings, loadWorkouts, saveWorkouts]);

  useEffect(() => {
    const loadInitialData = async () => {
      await loadSettings();
      await loadWorkouts();
      setDataLoaded(true);
    };
    loadInitialData();
  }, [loadSettings, loadWorkouts]);

  return { settings, saveSettings, workouts, saveWorkouts, dataLoaded, syncUserData };
};