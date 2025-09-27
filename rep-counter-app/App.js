import "./global.css";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Alert,
  Text,
  Pressable,
} from "react-native";
import { styled } from "nativewind";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from "expo-keep-awake";

// Import UI Components
import WorkoutSelector from "./components/WorkoutSelector";
import Display from "./components/Display";
import ProgressBar from "./components/ProgressBar";
import Controls from "./components/Controls";
import ExerciseNavigation from "./components/ExerciseNavigation";
import NumberJump from "./components/NumberJump";
import Settings from "./components/Settings";
import WorkoutModal from "./components/WorkoutModal";

// Styled Components
const StyledSafeAreaView = styled(SafeAreaView);
const StyledScrollView = styled(ScrollView);
const StyledView = styled(View);
const StyledPressable = styled(Pressable);
const StyledText = styled(Text);

// --- Constants & Helpers ---
const WORKOUTS_STORAGE_KEY = "@RepCounter:workouts";
const SETTINGS_STORAGE_KEY = "@RepCounter:settings";
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const getDefaultWorkouts = () => [
    {
      id: generateId(),
      name: "Day 1 (Lower)",
      exercises: [{ id: generateId(), name: "Leg Press", sets: 4, reps: 10 }],
    },
    {
      id: generateId(),
      name: "Day 2 (Upper)",
      exercises: [{ id: generateId(), name: "Horizontal Press", sets: 4, reps: 10 }],
    },
];

const App = () => {
  // --- State ---
  const [currentRep, setCurrentRep] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [statusText, setStatusText] = useState("Press Start");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [settings, setSettings] = useState({
    countdownSeconds: 3, restSeconds: 60, concentricSeconds: 1, eccentricSeconds: 4,
    eccentricCountdownEnabled: true, volume: 1.0,
  });
  const [workouts, setWorkouts] = useState([]);
  const [currentWorkoutId, setCurrentWorkoutId] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // --- Refs & Native State ---
  const intervalRef = useRef(null);
  const [sound, setSound] = useState();
  const [femaleVoice, setFemaleVoice] = useState(null);

  // --- Derived State ---
  const currentWorkout = workouts.find(w => w.id === currentWorkoutId);
  const currentExercise = currentWorkout?.exercises[currentExerciseIndex];
  const maxReps = currentExercise?.reps ?? 12;
  const maxSets = currentExercise?.sets ?? 3;

  // --- Native Features ---
  useEffect(() => {
    if (isRunning && !isPaused) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwakeAsync();
    }
  }, [isRunning, isPaused]);

  const speak = useCallback((text) => {
    Speech.speak(text, { volume: settings.volume, voice: femaleVoice });
  }, [settings.volume, femaleVoice]);

  const playBeep = useCallback(async () => {
    if (sound) {
      try {
        await sound.setVolumeAsync(settings.volume);
        await sound.replayAsync();
      } catch (e) { console.error("Error playing beep", e); }
    } else {
      console.log("[BEEP] (Audio file not available)");
    }
  }, [sound, settings.volume]);

  // --- Data Persistence ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) setSettings(JSON.parse(savedSettings));

        const savedWorkouts = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
        if (savedWorkouts && JSON.parse(savedWorkouts).length > 0) {
          setWorkouts(JSON.parse(savedWorkouts));
        } else {
          setWorkouts(getDefaultWorkouts());
        }
      } catch (e) { console.error("Failed to load data", e); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (workouts.length > 0) {
      AsyncStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
    }
  }, [workouts]);

  const handleSaveSettings = async () => {
      try {
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
          Alert.alert("Settings Saved");
          setSettingsVisible(false);
      } catch (e) { Alert.alert("Error", "Failed to save settings."); }
  };

  // --- Audio/Speech Setup ---
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    // In a real app, you'd load a sound file here, e.g.:
    // const { sound } = await Audio.Sound.createAsync(require('./assets/beep.mp3'));
    // setSound(sound);

    Speech.getAvailableVoicesAsync().then(voices => {
        let foundVoice = voices.find(v => v.language.startsWith('en-US') && v.name.includes('Female'));
        if (!foundVoice) foundVoice = voices.find(v => v.language.startsWith('en') && v.name.includes('Female'));
        setFemaleVoice(foundVoice?.identifier);
    });
    return () => sound?.unloadAsync();
  }, []);

  // --- Core Timer Logic ---
  const startRepCycle = useCallback(() => {
    let phaseTime = 0;
    let currentPhase = 'concentric';
    setPhase('Concentric');

    // Immediately advance rep count
    const nextRep = currentRep + 1;
    if (nextRep > maxReps) {
        handleEndSet();
        return;
    }
    setCurrentRep(nextRep);
    speak(String(nextRep));

    intervalRef.current = setInterval(() => {
        phaseTime += 0.1;
        const phaseDuration = currentPhase === 'concentric' ? settings.concentricSeconds : settings.eccentricSeconds;
        setProgress((phaseTime / phaseDuration) * 100);

        if (phaseTime >= phaseDuration) {
            if (currentPhase === 'concentric') {
                phaseTime = 0;
                currentPhase = 'eccentric';
                setPhase('Eccentric');
            } else {
                clearInterval(intervalRef.current);
                startRepCycle();
            }
        }
    }, 100);
  }, [currentRep, maxReps, settings, handleEndSet, speak]);

  const startCountdown = useCallback((callback) => {
    clearInterval(intervalRef.current);
    let count = settings.countdownSeconds;
    setStatusText(`Get Ready... ${count}`);
    speak(`Get ready. ${count}`);

    intervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setStatusText(`Get Ready... ${count}`);
        speak(String(count));
      } else {
        clearInterval(intervalRef.current);
        setStatusText("Go!");
        speak("Go!");
        playBeep();
        callback();
      }
    }, 1000);
  }, [settings.countdownSeconds, speak, playBeep]);

  // --- Control Handlers ---
  const handleStart = useCallback((startRep = 0) => {
    if (!currentWorkout) {
        Alert.alert("No Workout Selected", "Please select a workout first.");
        return;
    }
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentSet(1);
    setCurrentRep(startRep);
    setProgress(0);

    startCountdown(() => {
        setStatusText("In Progress");
        if (startRep > 0) {
            // Manually trigger first rep cycle
            let manualRep = startRep - 1;
            setCurrentRep(manualRep);
            startRepCycle();
        } else {
            startRepCycle();
        }
    });
  }, [currentWorkout, startCountdown, startRepCycle]);

  const handlePause = () => {
      setIsPaused(!isPaused);
      if (!isPaused) {
        speak("Paused");
        setStatusText("Paused");
        clearInterval(intervalRef.current);
      } else {
        // Resuming
        startCountdown(() => {
            setStatusText("In Progress");
            startRepCycle();
        });
      }
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(0);
    setCurrentSet(1);
    setProgress(0);
    setPhase("");
    setStatusText("Press Start");
  };

  const handleEndSet = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);

    if (currentSet >= maxSets) {
      speak("Exercise complete!");
      if (currentExerciseIndex < currentWorkout.exercises.length - 1) {
          Alert.alert("Exercise Complete", `Next up: ${currentWorkout.exercises[currentExerciseIndex + 1].name}`, [{ text: "OK", onPress: handleNextExercise }]);
      } else {
          Alert.alert("Workout Complete!", "Well done!");
          handleStop();
      }
    } else {
      setIsResting(true);
      let restCount = settings.restSeconds;
      speak(`Set ${currentSet} complete. Rest for ${restCount} seconds.`);

      intervalRef.current = setInterval(() => {
        restCount--;
        setStatusText(`Rest: ${restCount}s`);
        if (restCount <= 3 && restCount > 0) playBeep();

        if (restCount <= 0) {
          clearInterval(intervalRef.current);
          setIsResting(false);
          setCurrentSet(prev => prev + 1);
          setCurrentRep(0);
          setProgress(0);
          setStatusText(`Press Start for Set ${currentSet + 1}`);
        }
      }, 1000);
    }
  }, [currentSet, maxSets, settings.restSeconds, speak, playBeep, currentWorkout, currentExerciseIndex, handleNextExercise]);

  const handleJumpToRep = (rep) => {
    handleStop();
    setTimeout(() => handleStart(rep), 100);
  };

  const handleSelectWorkout = (workoutId) => {
      handleStop();
      setCurrentWorkoutId(workoutId);
      setCurrentExerciseIndex(0);
  };

  const handleNextExercise = useCallback(() => {
      if (currentWorkout && currentExerciseIndex < currentWorkout.exercises.length - 1) {
          handleStop();
          setCurrentExerciseIndex(prev => prev + 1);
      }
  }, [currentWorkout, currentExerciseIndex]);

  const handlePrevExercise = () => {
      if (currentExerciseIndex > 0) {
          handleStop();
          setCurrentExerciseIndex(prev => prev - 1);
      }
  };

  // --- CRUD ---
  const handleAddWorkout = (name) => setWorkouts(prev => [...prev, { id: generateId(), name, exercises: [] }]);
  const handleDeleteWorkout = (id) => setWorkouts(prev => prev.filter(w => w.id !== id));
  const handleAddExercise = (workoutId, name, sets, reps) => {
      const newEx = { id: generateId(), name, sets, reps };
      setWorkouts(prev => prev.map(w => w.id === workoutId ? {...w, exercises: [...w.exercises, newEx]} : w));
  };
  const handleDeleteExercise = (workoutId, exId) => {
      setWorkouts(prev => prev.map(w => w.id === workoutId ? {...w, exercises: w.exercises.filter(e => e.id !== exId)} : w));
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StyledScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
        <StyledView className="bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6 mt-8">

          <WorkoutSelector
            workouts={workouts}
            selectedWorkoutId={currentWorkoutId}
            onSelectWorkout={handleSelectWorkout}
            onManageWorkouts={() => setModalVisible(true)}
            exercise={currentExercise}
            exerciseIndex={currentExerciseIndex}
            totalExercises={currentWorkout?.exercises.length ?? 0}
          />

          <Display reps={currentRep} sets={currentSet} phase={phase} status={statusText} />
          <ProgressBar progress={progress} />

          <Controls
            isRunning={isRunning}
            isPaused={isPaused}
            isResting={isResting}
            onStart={() => isResting ? setIsRunning(true) : handleStart()}
            onPause={handlePause}
            onEndSet={handleEndSet}
            onStop={handleStop}
          />

          {currentWorkout && <ExerciseNavigation onPrev={handlePrevExercise} onNext={handleNextExercise} isPrevDisabled={currentExerciseIndex === 0} isNextDisabled={!currentWorkout || currentExerciseIndex === currentWorkout.exercises.length - 1} />}
          <NumberJump maxReps={maxReps} onJumpToRep={handleJumpToRep} activeRep={currentRep} />
          <Settings isVisible={isSettingsVisible} onToggle={() => setSettingsVisible(!isSettingsVisible)} settings={settings} onSettingChange={(key, value) => setSettings(s => ({...s, [key]: value}))} onSave={handleSaveSettings} />
        </StyledView>
      </StyledScrollView>

      <WorkoutModal isVisible={isModalVisible} onClose={() => setModalVisible(false)} workouts={workouts} onAddWorkout={handleAddWorkout} onDeleteWorkout={handleDeleteWorkout} onAddExercise={handleAddExercise} onDeleteExercise={handleDeleteExercise} />
      <StatusBar style="light" />
    </StyledSafeAreaView>
  );
};

export default App;