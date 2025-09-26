import { StatusBar } from "expo-status-bar";
import { SafeAreaView, View, Pressable, Text, ScrollView, ActivityIndicator } from "react-native";
import { styled } from "nativewind";
import { Picker } from '@react-native-picker/picker';
import { useKeepAwake } from 'expo-keep-awake';

import Display from "./components/Display";
import Controls from "./components/Controls";
import { ProgressBar, PhaseDisplay } from "./components/Progress";
import StatusDisplay from "./components/StatusDisplay";
import SettingsPanel from "./components/SettingsPanel";
import WorkoutModal from "./components/WorkoutModal";

import { useState, useEffect, useRef, useMemo } from "react";
import { useWorkouts } from "./hooks/useWorkouts";
import { useSettings } from "./hooks/useSettings";
import { useAudio } from "./hooks/useAudio";

const StyledView = styled(View);
const StyledPressable = styled(Pressable);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);

export default function App() {
  // Hooks
  useKeepAwake();
  const { workouts, loading: workoutsLoading, ...workoutActions } = useWorkouts();
  const { settings, loading: settingsLoading, updateSingleSetting, updateSettings } = useSettings();
  const { speak, speakEccentric } = useAudio(settings.volume);

  // Core State
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);

  // UI State
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [status, setStatus] = useState("Press Start");

  // Timer and Cycle State
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Workout State
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const currentWorkout = useMemo(() => workouts.find(w => w.id === currentWorkoutId), [workouts, currentWorkoutId]);
  const currentExercise = useMemo(() => currentWorkout?.exercises[currentExerciseIndex], [currentWorkout, currentExerciseIndex]);

  // Effect to update timer settings when exercise changes
  useEffect(() => {
    if (currentExercise) {
      updateSettings({ maxReps: currentExercise.reps, maxSets: currentExercise.sets });
    }
  }, [currentExercise]);


  const stopAllIntervals = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // The main timer effect
  useEffect(() => {
    if (!isRunning || isPaused || isResting) {
        return;
    }

    let lastSpokenSecond = -1;
    intervalRef.current = setInterval(() => {
        let phaseDuration = phase === 'concentric' ? settings.concentricSeconds : settings.eccentricSeconds;

        setProgress(prev => {
            const newProgress = prev + (100 / (phaseDuration * 10));

            if (newProgress >= 100) {
                if (phase === 'concentric') {
                    setPhase('eccentric');
                } else {
                    setReps(r => {
                        const newRep = r + 1;
                        if (newRep >= settings.maxReps) {
                            handleEndSet();
                        } else {
                            speak((newRep + 1).toString());
                            setPhase('concentric');
                        }
                        return newRep;
                    });
                }
                return 0;
            }

            // Eccentric countdown speech
            if (phase === 'eccentric' && settings.eccentricCountdownEnabled) {
                const currentTime = (newProgress / 100) * phaseDuration;
                const currentIntegerSecond = Math.floor(currentTime);
                if (currentIntegerSecond > lastSpokenSecond) {
                    const numberToSpeak = Math.ceil(phaseDuration - currentTime);
                    if (numberToSpeak > 0) {
                        speakEccentric(numberToSpeak);
                    }
                    lastSpokenSecond = currentIntegerSecond;
                }
            }

            return newProgress;
        });
    }, 100);

    return stopAllIntervals;
  }, [isRunning, isPaused, isResting, phase, settings]);


  const startCountdown = (callback: () => void) => {
    stopAllIntervals();
    let count = settings.countdownSeconds;
    setStatus(`Get Ready... ${count}`);
    speak(`Get ready. ${count}`);

    intervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setStatus(`Get Ready... ${count}`);
        speak(count.toString());
      } else {
        stopAllIntervals();
        setStatus("Go!");
        speak("Go!");
        setTimeout(() => {
            setStatus("In Progress");
            callback();
        }, 500);
      }
    }, 1000);
  };

  const handleStart = () => {
    stopAllIntervals();
    setReps(0);
    setSets(1);
    setIsPaused(false);
    setIsResting(false);

    startCountdown(() => {
        setIsRunning(true);
        setPhase('concentric');
        setProgress(0);
        speak("1");
    });
  };

  const handlePause = () => {
    setIsPaused((prev) => {
      setStatus(prev ? "In Progress" : "Paused");
      if (!prev) speak("Paused");
      return !prev;
    });
  };

  const handleStop = () => {
    stopAllIntervals();
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setReps(0);
    setSets(1);
    setProgress(0);
    setPhase("");
    setStatus("Press Start");
  };

  const handleEndSet = () => {
    stopAllIntervals();
    setIsRunning(false);

    setSets((prevSets) => {
        const nextSet = prevSets + 1;
        if (nextSet > settings.maxSets) {
            speak("Exercise complete!");
            if (currentWorkout && currentExerciseIndex < currentWorkout.exercises.length - 1) {
                setCurrentExerciseIndex(prev => prev + 1);
                setStatus(`Next: ${currentWorkout.exercises[currentExerciseIndex + 1].name}`);
            } else {
                setStatus("Workout Complete!");
                speak("Workout complete. Well done!");
            }
            handleStop();
            return prevSets;
        }

        setIsResting(true);
        let restCount = settings.restSeconds;
        setStatus(`Rest: ${restCount}s`);
        speak(`Set ${prevSets} complete. Rest for ${restCount} seconds.`);

        intervalRef.current = setInterval(() => {
            restCount--;
            setStatus(`Rest: ${restCount}s`);
            if (restCount <= 3 && restCount > 0) {
                speak(restCount.toString());
            }
            if (restCount <= 0) {
                stopAllIntervals();
                setIsResting(false);
                setReps(0);
                speak(`Rest complete. Starting set ${nextSet}`);
                startCountdown(() => {
                    setIsRunning(true);
                    setPhase('concentric');
                    speak("1");
                });
            }
        }, 1000);

        return nextSet;
    });
  };

  if (workoutsLoading || settingsLoading) {
    return (
      <StyledView className="flex-1 items-center justify-center bg-gray-900">
        <ActivityIndicator size="large" color="#3B82F6" />
      </StyledView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
      <StyledScrollView className="w-full">
        <StyledView className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6 my-4">
          <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
            <StyledView className="flex-row justify-between items-center">
              <StyledText className="text-lg font-semibold text-white">Current Workout</StyledText>
              <StyledPressable
                className="flex-row items-center space-x-2 rounded-lg bg-gray-600 px-3 py-2"
                onPress={() => setWorkoutModalVisible(true)}
              >
                <StyledText className="text-white">Manage</StyledText>
              </StyledPressable>
            </StyledView>
            <StyledView className="bg-gray-600 border border-gray-500 rounded-md text-white">
              <Picker
                selectedValue={currentWorkoutId}
                onValueChange={(itemValue) => {
                  setCurrentWorkoutId(itemValue);
                  setCurrentExerciseIndex(0);
                  handleStop();
                }}
                style={{ color: 'white' }}
                dropdownIconColor="white"
              >
                <Picker.Item label="Select a workout..." value={null} />
                {workouts.map((workout) => (
                  <Picker.Item key={workout.id} label={workout.name} value={workout.id} />
                ))}
              </Picker>
            </StyledView>
            <StyledView>
              <StyledText className="text-sm text-gray-400">Current Exercise:</StyledText>
              <StyledText className="text-lg font-medium text-white">
                {currentExercise ? `${currentExerciseIndex + 1}. ${currentExercise.name}` : '--'}
              </StyledText>
            </StyledView>
          </StyledView>

          <StatusDisplay status={status} />
          <Display reps={reps} sets={sets} />
          <PhaseDisplay phase={phase} />
          <ProgressBar progress={progress} />
          <Controls
            isRunning={isRunning}
            isPaused={isPaused}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
            onEndSet={handleEndSet}
          />
          <StyledView className="items-center">
            <StyledPressable onPress={() => setSettingsVisible((prev) => !prev)}>
              <StyledText className="text-blue-400">Settings</StyledText>
            </StyledPressable>
          </StyledView>
          <SettingsPanel
            visible={settingsVisible}
            settings={settings}
            onSettingsChange={updateSingleSetting}
            onSave={() => setSettingsVisible(false)}
          />
          <StatusBar style="light" />
        </StyledView>
      </StyledScrollView>
      <WorkoutModal
        visible={workoutModalVisible}
        onClose={() => setWorkoutModalVisible(false)}
        workouts={workouts}
        {...workoutActions}
      />
    </SafeAreaView>
  );
}