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

interface DataHandlers {
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
  getNextUncompletedSet: (exerciseId: string) => number
}

interface WorkoutState {
  rep: number
  set: number
  phase: Phase
  phaseStart: number
  remainingTime: number
  lastSpokenSecond: number
  isJumping: boolean
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
  endSet: () => void
  continueToNextPhase: () => void
  setStatusText: (text: string) => void
  resetExerciseCompleteFlag: () => void
}

// Hook
export function useWorkoutTimer(
  settings: Settings,
  handlers: AudioHandler,
  activeExercise: Exercise | undefined,
  dataHandlers: DataHandlers,
  onSetComplete: (exerciseId: string, setNumber: number) => void,
): WorkoutTimerHook {
  const { queueSpeak, speakEccentric } = handlers
  const { isSetCompleted, getNextUncompletedSet } = dataHandlers

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
    set: 1,
    phase: PHASES.STOPPED,
    phaseStart: Date.now(),
    remainingTime: 0,
    lastSpokenSecond: -1,
    isJumping: false,
  })

  const timeoutRef = useRef<number | null>(null)
  const audioTimeoutRef = useRef<number | null>(null)

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

  let startConcentric: () => void,
    startEccentric: () => void,
    startRest: () => void,
    stopWorkout: () => void

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
        if (whole <= 10) {
          queueSpeak(String(whole))
        }
      }

      if (remaining <= 0) {
        queueSpeak('Go!', { priority: true })
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

  startConcentric = useCallback(() => {
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
        startEccentric()
      },
      stopSpeechOnClear,
    )
  }, [settings, schedule, updateUI])

  const endSet = useCallback(() => {
    if (activeExercise) {
      clearTimer()
      statusText.value = 'Set Complete! Log your reps.'
      queueSpeak('Set complete.', { priority: true })
      onSetComplete(activeExercise.id, wState.current.set)
    }
  }, [activeExercise, onSetComplete, clearTimer, statusText, queueSpeak])

  startEccentric = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.eccentricSeconds
    wState.current.remainingTime = 0

    const { eccentricCountdownEnabled, maxReps } = settings
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
        startConcentric()
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
    startConcentric,
  ])

  startRest = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.restSeconds
    wState.current.remainingTime = 0

    wState.current.phase = PHASES.REST
    wState.current.phaseStart = Date.now()
    wState.current.lastSpokenSecond = -1

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000
      const remaining = duration - elapsed
      const whole = Math.ceil(remaining)

      statusText.value = `Rest: ${Math.max(0, whole)}s`

      if (remaining > 0) {
        if (
          whole <= 3 &&
          whole > 0 &&
          whole !== wState.current.lastSpokenSecond
        ) {
          wState.current.lastSpokenSecond = whole
        }
        schedule(1000 - (Date.now() % 1000), tick)
      } else {
        clearTimer()
        statusText.value = `Press Start for Set ${wState.current.set}`
        queueSpeak(
          `Rest complete. Press start for set ${wState.current.set}.`,
          {
            priority: true,
          },
        )
      }
    }
    tick()
  }, [settings, queueSpeak, schedule, clearTimer, statusText])

  const resetInternalState = useCallback(
    (startingSet = 1) => {
      wState.current = {
        rep: 0,
        set: startingSet,
        phase: PHASES.STOPPED,
        phaseStart: Date.now(),
        remainingTime: 0,
        lastSpokenSecond: -1,
        isJumping: false,
      }
      displayRep.value = 0
      displaySet.value = startingSet
    },
    [displayRep, displaySet],
  )

  const fullReset = useCallback(() => {
    clearTimer()
    resetInternalState()
    updateUI({
      isRunning: false,
      isPaused: false,
      phase: '',
    })
    statusText.value = 'Press Start'
  }, [clearTimer, resetInternalState, updateUI, statusText])

  stopWorkout = useCallback(() => {
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

  const finishSet = useCallback(() => {
    if (activeExercise) {
      clearTimer()
      statusText.value = 'Set Complete! Log your reps.'
      queueSpeak('Set complete.', { priority: true })
      onSetComplete(activeExercise.id, wState.current.set)
    }
  }, [activeExercise, onSetComplete, clearTimer, statusText, queueSpeak])

  const continueToNextPhase = useCallback(() => {
    // This function is now called *after* the user logs their set.
    const { maxSets } = settings
    clearTimer(false)
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
    clearTimer,
    fullReset,
    updateUI,
    displayRep,
    displaySet,
    queueSpeak,
    statusText,
    startRest,
  ])

  const startWorkout = useCallback(() => {
    if (ui.isRunning) return

    if (
      activeExercise &&
      isSetCompleted(activeExercise.id, wState.current.set)
    ) {
      statusText.value = `Set ${wState.current.set} is already done.`
      queueSpeak(`Set ${wState.current.set} is already completed for today.`)
      return
    }

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
    activeExercise,
    isSetCompleted,
    statusText,
    queueSpeak,
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
      clearTimer()
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
        case PHASES.REST:
          duration = settings.restSeconds * 1000
          break
        default:
          duration = 0
      }
      const elapsed = Date.now() - wState.current.phaseStart
      wState.current.remainingTime = Math.max(0, duration - elapsed)

      updateUI({ isPaused: true })
      statusText.value = 'Paused'
      queueSpeak('Paused', { priority: true })
    }
  }, [
    ui,
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
    if (
      activeExercise &&
      isSetCompleted(activeExercise.id, wState.current.set)
    ) {
      statusText.value = `Set ${wState.current.set} is already done.`
      queueSpeak(`Set ${wState.current.set} is already completed for today.`)
      return
    }

    clearTimer()
    wState.current.isJumping = false
    updateUI({ isRunning: true, isPaused: false })
    startCountdown()
  }, [
    clearTimer,
    updateUI,
    queueSpeak,
    startCountdown,
    activeExercise,
    isSetCompleted,
    statusText,
  ])

  // Reset state and set the starting set when the active exercise changes
  useEffect(() => {
    clearTimer() // Always clear timer when exercise changes
    if (activeExercise) {
      const nextSet = getNextUncompletedSet(activeExercise.id)
      resetInternalState(nextSet)
      updateUI({
        isRunning: false,
        isPaused: false,
        phase: '',
        isExerciseComplete: false,
      })
      statusText.value = `Press Start for Set ${nextSet}`
    } else {
      fullReset()
    }
  }, [
    activeExercise,
    getNextUncompletedSet,
    resetInternalState,
    fullReset,
    updateUI,
    statusText,
    clearTimer,
  ])

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
      endSet,
      continueToNextPhase,
      setStatusText: (text: string) => {
        statusText.value = text
      },
      resetExerciseCompleteFlag: () => updateUI({ isExerciseComplete: false }),
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
      endSet,
      continueToNextPhase,
      updateUI,
    ],
  )
}