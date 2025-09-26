import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  countdownSeconds: number;
  maxReps: number;
  maxSets: number;
  restSeconds: number;
  concentricSeconds: number;
  eccentricSeconds: number;
  eccentricCountdownEnabled: boolean;
  volume: number;
}

const SETTINGS_KEY = 'repCounterSettings';

const defaultSettings: Settings = {
  countdownSeconds: 5,
  maxReps: 15,
  maxSets: 3,
  restSeconds: 60,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  volume: 1.0,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (e) {
        console.error("Failed to load settings.", e);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save settings.", e);
    }
  };

  const updateSingleSetting = (key: keyof Settings, value: any) => {
    updateSettings({ [key]: value });
  };

  return { settings, loading, updateSettings, updateSingleSetting };
};