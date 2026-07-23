import 'react-native-gesture-handler'
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated'

// This is the default configuration for Reanimated
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
})

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native'
import { styled } from 'nativewind'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import {
  Settings as SettingsIcon,
  History,
  BarChart3,
  Dumbbell,
  ClipboardList,
  Book,
} from 'lucide-react-native'
import {
  enableBackgroundExecution,
  disableBackgroundExecution,
} from './utils/backgroundTimer'
import { detectSleepWindow } from './utils/sleepDetection'
import { evaluateSetDeletion } from './utils/setDeletion'
import { setupReminders, cancelAllReminders } from './utils/notifications'
import {
  loadLastWeightUnits,
  recordLastWeightUnit,
} from './utils/weightUnitPreference'
import type { User as FirebaseUser } from 'firebase/auth'

import { useNetInfo } from '@react-native-community/netinfo'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useData, Settings, Workout, Exercise } from './hooks/useData'
import { useAudio } from './hooks/useAudio'
import { useWorkoutTimer } from './hooks/useWorkoutTimer'

// Components
import SettingsModal from './components/SettingsModal'
import WorkoutManagementModal from './components/WorkoutManagementModal'
import WorkoutSelector from './components/layout/WorkoutSelector'
import MainDisplay from './components/layout/MainDisplay'
import Controls from './components/layout/Controls'
import RepJumper from './components/layout/RepJumper'
import AddSetDetailsModal from './components/AddSetDetailsModal'
import type { WeightUnit } from './declarations'
import Toast from 'react-native-toast-message'
import HistoryScreen from './components/HistoryScreen'
import ProgressScreen from './components/ProgressScreen'
import SplashScreen from './components/SplashScreen'
import JournalScreen from './components/JournalScreen'

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
  // UI State
  const [currentTab, setCurrentTab] = useState<
    'workout' | 'routines' | 'history' | 'analytics' | 'settings' | 'journal'
  >('workout')
  const [addSetModalVisible, setAddSetModalVisible] = useState<boolean>(false)
  const [completedSetData, setCompletedSetData] =
    useState<CompletedSetData | null>(null)

  // Workout State
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0)
  const [workoutsLoaded, setWorkoutsLoaded] = useState<boolean>(false)
  // Set-count adjustments made on the fly ("+" adds, long-press removes),
  // keyed by exercise id. Session-only: never written back to the routine.
  const [setDeltas, setSetDeltas] = useState<Record<string, number>>({})

  // Last weight unit the user picked per exercise (by id), so the Set Complete
  // modal defaults to it instead of re-asking each set. Loaded once on mount
  // and updated on every explicit choice. See utils/weightUnitPreference.
  const [lastWeightUnits, setLastWeightUnits] = useState<
    Record<string, WeightUnit>
  >({})

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
    fetchWeightLogs,
    fetchCalorieLogs,
    loadTDEEConfig,
    fetchJournalEntries,
    weightLogs,
    calorieLogs,
    journalEntries,
    todaysCompletions,
    saveActiveSession,
    loadActiveSession,
    clearActiveSession,
    clearUserScopedCache,
  } = dataHook

  const onAuthSuccess = useCallback(
    async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const localSettings = await loadSettings()
        const localWorkouts = await loadWorkouts()
        await syncUserData(firebaseUser, localSettings, localWorkouts)
        await fetchWeightLogs(firebaseUser)
        await fetchCalorieLogs(firebaseUser)
        await loadTDEEConfig(firebaseUser)
        await fetchJournalEntries(firebaseUser)
      } else {
        await loadSettings()
        await loadWorkouts()
        await fetchWeightLogs(null)
        await fetchCalorieLogs(null)
        await loadTDEEConfig(null)
        await fetchJournalEntries(null)
      }
      setWorkoutsLoaded(true)
    },
    [
      loadSettings,
      loadWorkouts,
      syncUserData,
      fetchWeightLogs,
      fetchCalorieLogs,
      loadTDEEConfig,
      fetchJournalEntries,
    ],
  )

  const {
    user,
    initializing,
    isSigningIn,
    onGoogleButtonPress,
    disconnectAccount,
  } = useAuth(onAuthSuccess, clearUserScopedCache)

  const audioHandler = useAudio(settings)
  const baseExercise = currentWorkout?.exercises[currentExerciseIndex]
  // The exercise as performed this session: routine definition plus any
  // extra sets added on the fly. Everything downstream (timer, set tracker,
  // live activity) sees the bumped set count.
  const activeExercise = useMemo(() => {
    if (!baseExercise) return undefined
    const delta = setDeltas[baseExercise.id] ?? 0
    return delta !== 0
      ? { ...baseExercise, sets: Math.max(1, baseExercise.sets + delta) }
      : baseExercise
  }, [baseExercise, setDeltas])
  const startingSet = activeExercise
    ? getNextUncompletedSet(activeExercise.id)
    : 1

  // An exercise is "done" once every one of its sets (as adjusted this
  // session) has been logged today.
  const isExerciseDone = useCallback(
    (exercise: Exercise): boolean =>
      Array.from(
        { length: Math.max(1, exercise.sets + (setDeltas[exercise.id] ?? 0)) },
        (_, i) => i + 1,
      ).every((setNumber) => isSetCompleted(exercise.id, setNumber)),
    [isSetCompleted, setDeltas],
  )

  // Partition exercises into completed-first / unfinished-last order,
  // preserving relative order within each group. `treatAsDoneId` lets a
  // just-finished exercise count as complete before its final set is persisted.
  const orderExercisesByCompletion = useCallback(
    (exercises: Exercise[], treatAsDoneId?: string) => {
      const done = (e: Exercise) => e.id === treatAsDoneId || isExerciseDone(e)
      const completed = exercises.filter(done)
      const remaining = exercises.filter((e) => !done(e))
      return { ordered: [...completed, ...remaining], completed, remaining }
    },
    [isExerciseDone],
  )

  const continueToNextPhaseRef = useRef<() => void>(() => {})

  const handleSetComplete = useCallback((details: CompletedSetData) => {
    setCompletedSetData(details)
    setAddSetModalVisible(true)
    // Start rest timer immediately - don't wait for user to enter weight/reps
    continueToNextPhaseRef.current()
  }, [])

  const nextExerciseItem =
    currentWorkout && currentExerciseIndex < currentWorkout.exercises.length - 1
      ? currentWorkout.exercises[currentExerciseIndex + 1]
      : undefined

  const {
    currentRep,
    currentSet,
    isRunning,
    isPaused,
    isResting,
    isRestComplete,
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
    nextExerciseItem?.name ?? '',
  )

  // Keep ref in sync
  continueToNextPhaseRef.current = continueToNextPhase

  // Tapping the Live Activity / Dynamic Island opens repcounterapp://workout —
  // route it to the workout tab.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (url?.startsWith('repcounterapp://workout')) {
        setCurrentTab('workout')
      }
    }
    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {})
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url),
    )
    return () => subscription.remove()
  }, [])

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

  const sleepWindow = useMemo(() => {
    return detectSleepWindow(
      weightLogs,
      calorieLogs,
      journalEntries,
      todaysCompletions,
    )
  }, [weightLogs, calorieLogs, journalEntries, todaysCompletions])

  const formattedSleepWindow = useMemo(() => {
    const formatHour = (hour: number) => {
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 === 0 ? 12 : hour % 12
      return `${displayHour}:00 ${ampm}`
    }

    if (settings.statRemindersUseAutoSleep === false) {
      const start = settings.statRemindersSleepStart ?? 23
      const end = settings.statRemindersSleepEnd ?? 7
      return `${formatHour(start)} - ${formatHour(end)}`
    }

    if (sleepWindow.isDefault) {
      return `${formatHour(sleepWindow.startHour)} - ${formatHour(sleepWindow.endHour)} (Default)`
    }
    return `${formatHour(sleepWindow.startHour)} - ${formatHour(sleepWindow.endHour)} (Auto-detected)`
  }, [
    sleepWindow,
    settings.statRemindersUseAutoSleep,
    settings.statRemindersSleepStart,
    settings.statRemindersSleepEnd,
  ])

  useEffect(() => {
    const triggerReminders = async () => {
      if (settings.statRemindersEnabled ?? true) {
        try {
          await setupReminders(
            settings,
            weightLogs,
            calorieLogs,
            journalEntries,
            todaysCompletions,
          )
        } catch (e) {
          console.error('Failed to setup reminders', e)
        }
      } else {
        try {
          await cancelAllReminders()
        } catch (e) {
          console.error('Failed to cancel reminders', e)
        }
      }
    }
    triggerReminders()
  }, [
    settings.statRemindersEnabled,
    settings.statRemindersUseAutoSleep,
    settings.statRemindersSleepStart,
    settings.statRemindersSleepEnd,
    settings.supplementSuggestions,
    weightLogs.length,
    calorieLogs.length,
    journalEntries.length,
    todaysCompletions.length,
  ])

  useEffect(() => {
    fetchAllTodaysCompletions(user)
  }, [user, fetchAllTodaysCompletions])

  useEffect(() => {
    if (isConnected && user) {
      syncOfflineQueue(user)
    }
  }, [isConnected, user, syncOfflineQueue])

  // Wraps up the active exercise: reorders the list, advances to the first
  // unfinished exercise (or ends the workout) and announces it. Used when the
  // timer finishes the final set and when a deletion removes the last
  // remaining set.
  const completeActiveExercise = useCallback(() => {
    if (!currentWorkout || !activeExercise) return
    // The exercise that just finished counts as done even though its final
    // set may not be persisted yet.
    const { ordered, completed, remaining } = orderExercisesByCompletion(
      currentWorkout.exercises,
      activeExercise.id,
    )
    if (remaining.length === 0) {
      // Every set of every exercise is done.
      setStatusText('Workout Complete!')
      audioHandler.speak('Workout Complete!')
      clearActiveSession()
    } else {
      // Move completed exercises to the front and continue with the first
      // unfinished one.
      const nextIndex = completed.length
      setCurrentWorkout({ ...currentWorkout, exercises: ordered })
      setCurrentExerciseIndex(nextIndex)
      audioHandler.speak(`Next exercise: ${ordered[nextIndex].name}`)
    }
  }, [
    currentWorkout,
    activeExercise,
    orderExercisesByCompletion,
    setStatusText,
    audioHandler,
    clearActiveSession,
  ])

  useEffect(() => {
    if (!isExerciseComplete) return
    completeActiveExercise()
    resetExerciseCompleteFlag()
  }, [isExerciseComplete, completeActiveExercise, resetExerciseCompleteFlag])

  useEffect(() => {
    if (activeExercise) {
      setDataSettings((prev: Settings) => ({
        ...prev,
        maxReps: activeExercise.reps,
        maxSets: activeExercise.sets,
      }))
    }
  }, [activeExercise, setDataSettings])

  // Persist active workout session to AsyncStorage whenever it changes
  useEffect(() => {
    if (currentWorkout) {
      saveActiveSession(currentWorkout.id, currentExerciseIndex)
    }
  }, [currentWorkout, currentExerciseIndex, saveActiveSession])

  // Load the remembered per-exercise weight units once on mount.
  useEffect(() => {
    loadLastWeightUnits().then(setLastWeightUnits)
  }, [])

  // Reconcile the active workout with the source list. currentWorkout is a
  // (reordered) copy, so deleting its routine must clear it and editing its
  // routine must rebuild it — otherwise sets keep logging against a stale
  // snapshot and saveActiveSession keeps persisting a dead workout id.
  useEffect(() => {
    if (!currentWorkout) return
    const source = workouts.find((w: Workout) => w.id === currentWorkout.id)
    if (!source) {
      stopWorkout()
      setCurrentWorkout(null)
      setCurrentExerciseIndex(0)
      clearActiveSession()
      return
    }

    // currentWorkout.exercises is a completion-ordered permutation of the
    // source's, so compare them order-insensitively to detect real edits.
    const key = (e: Exercise) => `${e.id}|${e.name}|${e.sets}|${e.reps}`
    const sameContent =
      source.name === currentWorkout.name &&
      source.exercises.length === currentWorkout.exercises.length &&
      source.exercises.map(key).sort().join('\n') ===
        currentWorkout.exercises.map(key).sort().join('\n')
    if (sameContent) return

    const activeId = currentWorkout.exercises[currentExerciseIndex]?.id
    const { ordered, completed } = orderExercisesByCompletion(source.exercises)
    const activeIdx = ordered.findIndex((e) => e.id === activeId)
    if (activeIdx < 0) {
      // The exercise being performed was removed from the routine.
      stopWorkout()
    }
    setCurrentWorkout({ ...source, exercises: ordered })
    setCurrentExerciseIndex(
      activeIdx >= 0
        ? activeIdx
        : completed.length < ordered.length
          ? completed.length
          : 0,
    )
  }, [
    workouts,
    currentWorkout,
    currentExerciseIndex,
    stopWorkout,
    clearActiveSession,
    orderExercisesByCompletion,
  ])

  // Restore active workout session on initial mount once workouts are loaded
  const sessionRestoredRef = useRef(false)
  useEffect(() => {
    if (!workoutsLoaded || sessionRestoredRef.current || workouts.length === 0)
      return
    sessionRestoredRef.current = true

    const restore = async () => {
      const session = await loadActiveSession()
      if (!session) return

      const workout = workouts.find((w: Workout) => w.id === session.workoutId)
      if (!workout) {
        await clearActiveSession()
        return
      }

      // Reorder exercises like selectWorkout does, then apply the saved index
      const { ordered, completed } = orderExercisesByCompletion(
        workout.exercises,
      )
      setCurrentWorkout({ ...workout, exercises: ordered })

      // Use the saved exercise index if it's still valid, otherwise fall back
      // to the first uncompleted exercise
      const validIndex =
        session.exerciseIndex < ordered.length
          ? session.exerciseIndex
          : completed.length < ordered.length
            ? completed.length
            : 0
      setCurrentExerciseIndex(validIndex)
    }
    restore()
  }, [
    workoutsLoaded,
    workouts,
    loadActiveSession,
    clearActiveSession,
    orderExercisesByCompletion,
  ])

  const selectWorkout = useCallback(
    (workoutId: string | null) => {
      stopWorkout()
      setSetDeltas({})
      if (workoutId === null) {
        setCurrentWorkout(null)
        setCurrentExerciseIndex(0)
        clearActiveSession()
        return
      }
      const workout = workouts.find((w: Workout) => w.id === workoutId)
      if (!workout) {
        setCurrentWorkout(null)
        setCurrentExerciseIndex(0)
        return
      }
      // Show already-completed exercises first and resume at the first
      // unfinished one.
      const { ordered, completed } = orderExercisesByCompletion(
        workout.exercises,
      )
      setCurrentWorkout({ ...workout, exercises: ordered })
      setCurrentExerciseIndex(
        completed.length < ordered.length ? completed.length : 0,
      )
    },
    [stopWorkout, workouts, orderExercisesByCompletion, clearActiveSession],
  )

  const nextExercise = useCallback(() => {
    if (
      currentWorkout &&
      currentExerciseIndex < currentWorkout.exercises.length - 1
    ) {
      stopWorkout()
      setCurrentExerciseIndex((prev) => prev + 1)
    }
  }, [currentWorkout, currentExerciseIndex, stopWorkout])

  const prevExercise = useCallback(() => {
    if (currentWorkout && currentExerciseIndex > 0) {
      stopWorkout()
      setCurrentExerciseIndex((prev) => prev - 1)
    }
  }, [currentWorkout, currentExerciseIndex, stopWorkout])

  const handleSaveSettings = useCallback(
    (newSettings: Settings) => {
      saveSettings(newSettings, user)
    },
    [saveSettings, user],
  )

  const handleSaveWorkouts = useCallback(
    (newWorkouts: Workout[]) => {
      saveWorkouts(newWorkouts, user)
    },
    [saveWorkouts, user],
  )

  // The exercise the pending "Set Complete" modal refers to. Looked up from
  // completedSetData instead of activeExercise, which might have advanced to
  // the next exercise already.
  const completedExercise = useMemo(
    () =>
      completedSetData && currentWorkout
        ? currentWorkout.exercises.find(
            (e) => e.id === completedSetData.exerciseId,
          )
        : undefined,
    [completedSetData, currentWorkout],
  )

  const handleAddSetDetails = useCallback(
    async (
      reps: number,
      weight: number,
      weightUnit?: WeightUnit,
      variant?: string,
    ) => {
      const setData = completedSetData
      // Hide the modal immediately, whether the user is logged in or not,
      // and even if the data saving fails, to not block the UI flow.
      setAddSetModalVisible(false)
      setCompletedSetData(null)

      // Remember the unit the user actually picked so the next set for this
      // exercise defaults to it. The dismiss path calls this with no unit and
      // must not overwrite the remembered choice.
      if (weightUnit && completedExercise) {
        recordLastWeightUnit(completedExercise.id, weightUnit).then(
          setLastWeightUnits,
        )
      }

      if (setData && currentWorkout && completedExercise) {
        await addHistoryEntry(
          {
            workoutId: currentWorkout.id,
            exerciseId: completedExercise.id,
            exerciseName: completedExercise.name,
            reps,
            weight,
            weightUnit: weightUnit ?? completedExercise.weightUnit ?? 'kg',
            // Firestore rejects undefined values — omit variant when unset.
            ...(variant ? { variant } : {}),
          },
          setData.set,
          setData.startTime,
          setData.endTime, // Use endTime for date field (when rest started)
          user,
        )
      }
      // Rest timer already started in handleSetComplete, no need to call continueToNextPhase here
    },
    [
      completedSetData,
      completedExercise,
      currentWorkout,
      addHistoryEntry,
      user,
    ],
  )

  const handleOpenRoutines = useCallback((visible: boolean) => {
    if (visible) setCurrentTab('routines')
  }, [])

  // Conditional keep-awake: only keep screen on during active workout or rest phase
  useEffect(() => {
    const safeDeactivate = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = deactivateKeepAwake('workout') as any
        if (res && typeof res.catch === 'function') {
          res.catch(() => {})
        }
      } catch {
        // ignored
      }
    }

    if (isRunning || isResting) {
      activateKeepAwakeAsync('workout').catch(() => {})
    } else {
      safeDeactivate()
    }
    return safeDeactivate
  }, [isRunning, isResting])

  const handleResetSetsFrom = useCallback(
    (exerciseId: string, setNumber: number) => {
      resetSetsFrom(exerciseId, setNumber, user)
    },
    [resetSetsFrom, user],
  )

  const addExtraSet = useCallback(() => {
    if (!activeExercise) return
    setSetDeltas((prev) => ({
      ...prev,
      [activeExercise.id]: (prev[activeExercise.id] ?? 0) + 1,
    }))
    Toast.show({
      type: 'success',
      text1: 'Set Added',
      text2: `${activeExercise.name}: ${activeExercise.sets + 1} sets for this session.`,
    })
  }, [activeExercise])

  const handleDeleteSet = useCallback(
    (setNumber: number) => {
      if (!activeExercise) return
      const verdict = evaluateSetDeletion({
        setNumber,
        totalSets: activeExercise.sets,
        completedSets: todaysCompletions
          .filter((c) => c.exerciseId === activeExercise.id)
          .map((c) => c.set),
        isRunning,
        currentSet: Math.round(currentSet.value),
      })

      if (!verdict.allowed) {
        const messages = {
          completed: {
            text1: 'Set Already Logged',
            text2: "Logged sets can't be removed. Tap one to redo from it.",
          },
          lastSet: {
            text1: 'Cannot Remove Set',
            text2: 'An exercise needs at least one set.',
          },
          inProgress: {
            text1: 'Set In Progress',
            text2: 'Finish or reset the current set before removing it.',
          },
        }
        Toast.show({ type: 'error', ...messages[verdict.reason] })
        return
      }

      setSetDeltas((prev) => ({
        ...prev,
        [activeExercise.id]: (prev[activeExercise.id] ?? 0) - 1,
      }))
      Toast.show({
        type: 'success',
        text1: 'Set Removed',
        text2: `${activeExercise.name}: ${verdict.newTotal} sets for this session.`,
      })
      // Every remaining set is already logged (e.g. the user deleted the set
      // they were resting toward), so end the exercise like the timer would.
      if (verdict.completesExercise) {
        stopWorkout()
        completeActiveExercise()
      }
    },
    [
      activeExercise,
      todaysCompletions,
      isRunning,
      currentSet,
      stopWorkout,
      completeActiveExercise,
    ],
  )

  const wrappedStartWorkout = useCallback(() => {
    if (activeExercise && isSetCompleted(activeExercise.id, startingSet)) {
      Toast.show({
        type: 'info',
        text1: 'Set Already Completed',
        text2: `You have already completed set ${startingSet} for this exercise.`,
      })
      return
    }
    startWorkout()
  }, [activeExercise, isSetCompleted, startingSet, startWorkout])

  const wrappedRunNextSet = useCallback(() => {
    if (
      !isResting &&
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
  }, [activeExercise, isSetCompleted, currentSet, isResting, runNextSet])

  const handleCloseAddSetModal = useCallback(() => {
    // Dismissing the modal (Android back / onRequestClose) must not silently
    // drop the completed set — log it with the recorded rep count and no weight.
    if (completedSetData) {
      handleAddSetDetails(completedSetData.reps, 0)
    } else {
      setAddSetModalVisible(false)
    }
  }, [completedSetData, handleAddSetDetails])

  if (initializing) {
    return <SplashScreen />
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
                setModalVisible={handleOpenRoutines}
                prevExercise={prevExercise}
                nextExercise={nextExercise}
                isSetCompleted={isSetCompleted}
                activeExerciseId={activeExercise?.id}
                totalSets={activeExercise?.sets ?? settings.maxSets}
                onAddSet={addExtraSet}
                onSetLongPress={handleDeleteSet}
                jumpToSet={jumpToSet}
                resetSetsFrom={handleResetSetsFrom}
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
                isRestComplete={isRestComplete}
                isPaused={isPaused}
                startWorkout={wrappedStartWorkout}
                runNextSet={wrappedRunNextSet}
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

        {/* Keep HistoryScreen mounted but hidden to preserve scroll position */}
        <StyledView
          style={{
            flex: 1,
            display: currentTab === 'history' ? 'flex' : 'none',
          }}>
          <HistoryScreen
            visible={currentTab === 'history'}
            user={user}
            dataHook={dataHook}
          />
        </StyledView>

        {/* Keep ProgressScreen mounted but hidden to preserve state */}
        <StyledView
          style={{
            flex: 1,
            display: currentTab === 'analytics' ? 'flex' : 'none',
          }}>
          <ProgressScreen
            visible={currentTab === 'analytics'}
            onClose={() => setCurrentTab('workout')}
            user={user}
            dataHook={dataHook}
          />
        </StyledView>

        <StyledView
          style={{
            flex: 1,
            display: currentTab === 'journal' ? 'flex' : 'none',
          }}>
          <JournalScreen
            visible={currentTab === 'journal'}
            user={user}
            dataHook={dataHook}
          />
        </StyledView>

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
            detectedSleepWindow={formattedSleepWindow}
          />
        )}
      </StyledView>

      {/* Modern Bottom Tab Bar */}
      <StyledView className="flex-row border-t border-zinc-900 bg-zinc-950 py-2 justify-around items-center">
        <StyledTouchableOpacity
          testID="tab-workout"
          onPress={() => setCurrentTab('workout')}
          className="items-center py-1 flex-1">
          <Dumbbell
            color={currentTab === 'workout' ? '#3b82f6' : '#71717a'}
            size={22}
          />
          <StyledText
            className={`text-[10px] mt-1 font-semibold ${currentTab === 'workout' ? 'text-blue-500' : 'text-zinc-500'}`}>
            Workout
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          testID="tab-routines"
          onPress={() => setCurrentTab('routines')}
          className="items-center py-1 flex-1">
          <ClipboardList
            color={currentTab === 'routines' ? '#8b5cf6' : '#71717a'}
            size={22}
          />
          <StyledText
            className={`text-[10px] mt-1 font-semibold ${currentTab === 'routines' ? 'text-purple-500' : 'text-zinc-500'}`}>
            Routines
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          testID="tab-history"
          onPress={() => setCurrentTab('history')}
          className="items-center py-1 flex-1">
          <History
            color={currentTab === 'history' ? '#fb923c' : '#71717a'}
            size={22}
          />
          <StyledText
            className={`text-[10px] mt-1 font-semibold ${currentTab === 'history' ? 'text-orange-400' : 'text-zinc-500'}`}>
            History
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          testID="tab-analytics"
          onPress={() => setCurrentTab('analytics')}
          className="items-center py-1 flex-1">
          <BarChart3
            color={currentTab === 'analytics' ? '#10b981' : '#71717a'}
            size={22}
          />
          <StyledText
            className={`text-[10px] mt-1 font-semibold ${currentTab === 'analytics' ? 'text-green-500' : 'text-zinc-500'}`}>
            Analytics
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          testID="tab-journal"
          onPress={() => setCurrentTab('journal')}
          className="items-center py-1 flex-1">
          <Book
            color={currentTab === 'journal' ? '#0ea5e9' : '#71717a'}
            size={22}
          />
          <StyledText
            // eslint-disable-next-line react-native/no-color-literals
            style={{ color: currentTab === 'journal' ? '#0ea5e9' : '#71717a' }}
            className="text-[10px] mt-1 font-semibold">
            Journal
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          testID="tab-settings"
          onPress={() => setCurrentTab('settings')}
          className="items-center py-1 flex-1">
          <SettingsIcon
            color={currentTab === 'settings' ? '#f43f5e' : '#71717a'}
            size={22}
          />
          <StyledText
            className={`text-[10px] mt-1 font-semibold ${currentTab === 'settings' ? 'text-rose-500' : 'text-zinc-500'}`}>
            Settings
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>

      <AddSetDetailsModal
        visible={addSetModalVisible}
        onClose={handleCloseAddSetModal}
        onSubmit={handleAddSetDetails}
        initialReps={completedSetData?.reps ?? settings.maxReps}
        exerciseName={completedExercise?.name ?? ''}
        defaultWeightUnit={
          (completedExercise && lastWeightUnits[completedExercise.id]) ??
          completedExercise?.weightUnit ??
          'kg'
        }
        variants={completedExercise?.variants}
      />
      <Toast topOffset={60} />
    </StyledSafeAreaView>
  )
}

export default App
