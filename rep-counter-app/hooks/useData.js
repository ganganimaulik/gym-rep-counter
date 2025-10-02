import { useState } from 'react';
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

export const useData = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [workouts, setWorkouts] = useState([]);

  const loadSettings = async () => {
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
  };

  const saveSettings = async (newSettings, user) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem(
        'repCounterSettings',
        JSON.stringify(newSettings)
      );

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to save settings.', e);
    }
  };

  const loadWorkouts = async () => {
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
  };

  const saveWorkouts = async (newWorkouts, user) => {
    try {
        setWorkouts(newWorkouts);
        await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { workouts: newWorkouts }, { merge: true });
        }
    } catch (e) {
        console.error('Failed to save workouts', e)
    }
  };

  const syncUserData = async (firebaseUser, localSettings, localWorkouts) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Sync settings from Firestore if they exist
      if (userData.settings) {
        setSettings(userData.settings);
        await AsyncStorage.setItem(
          'repCounterSettings',
          JSON.stringify(userData.settings)
        );
      }
      // Sync workouts from Firestore if they exist
      if (userData.workouts) {
        setWorkouts(userData.workouts);
        await AsyncStorage.setItem(
          'workouts',
          JSON.stringify(userData.workouts)
        );
      }
    } else {
      // If no remote data, upload local data
      await setDoc(userDocRef, {
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        settings: localSettings,
        workouts: localWorkouts,
      });
    }
  };

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