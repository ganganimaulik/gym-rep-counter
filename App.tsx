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
import { Settings as SettingsIcon, History, BarChart3, Dumbbell, ClipboardList } from 'lucide-react-native'
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
import { useAnalytics } from './hooks/useAnalytics'

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
import ProgressScreen from './components/ProgressScreen'

const StyledSafeAreaView = styled(SafeAreaView)
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

interface CompletedSetData {
  exerciseId: string
  reps: number
  set: number
  startTime: number // Unix timestamp when set started
  endTime: number // Unix timestamp when set ended (rest timer starts)
}

const App: React.FC = () => {
  useKeepAwake()

  // UI State
  const [currentTab, setCurrentTab] = useState<'workout' | 'routines' | 'history' | 'analytics' | 'settings'>('workout')
  const [addSetModalVisible, setAddSetModalVisible] = useState<boolean>(false)
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
    fetchAllTodaysCompletions,
    syncOfflineQueue,
  } = dataHook

  const analyticsHook = useAnalytics(dataHook)

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
    // Start rest timer immediately - don't wait for user to enter weight/reps
    continueToNextPhase()
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
    continueToNextPhase,
    addCountdownTime,
    endSet,
    runNextSet,
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
        if (user) {
          fetchAllTodaysCompletions(user)
        }
      }
      appState.current = nextAppState
    })

    enableBackgroundExecution()

    return () => {
      subscription.remove()
      disableBackgroundExecution()
    }
  }, [user, fetchAllTodaysCompletions])

  useEffect(() => {
    fetchAllTodaysCompletions(user)
  }, [user, fetchAllTodaysCompletions])

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
    if (completedSetData && currentWorkout) {
      // Find the exercise that was just completed, instead of relying on activeExercise
      // which might have advanced to the next one already.
      const completedExercise = currentWorkout.exercises.find(
        (e) => e.id === completedSetData.exerciseId,
      )

      if (completedExercise) {
        await addHistoryEntry(
          {
            workoutId: currentWorkout.id,
            exerciseId: completedExercise.id,
            exerciseName: completedExercise.name,
            reps,
            weight,
          },
          completedSetData.set,
          completedSetData.startTime,
          completedSetData.endTime, // Use endTime for date field (when rest started)
          user,
        )
      }
    }
    // This part should run whether the user is logged in or not,
    // and even if the data saving fails, to not block the UI flow.
    setAddSetModalVisible(false)
    setCompletedSetData(null)
    // Rest timer already started in handleSetComplete, no need to call continueToNextPhase here
  }

  if (initializing) {
    return (
      <StyledSafeAreaView className="flex-1 bg-zinc-950 justify-center items-center">
        <StyledText className="text-zinc-400 text-xl font-medium">Loading...</StyledText>
      </StyledSafeAreaView>
    )
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar barStyle="light-content" />
      
      <StyledView className="flex-1">
        {currentTab === 'workout' && (
          <StyledScrollView
            className="flex-1 p-4"
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
            <StyledView className="w-full max-w-md mx-auto space-y-6">
              <WorkoutSelector
                workouts={workouts}
                currentWorkout={currentWorkout}
                currentExerciseIndex={currentExerciseIndex}
                settings={settings}
                selectWorkout={selectWorkout}
                setModalVisible={(visible) => {
                  if (visible) setCurrentTab('routines')
                }}
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
                runNextSet={() => {
                  if (
                    activeExercise &&
                    isSetCompleted(activeExercise.id, currentSet.value)
                  ) {
                    Toast.show({
                      type: 'info',
                      text1: 'Set Already Completed',
                      text2: `You have already completed set ${currentSet.value} for this exercise.`,
                    })
                    return
                  }
                  runNextSet()
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
            </StyledView>
          </StyledScrollView>
        )}

        {currentTab === 'routines' && (
          <WorkoutManagementModal
            visible={true}
            onClose={() => setCurrentTab('workout')}
            workouts={workouts}
            setWorkouts={handleSaveWorkouts}
          />
        )}

        {currentTab === 'history' && (
          <HistoryScreen
            visible={true}
            onClose={() => setCurrentTab('workout')}
            user={user}
            dataHook={dataHook}
          />
        )}

        {currentTab === 'analytics' && (
          <ProgressScreen
            visible={true}
            onClose={() => setCurrentTab('workout')}
            user={user}
            analyticsHook={analyticsHook}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsModal
            visible={true}
            onClose={() => setCurrentTab('workout')}
            settings={settings}
            onSave={handleSaveSettings}
            onGoogleButtonPress={onGoogleButtonPress}
            user={user}
            disconnectAccount={disconnectAccount}
            isSigningIn={isSigningIn}
          />
        )}
      </StyledView>

      {/* Modern Bottom Tab Bar */}
      <StyledView className="flex-row border-t border-zinc-900 bg-zinc-950 py-2 justify-around items-center">
        <StyledTouchableOpacity
          onPress={() => setCurrentTab('workout')}
          className="items-center py-1 flex-1">
          <Dumbbell color={currentTab === 'workout' ? '#3b82f6' : '#71717a'} size={22} />
          <StyledText className={`text-[10px] mt-1 font-semibold ${currentTab === 'workout' ? 'text-blue-500' : 'text-zinc-500'}`}>
            Workout
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => setCurrentTab('routines')}
          className="items-center py-1 flex-1">
          <ClipboardList color={currentTab === 'routines' ? '#8b5cf6' : '#71717a'} size={22} />
          <StyledText className={`text-[10px] mt-1 font-semibold ${currentTab === 'routines' ? 'text-purple-500' : 'text-zinc-500'}`}>
            Routines
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => setCurrentTab('history')}
          className="items-center py-1 flex-1">
          <History color={currentTab === 'history' ? '#fb923c' : '#71717a'} size={22} />
          <StyledText className={`text-[10px] mt-1 font-semibold ${currentTab === 'history' ? 'text-orange-400' : 'text-zinc-500'}`}>
            History
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => setCurrentTab('analytics')}
          className="items-center py-1 flex-1">
          <BarChart3 color={currentTab === 'analytics' ? '#10b981' : '#71717a'} size={22} />
          <StyledText className={`text-[10px] mt-1 font-semibold ${currentTab === 'analytics' ? 'text-green-500' : 'text-zinc-500'}`}>
            Analytics
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => setCurrentTab('settings')}
          className="items-center py-1 flex-1">
          <SettingsIcon color={currentTab === 'settings' ? '#f43f5e' : '#71717a'} size={22} />
          <StyledText className={`text-[10px] mt-1 font-semibold ${currentTab === 'settings' ? 'text-rose-500' : 'text-zinc-500'}`}>
            Settings
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>

      <AddSetDetailsModal
        visible={addSetModalVisible}
        onClose={() => {
          setAddSetModalVisible(false)
        }}
        onSubmit={handleAddSetDetails}
        initialReps={completedSetData?.reps ?? settings.maxReps}
      />
      <Toast />
    </StyledSafeAreaView>
  )
}

export default App
