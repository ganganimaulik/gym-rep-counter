import 'react-native-gesture-handler'
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated'

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
})

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

import { useNetInfo } from '@react-native-community/netinfo'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useData, Settings, Workout } from './hooks/useData'
import { useAudio } from './hooks/useAudio'
import { useWorkoutTimer } from './hooks/useWorkoutTimer'

// Components
import SettingsModal from './components/SettingsModal'
import WorkoutManagementModal from './components/WorkoutManagementModal'
import UserProfile from './components/layout/UserProfile'
import WorkoutSelector from './components/layout/WorkoutSelector'
import MainDisplay from './components/layout/MainDisplay'
import Controls from './components/layout/Controls'
import RepJumper from './components/layout/RepJumper'
import AddSetDetailsModal from './components/AddSetDetailsModal'
import Toast from 'react-native-toast-message'
import HistoryScreen from './components/HistoryScreen'

const StyledSafeAreaView = styled(SafeAreaView)
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

interface CompletedSetData {
  exerciseId: string
  reps: number
  set: number
}

const App: React.FC = () => {
  useKeepAwake()

  // UI State
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false)
  const [workoutModalVisible, setWorkoutModalVisible] = useState<boolean>(false)
  const [addSetModalVisible, setAddSetModalVisible] = useState<boolean>(false)
  const [historyScreenVisible, setHistoryScreenVisible] =
    useState<boolean>(false)
  const [completedSetData, setCompletedSetData] =
    useState<CompletedSetData | null>(null)

  // Workout State
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0)

  // Custom Hooks
  const { isConnected } = useNetInfo()
  const dataHook = useData()
  const {
    settings,
    workouts,
    loadSettings,
    saveSettings,
    loadWorkouts,
    saveWorkouts,
    syncUserData,
    setSettings: setDataSettings,
    addHistoryEntry,
    isSetCompleted,
    resetSetsFrom,
    arePreviousSetsCompleted,
    getNextUncompletedSet,
    fetchTodaysCompletions,
    syncOfflineQueue,
  } = dataHook

  const onAuthSuccess = useCallback(
    async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const localSettings = await loadSettings()
        const localWorkouts = await loadWorkouts()
        await syncUserData(firebaseUser, localSettings, localWorkouts)
      } else {
        await loadSettings()
        await loadWorkouts()
      }
    },
    [loadSettings, loadWorkouts, syncUserData],
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
  const startingSet = activeExercise
    ? getNextUncompletedSet(activeExercise.id)
    : 1

  const handleSetComplete = (details: CompletedSetData) => {
    setCompletedSetData(details)
    setAddSetModalVisible(true)
  }

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
    jumpToRep,
    jumpToSet,
    isExerciseComplete,
    setStatusText,
    resetExerciseCompleteFlag,
    addCountdownTime,
    endSet,
  } = useWorkoutTimer(
    settings,
    audioHandler,
    activeExercise,
    handleSetComplete,
    startingSet,
  )

  const appState = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (activeExercise) {
          fetchTodaysCompletions(user, activeExercise.id)
        }
      }
      appState.current = nextAppState
    })

    enableBackgroundExecution()

    return () => {
      subscription.remove()
      disableBackgroundExecution()
    }
  }, [user, activeExercise, fetchTodaysCompletions])

  useEffect(() => {
    if (activeExercise) {
      fetchTodaysCompletions(user, activeExercise.id)
    }
  }, [user, activeExercise, fetchTodaysCompletions])

  useEffect(() => {
    if (isConnected && user) {
      syncOfflineQueue(user)
    }
  }, [isConnected, user, syncOfflineQueue])

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
        console.log(
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
      }
    }
  }, [currentWorkout, currentExerciseIndex, setDataSettings])

  const selectWorkout = (workoutId: string | null) => {
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
      setCurrentExerciseIndex((prev) => prev + 1)
    }
  }

  const prevExercise = () => {
    if (currentWorkout && currentExerciseIndex > 0) {
      stopWorkout()
      setCurrentExerciseIndex((prev) => prev - 1)
    }
  }

  const handleSaveSettings = (newSettings: Settings) => {
    saveSettings(newSettings, user)
  }

  const handleSaveWorkouts = (newWorkouts: Workout[]) => {
    saveWorkouts(newWorkouts, user)
  }

  const handleAddSetDetails = async (reps: number, weight: number) => {
    if (completedSetData && activeExercise) {
      await addHistoryEntry(
        {
          workoutId: currentWorkout!.id,
          exerciseId: activeExercise.id,
          exerciseName: activeExercise.name,
          reps,
          weight,
        },
        completedSetData.set,
        user,
      )
    }
    // This part should run whether the user is logged in or not,
    // and even if the data saving fails, to not block the UI flow.
    setAddSetModalVisible(false)
    setCompletedSetData(null)
  }

  const handleSkipLogSet = () => {
    setAddSetModalVisible(false)
    setCompletedSetData(null)
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
      <Toast />
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
            activeExerciseId={activeExercise?.id}
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
            addCountdownTime={addCountdownTime}
          />

          <Controls
            isRunning={isRunning}
            isResting={isResting}
            isPaused={isPaused}
            startWorkout={() => {
              if (
                activeExercise &&
                isSetCompleted(activeExercise.id, startingSet)
              ) {
                Toast.show({
                  type: 'info',
                  text1: 'Set Already Completed',
                  text2: `You have already completed set ${startingSet} for this exercise.`,
                })
                return
              }
              startWorkout()
            }}
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
              onPress={() => setHistoryScreenVisible(true)}
              className="flex-row items-center space-x-2">
              <History color="#60a5fa" size={16} />
              <StyledText className="text-blue-400">History</StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={() => setSettingsVisible(!settingsVisible)}
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
      <AddSetDetailsModal
        visible={addSetModalVisible}
        onClose={handleSkipLogSet}
        onSubmit={handleAddSetDetails}
        initialReps={completedSetData?.reps ?? settings.maxReps}
      />
      <HistoryScreen
        visible={historyScreenVisible}
        onClose={() => setHistoryScreenVisible(false)}
        user={user}
        dataHook={dataHook}
      />
    </StyledSafeAreaView>
  )
}

export default App
