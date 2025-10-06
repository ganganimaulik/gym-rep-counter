import 'react-native-gesture-handler'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  AppState,
  AppStateStatus,
} from 'react-native'
import { styled } from 'nativewind'
import { useKeepAwake } from 'expo-keep-awake'
import { Settings as SettingsIcon, History } from 'lucide-react-native'
import {
  enableBackgroundExecution,
  disableBackgroundExecution,
} from 'expo-background-timer'
import type { User as FirebaseUser } from 'firebase/auth'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useData, Settings, Workout, RepHistoryLog } from './hooks/useData'
import { useAudio } from './hooks/useAudio'
import { useWorkoutTimer } from './hooks/useWorkoutTimer'

// Components
import SettingsModal from './components/SettingsModal'
import HistoryLogModal from './components/HistoryLogModal'
import WorkoutManagementModal from './components/WorkoutManagementModal'
import UserProfile from './components/layout/UserProfile'
import WorkoutSelector from './components/layout/WorkoutSelector'
import MainDisplay from './components/layout/MainDisplay'
import Controls from './components/layout/Controls'
import RepJumper from './components/layout/RepJumper'

const StyledSafeAreaView = styled(SafeAreaView)
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

const App: React.FC = () => {
  useKeepAwake()

  // UI State
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false)
  const [workoutModalVisible, setWorkoutModalVisible] = useState<boolean>(false)
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false)

  // Workout State
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0)
  const [currentWeight, setCurrentWeight] = useState<number>(0)

  // Custom Hooks
  const {
    settings,
    workouts,
    history,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    loadHistory,
    syncUserData,
    setWorkouts,
    setSettings: setDataSettings,
    logCompletedSet,
    isSetCompleted,
    resetSetsFrom,
    arePreviousSetsCompleted,
    getNextUncompletedSet,
  } = useData()

  const onAuthSuccess = useCallback(
    async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const localSettings = await loadSettings()
        const localWorkouts = await loadWorkouts()
        const localHistory = await loadHistory()
        await syncUserData(
          firebaseUser,
          localSettings,
          localWorkouts,
          localHistory,
        )
      } else {
        await loadSettings()
        await loadWorkouts()
        await loadHistory()
      }
    },
    [loadSettings, loadWorkouts, syncUserData, loadHistory],
  )

  const {
    user,
    initializing,
    isSigningIn,
    onGoogleButtonPress,
    disconnectAccount,
  } = useAuth(onAuthSuccess)

  const audioHandler = useAudio(settings)

  const activeExercise = currentWorkout?.exercises[currentExerciseIndex]

  const {
    currentRep,
    currentSet,
    isRunning,
    isPaused,
    isResting,
    phase,
    statusText,
    startWorkout,
    pauseWorkout,
    stopWorkout,
    runNextSet,
    jumpToRep,
    jumpToSet,
    endSet,
    isExerciseComplete,
    setStatusText,
    resetExerciseCompleteFlag,
  } = useWorkoutTimer(
    settings,
    audioHandler,
    activeExercise,
    user,
    {
      logCompletedSet,
      isSetCompleted,
      getNextUncompletedSet,
    },
    currentWeight,
  )

  // App State
  const appState = useRef<AppStateStatus>(AppState.currentState)

  // --- Effects ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState
    })

    enableBackgroundExecution()

    return () => {
      subscription.remove()
      disableBackgroundExecution()
    }
  }, [])

  useEffect(() => {
    if (isExerciseComplete) {
      if (
        currentWorkout &&
        currentExerciseIndex < currentWorkout.exercises.length - 1
      ) {
        const nextIndex = currentExerciseIndex + 1
        setCurrentExerciseIndex(nextIndex)
        audioHandler.speak(
          `Next exercise: ${currentWorkout.exercises[nextIndex].name}`,
        )
      } else {
        setStatusText('Workout Complete!')
        audioHandler.speak('Workout Complete!')
      }
      resetExerciseCompleteFlag()
    }
  }, [
    isExerciseComplete,
    currentWorkout,
    currentExerciseIndex,
    setStatusText,
    audioHandler,
    resetExerciseCompleteFlag,
  ])

  useEffect(() => {
    if (currentWorkout && currentWorkout.exercises.length > 0) {
      const exercise = currentWorkout.exercises[currentExerciseIndex]
      if (exercise) {
        setDataSettings((prev: Settings) => ({
          ...prev,
          maxReps: exercise.reps,
          maxSets: exercise.sets,
        }))
        setCurrentWeight(exercise.weight)
      }
    }
  }, [currentWorkout, currentExerciseIndex, setDataSettings])

  // --- Workout Management ---
  const selectWorkout = (workoutId: string | null) => {
    // BUG FIX: Stop the workout and any timers *before* changing the workout state
    // to prevent race conditions where effects run with stale data.
    stopWorkout()

    if (workoutId === null) {
      setCurrentWorkout(null)
      setCurrentExerciseIndex(0)
      return
    }

    const workout = workouts.find((w: Workout) => w.id === workoutId)
    setCurrentWorkout(workout || null)
    setCurrentExerciseIndex(0)
  }

  const nextExercise = () => {
    if (
      currentWorkout &&
      currentExerciseIndex < currentWorkout.exercises.length - 1
    ) {
      stopWorkout()
      const nextIndex = currentExerciseIndex + 1
      setCurrentExerciseIndex(nextIndex)
      audioHandler.speak(
        `Next exercise: ${currentWorkout.exercises[nextIndex].name}`,
      )
    }
  }

  const prevExercise = () => {
    if (currentWorkout && currentExerciseIndex > 0) {
      stopWorkout()
      const prevIndex = currentExerciseIndex - 1
      setCurrentExerciseIndex(prevIndex)
      audioHandler.speak(
        `Previous exercise: ${currentWorkout.exercises[prevIndex].name}`,
      )
    }
  }

  const handleSaveSettings = (newSettings: Settings) => {
    saveSettings(newSettings, user)
  }

  const handleSaveWorkouts = (newWorkouts: Workout[]) => {
    saveWorkouts(newWorkouts, user)
  }

  const handleWeightChange = (text: string) => {
    const newWeight = Number(text.replace(/[^0-9.]/g, ''))
    setCurrentWeight(newWeight)

    if (activeExercise && currentWorkout) {
      const newWorkouts = workouts.map((w) => {
        if (w.id === currentWorkout.id) {
          return {
            ...w,
            exercises: w.exercises.map((e, index) => {
              if (index === currentExerciseIndex) {
                return { ...e, weight: newWeight }
              }
              return e
            }),
          }
        }
        return w
      })
      setWorkouts(newWorkouts)
    }
  }

  if (initializing) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
        <StyledText className="text-white text-xl">Loading...</StyledText>
      </StyledSafeAreaView>
    )
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StatusBar barStyle="light-content" />
      <StyledScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">
        <StyledView className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4">
          <UserProfile user={user} disconnectAccount={disconnectAccount} />

          <WorkoutSelector
            workouts={workouts}
            currentWorkout={currentWorkout}
            currentExerciseIndex={currentExerciseIndex}
            settings={settings}
            selectWorkout={selectWorkout}
            setModalVisible={setWorkoutModalVisible}
            prevExercise={prevExercise}
            nextExercise={nextExercise}
            isSetCompleted={isSetCompleted}
            activeExerciseId={currentWorkout?.exercises[currentExerciseIndex]?.id}
            jumpToSet={jumpToSet}
            resetSetsFrom={(exerciseId, setNumber) =>
              resetSetsFrom(exerciseId, setNumber, user)
            }
            arePreviousSetsCompleted={arePreviousSetsCompleted}
          />

          <MainDisplay
            statusText={statusText}
            currentRep={currentRep}
            currentSet={currentSet}
            phase={phase}
            weight={currentWeight}
            onWeightChange={handleWeightChange}
            isWorkoutRunning={isRunning}
          />

          <Controls
            isRunning={isRunning}
            isResting={isResting}
            isPaused={isPaused}
            runNextSet={runNextSet}
            startWorkout={startWorkout}
            stopWorkout={stopWorkout}
            pauseWorkout={pauseWorkout}
            endSet={endSet}
          />

          <RepJumper
            maxReps={settings.maxReps}
            currentRep={currentRep}
            jumpToRep={jumpToRep}
          />

          <StyledView className="flex-row justify-center items-center space-x-6">
            <StyledTouchableOpacity
              onPress={() => setHistoryModalVisible(true)}
              className="flex-row items-center space-x-2">
              <History color="#60a5fa" size={16} />
              <StyledText className="text-blue-400">History</StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={() => setSettingsVisible(true)}
              className="flex-row items-center space-x-2">
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
      <HistoryLogModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        history={history}
        workouts={workouts}
      />
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSave={handleSaveSettings}
        onGoogleButtonPress={onGoogleButtonPress}
        user={user}
        disconnectAccount={disconnectAccount}
        isSigningIn={isSigningIn}
      />
    </StyledSafeAreaView>
  )
}

export default App
