import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  StatusBar,
  AppState,
  TouchableOpacity,
} from 'react-native';
import { styled } from 'nativewind';
import { useKeepAwake } from 'expo-keep-awake';
import { Settings as SettingsIcon } from 'lucide-react-native';
import {
  enableBackgroundExecution,
  disableBackgroundExecution,
} from 'expo-background-timer';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import { useAudio } from './hooks/useAudio';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';

// Components
import SettingsModal from './components/SettingsModal';
import WorkoutManagementModal from './components/WorkoutManagementModal';
import UserProfile from './components/layout/UserProfile';
import WorkoutSelector from './components/layout/WorkoutSelector';
import TimerDisplay from './components/layout/TimerDisplay';
import TimerControls from './components/layout/TimerControls';
import RepJumper from './components/layout/RepJumper';

const StyledSafeAreaView = styled(SafeAreaView);
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

const App = () => {
  useKeepAwake();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // --- Custom Hooks ---
  const {
    settings,
    saveSettings,
    workouts,
    saveWorkouts,
    dataLoaded,
    syncUserData,
  } = useData();

  const { user, initializing, onGoogleButtonPress, disconnectAccount } =
    useAuth(syncUserData);

  const audio = useAudio(settings.volume);

  const handleSetComplete = useCallback(
    (isWorkoutComplete) => {
      if (isWorkoutComplete) {
        if (
          currentWorkout &&
          currentExerciseIndex < currentWorkout.exercises.length - 1
        ) {
          handleNextExercise();
        } else {
          // Last exercise of workout is complete
          timer.stopWorkout();
        }
      }
    },
    [currentWorkout, currentExerciseIndex]
  );

  const timer = useWorkoutTimer(settings, audio, handleSetComplete);

  // --- Effects ---
  useEffect(() => {
    enableBackgroundExecution();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        syncUserData(user);
      }
    });

    return () => {
      subscription.remove();
      disableBackgroundExecution();
    };
  }, [user, syncUserData]);

  useEffect(() => {
    if (currentWorkout && currentWorkout.exercises.length > 0) {
      const exercise = currentWorkout.exercises[currentExerciseIndex];
      saveSettings({
        ...settings,
        maxReps: exercise.reps,
        maxSets: exercise.sets,
      }, user);
    }
  }, [currentWorkout, currentExerciseIndex, user]);

  // --- Event Handlers ---
  const handleSelectWorkout = (workoutId) => {
    const workout = workouts.find((w) => w.id === workoutId);
    setCurrentWorkout(workout);
    setCurrentExerciseIndex(0);
    timer.stopWorkout();
  };

  const handleNextExercise = () => {
    if (
      currentWorkout &&
      currentExerciseIndex < currentWorkout.exercises.length - 1
    ) {
      timer.stopWorkout();
      setCurrentExerciseIndex((prev) => prev + 1);
      audio.speak(
        `Next exercise: ${
          currentWorkout.exercises[currentExerciseIndex + 1].name
        }`
      );
    }
  };

  const handlePrevExercise = () => {
    if (currentWorkout && currentExerciseIndex > 0) {
      timer.stopWorkout();
      setCurrentExerciseIndex((prev) => prev - 1);
      audio.speak(
        `Previous exercise: ${
          currentWorkout.exercises[currentExerciseIndex - 1].name
        }`
      );
    }
  };

  const handleSaveSettings = (newSettings) => {
    saveSettings(newSettings, user);
  };

  const handleSaveWorkouts = (newWorkouts) => {
    saveWorkouts(newWorkouts, user);
  }

  if (initializing || !dataLoaded) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
        <StyledText className="text-white text-xl">Loading...</StyledText>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StatusBar barStyle="light-content" />
      <StyledScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <StyledView className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
          <UserProfile user={user} onDisconnect={disconnectAccount} />

          <WorkoutSelector
            workouts={workouts}
            currentWorkout={currentWorkout}
            currentExerciseIndex={currentExerciseIndex}
            onSelectWorkout={handleSelectWorkout}
            onNextExercise={handleNextExercise}
            onPrevExercise={handlePrevExercise}
            onManageWorkouts={() => setWorkoutModalVisible(true)}
            settings={settings}
          />

          <TimerDisplay
            statusText={timer.statusText}
            currentRep={timer.currentRep}
            currentSet={timer.currentSet}
            phase={timer.phase}
          />

          <TimerControls {...timer} />

          <RepJumper
            maxReps={settings.maxReps}
            currentRep={timer.currentRep}
            onJumpToRep={timer.jumpToRep}
          />

          <StyledView className="items-center">
            <StyledTouchableOpacity
              onPress={() => setSettingsVisible(true)}
              className="flex-row items-center space-x-2"
            >
              <SettingsIcon color="#60a5fa" size={16} />
              <StyledText className="text-blue-400">Settings</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledScrollView>

      <WorkoutManagementModal
        visible={workoutModalVisible}
        onClose={() => setWorkoutModalVisible(false)}
        workouts={workouts}
        setWorkouts={handleSaveWorkouts}
      />
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSave={handleSaveSettings}
        onGoogleButtonPress={onGoogleButtonPress}
        user={user}
        disconnectAccount={disconnectAccount}
      />
    </StyledSafeAreaView>
  );
};

export default App;