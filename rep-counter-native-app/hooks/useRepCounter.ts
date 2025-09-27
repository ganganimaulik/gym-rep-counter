import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as KeepAwake from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default Workouts
const getDefaultWorkouts = () => [
  { id: '1', name: 'Day 1 (Lower)', exercises: [{ id: '1-1', name: 'Leg Press', sets: 4, reps: 10 }, { id: '1-2', name: 'RDL', sets: 4, reps: 10 }]},
  { id: '2', name: 'Day 2 (Upper)', exercises: [{ id: '2-1', name: 'Horizontal Press', sets: 4, reps: 10 }, { id: '2-2', name: 'Horizontal Row', sets: 4, reps: 12 }]},
];

export const useRepCounter = () => {
  // State
  const [currentRep, setCurrentRep] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [restSeconds, setRestSeconds] = useState(60);
  const [concentricSeconds, setConcentricSeconds] = useState(1);
  const [eccentricSeconds, setEccentricSeconds] = useState(4);
  const [eccentricCountdownEnabled, setEccentricCountdownEnabled] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [statusText, setStatusText] = useState('Press Start');
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);

  // Workout State
  const [workouts, setWorkouts] = useState(getDefaultWorkouts());
  const [currentWorkout, setCurrentWorkout] = useState(workouts[0]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const exercise = currentWorkout.exercises[currentExerciseIndex];
  const maxReps = exercise.reps;
  const maxSets = exercise.sets;

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerStateRef = useRef({ phaseTime: 0 });
  const tickCallback = useRef<() => void>();

  // --- Core Functions ---

  const stopAllIntervals = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string, rate = 1.0) => {
    Speech.isSpeakingAsync().then(isSpeaking => {
        if (isSpeaking) Speech.stop();
        Speech.speak(text, { volume, rate });
    });
  }, [volume]);

  const silentWavDataUri = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';

  const playBeep = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: silentWavDataUri }, { shouldPlay: true, volume });
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log('Error playing beep:', error);
    }
  };

  const stopWorkout = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    stopAllIntervals();
    setCurrentRep(0);
    setCurrentSet(1);
    setStatusText('Press Start');
    setProgress(0);
    setPhase('');
    KeepAwake.deactivateKeepAwakeAsync();
  }, [stopAllIntervals]);

  const startRestTimer = useCallback((completedSet: number) => {
    setIsResting(true);
    let restCount = restSeconds;
    setStatusText(`Rest: ${restCount}s`);
    speak(`Set ${completedSet} complete. Rest for ${restSeconds} seconds.`);

    intervalRef.current = setInterval(() => {
      restCount--;
      setStatusText(`Rest: ${restCount}s`);
      if (restCount <= 0) {
        stopAllIntervals();
        setIsResting(false);
        speak('Rest complete. Press start for next set.');
        setCurrentSet(prevSet => {
            setStatusText(`Press Start for Set ${prevSet}`);
            return prevSet;
        });
      }
    }, 1000);
  }, [restSeconds, speak, stopAllIntervals]);

  const endSet = useCallback(() => {
    stopAllIntervals();
    setCurrentSet(prevSet => {
        if (prevSet < maxSets) {
            startRestTimer(prevSet);
            return prevSet + 1;
        } else {
            speak('Exercise complete!');
            stopWorkout();
            return prevSet;
        }
    });
  }, [maxSets, speak, stopWorkout, startRestTimer]);

  useEffect(() => {
    tickCallback.current = () => {
      timerStateRef.current.phaseTime += 0.1;
      const duration = phase === 'concentric' ? concentricSeconds : eccentricSeconds;
      setProgress((timerStateRef.current.phaseTime / duration) * 100);

      if (timerStateRef.current.phaseTime >= duration) {
        timerStateRef.current.phaseTime = 0;
        if (phase === 'concentric') {
          setPhase('eccentric');
        } else {
          const nextRep = currentRep + 1;
          if (nextRep > maxReps) {
            endSet();
          } else {
            speak(String(nextRep));
            setCurrentRep(nextRep);
            setPhase('concentric');
          }
        }
      }
    };
  }, [currentRep, phase, concentricSeconds, eccentricSeconds, maxReps, speak, endSet]);

  useEffect(() => {
    if (isRunning && !isPaused && !isResting) {
      intervalRef.current = setInterval(() => tickCallback.current?.(), 100);
    } else {
      stopAllIntervals();
    }
    return stopAllIntervals;
  }, [isRunning, isPaused, isResting, stopAllIntervals]);

  const startCountdown = useCallback((callback: () => void) => {
    stopAllIntervals();
    let count = countdownSeconds;
    setStatusText(`Get Ready... ${count}`);
    speak(`Get ready. ${count}`);

    intervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setStatusText(`Get Ready... ${count}`);
        speak(String(count));
      } else {
        stopAllIntervals();
        setStatusText('Go!');
        speak('Go!');
        playBeep();
        callback();
      }
    }, 1000);
  }, [countdownSeconds, speak, stopAllIntervals]);

  const startWorkout = useCallback(() => {
    if (isRunning) return;
    setCurrentRep(0);
    setCurrentSet(1);
    KeepAwake.activateKeepAwakeAsync();
    startCountdown(() => {
      setIsRunning(true);
      setIsPaused(false);
      setIsResting(false);
      setCurrentRep(1);
      setPhase('concentric');
      speak('1');
      timerStateRef.current.phaseTime = 0;
    });
  }, [isRunning, startCountdown, speak]);

  const pauseWorkout = () => {
    if (!isRunning) return;
    setIsPaused(prev => !prev);
    if (!isPaused) {
      speak('Paused');
      setStatusText('Paused');
      KeepAwake.deactivateKeepAwakeAsync();
    } else {
      KeepAwake.activateKeepAwakeAsync();
      setStatusText(phase);
    }
  };

  const jumpToRep = (rep: number) => {
    stopAllIntervals();
    KeepAwake.activateKeepAwakeAsync();
    startCountdown(() => {
      setIsRunning(true);
      setIsPaused(false);
      setIsResting(false);
      setCurrentRep(rep);
      setPhase('concentric');
      speak(String(rep));
      timerStateRef.current.phaseTime = 0;
    });
  };

  // --- Effects ---
  useEffect(() => {
    // Configure audio session for background playback
    const setAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // DoNotMix
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // DoNotMix
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.error("Failed to set audio mode", e);
      }
    };

    // Load settings from storage
    const loadSettings = async () => {
      const storedSettings = await AsyncStorage.getItem('settings');
      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        setCountdownSeconds(settings.countdownSeconds ?? 5);
        setRestSeconds(settings.restSeconds ?? 60);
        setConcentricSeconds(settings.concentricSeconds ?? 1);
        setEccentricSeconds(settings.eccentricSeconds ?? 4);
        setVolume(settings.volume ?? 1.0);
      }
    };

    setAudioMode();
    loadSettings();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      stopAllIntervals();
      KeepAwake.deactivateKeepAwakeAsync();
    };
  }, [stopAllIntervals]);

  const saveSettings = async () => {
    const settings = {
      countdownSeconds,
      restSeconds,
      concentricSeconds,
      eccentricSeconds,
      eccentricCountdownEnabled,
      volume,
    };
    await AsyncStorage.setItem('settings', JSON.stringify(settings));
  };

  // --- Workout Management ---
  const saveWorkouts = async (newWorkouts) => {
    setWorkouts(newWorkouts);
    await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
  };

  const addWorkout = (name) => {
    const newWorkout = { id: Date.now().toString(), name, exercises: [] };
    saveWorkouts([...workouts, newWorkout]);
  };

  const deleteWorkout = (id) => {
    const newWorkouts = workouts.filter(w => w.id !== id);
    saveWorkouts(newWorkouts);
  };

  const addExercise = (workoutId, exercise) => {
    const newWorkouts = workouts.map(w => {
      if (w.id === workoutId) {
        return { ...w, exercises: [...w.exercises, { ...exercise, id: Date.now().toString() }] };
      }
      return w;
    });
    saveWorkouts(newWorkouts);
  };

  const deleteExercise = (workoutId, exerciseId) => {
    const newWorkouts = workouts.map(w => {
      if (w.id === workoutId) {
        return { ...w, exercises: w.exercises.filter(e => e.id !== exerciseId) };
      }
      return w;
    });
    saveWorkouts(newWorkouts);
  };

  const selectWorkout = (workout) => {
    setCurrentWorkout(workout);
    setCurrentExerciseIndex(0);
    stopWorkout();
  };

  useEffect(() => {
    const loadWorkouts = async () => {
      const storedWorkouts = await AsyncStorage.getItem('workouts');
      if (storedWorkouts) {
        setWorkouts(JSON.parse(storedWorkouts));
        setCurrentWorkout(JSON.parse(storedWorkouts)[0] || null);
      }
    };
    loadWorkouts();
  }, []);

  return {
    // State
    currentRep, currentSet, maxReps, maxSets, isRunning, isPaused, isResting,
    statusText, phase, progress,
    // Settings
    countdownSeconds, setCountdownSeconds,
    restSeconds, setRestSeconds,
    concentricSeconds, setConcentricSeconds,
    eccentricSeconds, setEccentricSeconds,
    eccentricCountdownEnabled, setEccentricCountdownEnabled,
    volume, setVolume,
    saveSettings,
    // Workout Data
    workouts,
    currentWorkout,
    exercise,
    // Workout Functions
    addWorkout,
    deleteWorkout,
    addExercise,
    deleteExercise,
    selectWorkout,
    // Core Functions
    startWorkout, pauseWorkout, stopWorkout, jumpToRep,
  };
};