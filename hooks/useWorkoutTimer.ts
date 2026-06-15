import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import * as Speech from 'expo-speech'
import {
  bgSetTimeout,
  bgClearTimeout,
  enableBackgroundExecution,
} from 'expo-background-timer'
import { useSharedValue, runOnJS, SharedValue } from 'react-native-reanimated'
import { Settings, Exercise } from './useData'
import { AudioHandler } from './useAudio'
import { Platform } from 'react-native'
import {
  startWorkoutActivity,
  updateWorkoutActivity,
  stopWorkoutActivity,
} from '../utils/workoutActivity'

// Constants
const PHASES = {
  STOPPED: 'stopped',
  COUNTDOWN: 'countdown',
  CONCENTRIC: 'concentric',
  ECCENTRIC: 'eccentric',
  REST: 'rest',
} as const

type Phase = (typeof PHASES)[keyof typeof PHASES]

const PHASE_DISPLAY: Record<string, string> = {
  [PHASES.CONCENTRIC]: 'Concentric',
  [PHASES.ECCENTRIC]: 'Eccentric',
  [PHASES.REST]: 'Rest',
}

// Interfaces
interface UIState {
  isExerciseComplete: boolean
  isRunning: boolean
  isPaused: boolean
  phase: string
}

interface WorkoutState {
  rep: number
  set: number
  phase: Phase
  phaseStart: number
  remainingTime: number
  lastSpokenSecond: number
  isJumping: boolean
  setStartTime: number // Timestamp when the current set started (after countdown)
}

export interface WorkoutTimerHook {
  currentRep: SharedValue<number>
  currentSet: SharedValue<number>
  isRunning: boolean
  isPaused: boolean
  isResting: boolean
  phase: string
  statusText: SharedValue<string>
  isExerciseComplete: boolean
  startWorkout: () => void
  pauseWorkout: () => void
  stopWorkout: () => void
  runNextSet: () => void
  jumpToRep: (rep: number) => void
  jumpToSet: (set: number) => void
  setStatusText: (text: string) => void
  resetExerciseCompleteFlag: () => void
  continueToNextPhase: () => void
  addCountdownTime: () => void
  endSet: () => void
}

interface OnSetCompleteDetails {
  exerciseId: string
  reps: number
  set: number
  startTime: number // Unix timestamp when the set started
  endTime: number // Unix timestamp when the set ended (rest timer starts)
}

// Hook
export function useWorkoutTimer(
  settings: Settings,
  handlers: AudioHandler,
  activeExercise: Exercise | undefined,
  onSetComplete: (details: OnSetCompleteDetails) => void,
  startingSet: number,
  nextExerciseName: string = '',
): WorkoutTimerHook {
  const { queueSpeak, speakEccentric } = handlers

  useEffect(() => {
    enableBackgroundExecution()
  }, [])

  const displayRep = useSharedValue(0)
  const displaySet = useSharedValue(1)
  const statusText = useSharedValue('Press Start')

  const [ui, setUI] = useState<UIState>({
    isExerciseComplete: false,
    isRunning: false,
    isPaused: false,
    phase: '',
  })
  const updateUI = useCallback(
    (patch: Partial<UIState>) => setUI((prev) => ({ ...prev, ...patch })),
    [],
  )

  const wState = useRef<WorkoutState>({
    rep: 0,
    set: startingSet,
    phase: PHASES.STOPPED,
    phaseStart: Date.now(),
    remainingTime: 0,
    lastSpokenSecond: -1,
    isJumping: false,
    setStartTime: 0,
  })

  const timeoutRef = useRef<number | null>(null)
  const audioTimeoutRef = useRef<number | null>(null)
  // Refs to break circular dependency between startConcentric and startEccentric
  const startConcentricRef = useRef<() => void>(() => {})
  const startEccentricRef = useRef<() => void>(() => {})
  // Track previous exercise ID. Initialize to a sentinel value to ensure
  // initial mount triggers the reset (undefined !== activeExercise?.id on first render if exercise exists)
  const prevExerciseIdRef = useRef<string | undefined | null>(null)

  const clearTimer = useCallback((stopSpeech = true) => {
    if (timeoutRef.current != null) {
      try {
        bgClearTimeout(timeoutRef.current)
      } catch {
        /* ignore */
      }
      timeoutRef.current = null
    }
    if (audioTimeoutRef.current != null) {
      try {
        bgClearTimeout(audioTimeoutRef.current)
      } catch {
        /* ignore */
      }
      audioTimeoutRef.current = null
    }
    if (stopSpeech) {
      Speech.stop()
    }
  }, [])

  const schedule = useCallback(
    (ms: number, cb: () => void, stopSpeech = true) => {
      clearTimer(stopSpeech)
      const id = bgSetTimeout(() => {
        timeoutRef.current = null
        cb()
      }, ms)
      timeoutRef.current = id
    },
    [clearTimer],
  )

  const startRest = useCallback(() => {
    // If we have existing elapsed time (from a pause), use it.
    // Otherwise start from 0.
    // wState.current.remainingTime holds the "elapsed" time in the rest phase context if paused?
    // Actually, in the other phases, remainingTime is "remaining".
    // Let's redefine remainingTime for REST phase to be "elapsed time" or just calculate elapsed from phaseStart.
    // Simpler: Just track phaseStart. If paused, we need to adjust phaseStart.

    // Let's follow the existing pattern:
    // When paused, `remainingTime` is saved.
    // For REST, let's treat `remainingTime` as "amount of rest already taken" if we resume.
    // So if clean start, remainingTime = 0.

    // WAIT. The previous logic used remainingTime as "time left".
    // I need to be careful with `pauseWorkout` which assumes remainingTime is "time left" for all phases.
    // Let's see `pauseWorkout`. It calculates `duration - elapsed`.
    // I should probably change `pauseWorkout` for REST phase too.

    // Let's stick to modifying `startRest` first, then check `pauseWorkout`.

    const initialElapsed =
      wState.current.remainingTime > 0 ? wState.current.remainingTime / 1000 : 0
    wState.current.remainingTime = 0 // Reset this as we are consuming it.

    wState.current.phase = PHASES.REST
    // Adjust phaseStart so that (Date.now() - phaseStart) equals initialElapsed
    wState.current.phaseStart = Date.now() - initialElapsed * 1000
    wState.current.lastSpokenSecond = -1

    // We need to track if we have already spoken the "Rest Complete" message for this session
    // to avoid speaking it blindly if we resume after the target.
    // But `lastSpokenSecond` can handle that if we set it correctly.

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000
      const whole = Math.floor(elapsed)
      const remaining = Math.max(0, settings.restSeconds - whole)
      statusText.value = `Rest: ${remaining}s`

      if (
        whole === settings.restSeconds &&
        whole !== wState.current.lastSpokenSecond
      ) {
        wState.current.lastSpokenSecond = whole
        queueSpeak(`Rest target reached.`, {
          priority: true,
        })
      }

      // Keep checking every second
      schedule(1000 - (Date.now() % 1000), tick, false)
    }
    tick()
  }, [settings, queueSpeak, schedule, statusText])

  const fullReset = useCallback(() => {
    clearTimer()
    wState.current = {
      rep: 0,
      set: 1,
      phase: PHASES.STOPPED,
      phaseStart: Date.now(),
      remainingTime: 0,
      lastSpokenSecond: -1,
      isJumping: false,
      setStartTime: 0,
    }
    displayRep.value = 0
    displaySet.value = 1
    updateUI({
      isRunning: false,
      isPaused: false,
      phase: '',
    })
    statusText.value = 'Press Start'
  }, [clearTimer, displayRep, displaySet, updateUI, statusText])

  const continueToNextPhase = useCallback(() => {
    const maxSets = activeExercise?.sets ?? settings.maxSets
    const nextSet = wState.current.set + 1

    if (nextSet > maxSets) {
      fullReset()
      updateUI({
        isExerciseComplete: true,
      })
      statusText.value = 'Exercise Complete!'
    } else {
      wState.current.set = nextSet
      wState.current.rep = 0
      displaySet.value = nextSet
      displayRep.value = 0

      updateUI({
        isRunning: false,
        isPaused: false,
        phase: PHASE_DISPLAY[PHASES.REST],
      })
      queueSpeak(`Set complete. Rest now.`, {
        priority: true,
        onDone: startRest,
      })
    }
  }, [
    settings,
    fullReset,
    updateUI,
    displayRep,
    displaySet,
    queueSpeak,
    statusText,
    startRest,
  ])

  const stopWorkout = useCallback(() => {
    clearTimer()
    wState.current.phase = PHASES.STOPPED
    wState.current.rep = 0
    wState.current.remainingTime = 0
    wState.current.isJumping = false
    displayRep.value = 0
    updateUI({
      isRunning: false,
      isPaused: false,
      phase: '',
    })
    statusText.value = `Press Start for Set ${wState.current.set}`
  }, [clearTimer, displayRep, updateUI, statusText])

  const endSet = useCallback(() => {
    if (wState.current.phase === PHASES.REST) {
      stopWorkout()
      return
    }

    // Capture the end time at the moment the set ends
    const endTime = Date.now()

    // If the user ends the set during the countdown, we need to stop the timer.
    if (wState.current.phase === PHASES.COUNTDOWN) {
      clearTimer()
      wState.current.phase = PHASES.STOPPED
      updateUI({
        isRunning: false,
        isPaused: false,
        phase: '',
      })
    } else {
      clearTimer(false)
    }
    if (activeExercise) {
      onSetComplete({
        exerciseId: activeExercise.id,
        reps: wState.current.rep,
        set: wState.current.set,
        startTime: wState.current.setStartTime,
        endTime,
      })
    } else {
      fullReset()
    }
  }, [
    activeExercise,
    onSetComplete,
    clearTimer,
    fullReset,
    stopWorkout,
    updateUI,
  ])

  const startConcentric = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime
        : settings.concentricSeconds * 1000
    wState.current.remainingTime = 0

    wState.current.phase = PHASES.CONCENTRIC
    wState.current.phaseStart = Date.now()

    const stopSpeechOnClear = false
    schedule(
      duration,
      () => {
        updateUI({ phase: PHASE_DISPLAY[PHASES.ECCENTRIC] })
        startEccentricRef.current()
      },
      stopSpeechOnClear,
    )
  }, [settings, schedule, updateUI])

  const startEccentric = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.eccentricSeconds
    wState.current.remainingTime = 0

    const { eccentricCountdownEnabled } = settings
    const maxReps = activeExercise?.reps ?? settings.maxReps
    wState.current.phase = PHASES.ECCENTRIC
    wState.current.phaseStart = Date.now()
    wState.current.lastSpokenSecond = -1

    const onPhaseEnd = () => {
      if (wState.current.rep >= maxReps) {
        runOnJS(endSet)()
      } else {
        wState.current.rep += 1
        displayRep.value = wState.current.rep
        setTimeout(() => {
          queueSpeak(String(wState.current.rep))
        }, 150)
        updateUI({ phase: PHASE_DISPLAY[PHASES.CONCENTRIC] })
        startConcentricRef.current()
      }
    }

    schedule(duration * 1000, onPhaseEnd)

    if (eccentricCountdownEnabled) {
      const audioTick = () => {
        const elapsed = (Date.now() - wState.current.phaseStart) / 1000
        const remaining = duration - elapsed
        const whole = Math.ceil(remaining)

        if (
          remaining > 0 &&
          whole !== wState.current.lastSpokenSecond &&
          whole <= 5
        ) {
          wState.current.lastSpokenSecond = whole
          speakEccentric(String(whole))
        }

        if (remaining > 1) {
          audioTimeoutRef.current = bgSetTimeout(audioTick, 1000)
        }
      }
      audioTick()
    }
  }, [
    settings,
    speakEccentric,
    queueSpeak,
    schedule,
    updateUI,
    displayRep,
    endSet,
  ])

  // Keep refs in sync with the latest versions
  startConcentricRef.current = startConcentric
  startEccentricRef.current = startEccentric

  const startCountdown = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.countdownSeconds
    wState.current.remainingTime = 0

    wState.current.phase = PHASES.COUNTDOWN
    wState.current.phaseStart = Date.now()
    wState.current.lastSpokenSecond = -1
    updateUI({ phase: 'Get Ready' })

    if (!ui.isPaused) {
      queueSpeak('Get ready.', { priority: true })
    }

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000
      const remaining = duration - elapsed
      const whole = Math.ceil(remaining)

      statusText.value = `Get Ready… ${Math.max(0, whole)}`

      if (whole > 0 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole
        if (whole <= settings.countdownAnnouncementThreshold) {
          queueSpeak(String(whole))
        }
      }

      if (remaining <= 0) {
        queueSpeak('Go!', { priority: true })
        wState.current.setStartTime = Date.now() // Record when the set actually starts
        if (!wState.current.isJumping && wState.current.rep === 0) {
          wState.current.rep = 1
          queueSpeak('1')
        }
        displayRep.value = wState.current.rep
        updateUI({
          phase: PHASE_DISPLAY[PHASES.CONCENTRIC],
        })
        statusText.value = 'In Progress'
        startConcentric()
      } else {
        const stopSpeech = false
        schedule(1000 - (Date.now() % 1000), tick, stopSpeech)
      }
    }
    tick()
  }, [
    settings,
    ui.isPaused,
    queueSpeak,
    schedule,
    updateUI,
    displayRep,
    statusText,
    startConcentric,
  ])

  const resetInternalState = useCallback(
    (newStartingSet = 1) => {
      wState.current = {
        rep: 0,
        set: newStartingSet,
        phase: PHASES.STOPPED,
        phaseStart: Date.now(),
        remainingTime: 0,
        lastSpokenSecond: -1,
        isJumping: false,
        setStartTime: 0,
      }
      displayRep.value = 0
      displaySet.value = newStartingSet
    },
    [displayRep, displaySet],
  )

  const startWorkout = useCallback(() => {
    if (ui.isRunning) return

    if (statusText.value === 'Exercise Complete!') {
      resetInternalState()
    }

    updateUI({
      isExerciseComplete: false,
      isRunning: true,
      isPaused: false,
    })

    wState.current.rep = 0
    displayRep.value = 0
    startCountdown()
  }, [
    ui.isRunning,
    statusText,
    resetInternalState,
    updateUI,
    displayRep,
    startCountdown,
  ])

  const pauseWorkout = useCallback(() => {
    if (!ui.isRunning) return

    if (ui.isPaused) {
      updateUI({ isPaused: false })
      queueSpeak('Resuming', { priority: true })

      switch (wState.current.phase) {
        case PHASES.COUNTDOWN:
          startCountdown()
          break
        case PHASES.CONCENTRIC:
          startConcentric()
          break
        case PHASES.ECCENTRIC:
          startEccentric()
          break
        case PHASES.REST:
          startRest()
          break
        default:
          fullReset()
      }
    } else {
      const elapsed = Date.now() - wState.current.phaseStart

      if (wState.current.phase === PHASES.REST) {
        // For REST, remainingTime will actually store "ELAPSED" time in ms
        // This is a semantic change for this variable for this phase only.
        // In `startRest`, we read it as elapsed.
        wState.current.remainingTime = elapsed
      } else {
        // For other phases, it stores REMAINING time.
        let duration: number
        switch (wState.current.phase) {
          case PHASES.COUNTDOWN:
            duration = settings.countdownSeconds * 1000
            break
          case PHASES.CONCENTRIC:
            duration = settings.concentricSeconds * 1000
            break
          case PHASES.ECCENTRIC:
            duration = settings.eccentricSeconds * 1000
            break
          default:
            duration = 0
        }
        wState.current.remainingTime = Math.max(0, duration - elapsed)
      }

      updateUI({ isPaused: true })
      statusText.value = 'Paused'
      queueSpeak('Paused', { priority: true })
    }
  }, [
    ui.isRunning,
    ui.isPaused,
    settings,
    updateUI,
    queueSpeak,
    clearTimer,
    statusText,
    startCountdown,
    startConcentric,
    startEccentric,
    startRest,
    fullReset,
  ])

  const jumpToRep = useCallback(
    (rep: number) => {
      clearTimer()
      wState.current.rep = rep
      wState.current.isJumping = true
      wState.current.remainingTime = 0
      displayRep.value = rep
      updateUI({
        isRunning: true,
        isPaused: false,
        phase: PHASE_DISPLAY[PHASES.CONCENTRIC],
      })
      queueSpeak(`Rep ${rep}.`, { priority: true })
      startConcentric()
    },
    [clearTimer, displayRep, updateUI, queueSpeak, startConcentric],
  )

  const jumpToSet = useCallback(
    (set: number) => {
      clearTimer()
      wState.current.set = set
      wState.current.rep = 0
      wState.current.isJumping = false
      wState.current.remainingTime = 0
      displaySet.value = set
      displayRep.value = 0
      updateUI({
        isRunning: true,
        isPaused: false,
        phase: '',
        isExerciseComplete: false,
      })
      queueSpeak(`Set ${set}.`, { priority: true })
      startCountdown()
    },
    [clearTimer, displaySet, displayRep, updateUI, queueSpeak, startCountdown],
  )

  const runNextSet = useCallback(() => {
    clearTimer()
    wState.current.isJumping = false
    updateUI({ isRunning: true, isPaused: false })
    startCountdown()
  }, [clearTimer, updateUI, startCountdown])

  const addCountdownTime = useCallback(() => {
    if (wState.current.phase === PHASES.COUNTDOWN) {
      wState.current.phaseStart += 5000
    }
  }, [])

  useEffect(() => {
    const prevId = prevExerciseIdRef.current
    const currentId = activeExercise?.id
    prevExerciseIdRef.current = currentId

    // Only reset when switching to a different exercise
    if (prevId !== currentId) {
      clearTimer()
      if (activeExercise) {
        resetInternalState(startingSet)
        updateUI({
          isRunning: false,
          isPaused: false,
          phase: '',
          isExerciseComplete: false,
        })
        statusText.value = `Press Start for Set ${startingSet}`
      } else {
        fullReset()
      }
    }
  }, [
    activeExercise,
    startingSet,
    resetInternalState,
    fullReset,
    updateUI,
    statusText,
    clearTimer,
  ])

  const isActivityActiveRef = useRef(false)

  useEffect(() => {
    if (Platform.OS === 'web') return

    const isResting = ui.phase === PHASE_DISPLAY[PHASES.REST]

    if (!activeExercise || (!ui.isRunning && !isResting)) {
      if (isActivityActiveRef.current) {
        stopWorkoutActivity()
        isActivityActiveRef.current = false
      }
      return
    }

    const restStartTimestamp = isResting ? wState.current.phaseStart : Date.now()
    const restSeconds = settings.restSeconds

    const statePayload = {
      exerciseName: activeExercise.name,
      nextExerciseName: nextExerciseName || '',
      currentSet: wState.current.set,
      totalSets: activeExercise.sets ?? settings.maxSets,
      reps: activeExercise.reps,
      phase: ui.phase,
      isResting,
      restSeconds,
      restStartTimestamp,
    }

    if (!isActivityActiveRef.current) {
      startWorkoutActivity(statePayload)
      isActivityActiveRef.current = true
    } else {
      updateWorkoutActivity(statePayload)
    }
  }, [
    activeExercise,
    nextExerciseName,
    ui.isRunning,
    ui.isPaused,
    ui.phase,
    settings.restSeconds,
    settings.maxSets,
  ])

  // Also clean up on unmount
  useEffect(() => {
    return () => {
      if (isActivityActiveRef.current) {
        stopWorkoutActivity()
      }
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  return useMemo(
    () => ({
      currentRep: displayRep,
      currentSet: displaySet,
      isRunning: ui.isRunning,
      isPaused: ui.isPaused,
      isResting: ui.phase === PHASE_DISPLAY[PHASES.REST],
      phase: ui.phase,
      statusText,
      isExerciseComplete: ui.isExerciseComplete,
      startWorkout,
      pauseWorkout,
      stopWorkout,
      runNextSet,
      jumpToRep,
      jumpToSet,
      setStatusText: (text: string) => {
        statusText.value = text
      },
      resetExerciseCompleteFlag: () => updateUI({ isExerciseComplete: false }),
      continueToNextPhase,
      addCountdownTime,
      endSet,
    }),
    [
      displayRep,
      displaySet,
      ui,
      statusText,
      startWorkout,
      pauseWorkout,
      stopWorkout,
      runNextSet,
      jumpToRep,
      jumpToSet,
      updateUI,
      continueToNextPhase,
      addCountdownTime,
    ],
  )
}
