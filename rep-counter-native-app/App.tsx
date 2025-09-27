import React from 'react';
import { SafeAreaView, StatusBar, View } from 'react-native';
import { styled } from 'nativewind';
import WorkoutSelection from './components/WorkoutSelection';
import MainDisplay from './components/MainDisplay';
import ProgressBar from './components/ProgressBar';
import Controls from './components/Controls';
import NumberButtons from './components/NumberButtons';
import Settings from './components/Settings';
import { useRepCounter } from './hooks/useRepCounter';

const StyledSafeAreaView = styled(SafeAreaView);
const StyledView = styled(View);

const App = () => {
  const {
    currentRep,
    currentSet,
    statusText,
    phase,
    progress,
    isRunning,
    isPaused,
    maxReps,
    startWorkout,
    pauseWorkout,
    stopWorkout,
    jumpToRep,
    workouts,
    currentWorkout,
    selectWorkout,
    addWorkout,
    deleteWorkout,
    addExercise,
    deleteExercise,
    countdownSeconds,
    restSeconds,
    concentricSeconds,
    eccentricSeconds,
    eccentricCountdownEnabled,
    volume,
    setCountdownSeconds,
    setRestSeconds,
    setConcentricSeconds,
    setEccentricSeconds,
    setEccentricCountdownEnabled,
    setVolume,
    saveSettings,
  } = useRepCounter();

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StatusBar barStyle="light-content" />
      <StyledView className="flex-1 items-center justify-center p-4">
        <StyledView className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
          <WorkoutSelection
            workouts={workouts}
            currentWorkout={currentWorkout}
            selectWorkout={selectWorkout}
            addWorkout={addWorkout}
            deleteWorkout={deleteWorkout}
            addExercise={addExercise}
            deleteExercise={deleteExercise}
          />
          <MainDisplay
            rep={currentRep}
            set={currentSet}
            status={statusText}
            phase={phase}
          />
          <ProgressBar progress={progress} />
          <Controls
            isRunning={isRunning}
            isPaused={isPaused}
            startWorkout={startWorkout}
            pauseWorkout={pauseWorkout}
            stopWorkout={stopWorkout}
          />
          <NumberButtons maxReps={maxReps} onJumpToRep={jumpToRep} />
          <Settings
            settings={{
              countdownSeconds,
              restSeconds,
              concentricSeconds,
              eccentricSeconds,
              eccentricCountdownEnabled,
              volume,
            }}
            setters={{
              setCountdownSeconds,
              setRestSeconds,
              setConcentricSeconds,
              setEccentricSeconds,
              setEccentricCountdownEnabled,
              setVolume,
            }}
            saveSettings={saveSettings}
          />
        </StyledView>
      </StyledView>
    </StyledSafeAreaView>
  );
};

export default App;