import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as Speech from 'expo-speech';
import {
  bgSetTimeout,
  bgClearTimeout,
  enableBackgroundExecution,
  disableBackgroundExecution,
} from 'expo-background-timer';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

/*--------------------------------------------------------------------
  Constants
--------------------------------------------------------------------*/
const PHASES = {
  STOPPED: 'stopped',
  COUNTDOWN: 'countdown',
  CONCENTRIC: 'concentric',
  ECCENTRIC: 'eccentric',
  REST: 'rest',
};

const PHASE_DISPLAY = {
  [PHASES.CONCENTRIC]: 'Concentric',
  [PHASES.ECCENTRIC]: 'Eccentric',
  [PHASES.REST]: 'Rest',
};

/*--------------------------------------------------------------------
  Hook
--------------------------------------------------------------------*/
export function useWorkoutTimer(settings, handlers) {
  /* ----------------------------------------
     External helpers
  ---------------------------------------- */
  const { speak, speakEccentric, queueSpeak } = handlers;

  useEffect(() => {
    enableBackgroundExecution();
  }, []);

  /* ----------------------------------------
     Reanimated shared values
  ---------------------------------------- */
  const displayRep = useSharedValue(0);
  const displaySet = useSharedValue(1);
  const statusText = useSharedValue('Press Start');

  /* ----------------------------------------
     React state for UI
  ---------------------------------------- */
  const [ui, setUI] = useState({
    isExerciseComplete: false,
    isRunning: false,
    isPaused: false,
    phase: '',
  });
  const updateUI = useCallback(
    (patch) =>
      setUI(prev => ({ ...prev, ...patch })),
    [],
  );

  /* ----------------------------------------
     Internal mutable state
  ---------------------------------------- */
  const wState = useRef({
    rep: 0,
    set: 1,
    phase: PHASES.STOPPED,
    phaseStart: Date.now(),
    remainingTime: 0, // Time left when paused
    lastSpokenSecond: -1,
    isJumping: false,
  });

  /* ----------------------------------------
     One single timeout at any moment
  ---------------------------------------- */
  const timeoutRef = useRef(null);
  const audioTimeoutRef = useRef(null); // Ref for the eccentric audio timer

  // 1. Modify clearTimer to accept an option to prevent stopping speech
  const clearTimer = useCallback((stopSpeech = true) => {
    // Clear the main phase timer
    if (timeoutRef.current != null) {
      try {
        bgClearTimeout(timeoutRef.current);
      } catch {/* ignore "timeout not found" */ }
      timeoutRef.current = null;
    }
    // Clear the audio feedback timer
    if (audioTimeoutRef.current != null) {
      try {
        bgClearTimeout(audioTimeoutRef.current);
      } catch {/* ignore "timeout not found" */ }
      audioTimeoutRef.current = null;
    }
    // Only stop speech if the flag is true
    if (stopSpeech) {
      Speech.stop();
    }
  }, []);


  /*====================================================================
    Small helper that schedules the next *absolute* event.
  ====================================================================*/
  const schedule = useCallback(
    (ms, cb, stopSpeech = true) => {
      clearTimer(stopSpeech); // Pass the flag along
      const id = bgSetTimeout(() => {
        timeoutRef.current = null;
        cb();
      }, ms);
      timeoutRef.current = id;
    },
    [clearTimer],
  );

  /*====================================================================
    Phase handlers
  ====================================================================*/
  // We need to define these later to avoid circular dependencies
  // so we declare them here and assign them later.
  let startConcentric, startEccentric, startRest, endSet, stopWorkout;

  const startCountdown = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.countdownSeconds;
    wState.current.remainingTime = 0;

    wState.current.phase = PHASES.COUNTDOWN;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;
    updateUI({ phase: 'Get Ready' });

    if (!ui.isPaused) {
      queueSpeak('Get ready.', { priority: true });
    }

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = duration - elapsed;
      const whole = Math.ceil(remaining);

      statusText.value = `Get Ready… ${Math.max(0, whole)}`;

      if (whole > 0 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole;
        if (whole <= 3) {
          queueSpeak(String(whole));
        }
      }

      if (remaining <= 0) {
        queueSpeak('Go!', { priority: true });
        if (!wState.current.isJumping && wState.current.rep === 0) {
          wState.current.rep = 1;
          queueSpeak('1');
        }
        displayRep.value = wState.current.rep;
        updateUI({
          phase: PHASE_DISPLAY[PHASES.CONCENTRIC],
        });
        statusText.value = 'In Progress';
        startConcentric();
      } else {
        // Must set stopSpeech to false, otherwise the schedule call will clear the timer
        // and immediately call Speech.stop(), cutting off the announcement.
        const stopSpeech = false;
        schedule(1000 - (Date.now() % 1000), tick, stopSpeech);
      }
    };
    tick();
  }, [settings, ui.isPaused, queueSpeak, schedule, updateUI, displayRep, statusText]);

  startConcentric = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime
        : settings.concentricSeconds * 1000;
    wState.current.remainingTime = 0;

    wState.current.phase = PHASES.CONCENTRIC;
    wState.current.phaseStart = Date.now();

    // When starting the concentric phase, we clear the previous timer
    // but explicitly tell it NOT to stop speech, allowing "1" to finish.
    const stopSpeechOnClear = false;
    schedule(duration, () => {
      updateUI({ phase: PHASE_DISPLAY[PHASES.ECCENTRIC] });
      startEccentric();
    }, stopSpeechOnClear);
  }, [settings, schedule, updateUI]);

  startEccentric = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.eccentricSeconds;
    wState.current.remainingTime = 0;

    const { eccentricCountdownEnabled, maxReps } = settings;
    wState.current.phase = PHASES.ECCENTRIC;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;

    // --- SOLUTION ---
    // 1. Define the logic that runs precisely when the phase ends.
    const onPhaseEnd = () => {
      if (wState.current.rep >= maxReps) {
        // Use runOnJS if calling from a Reanimated worklet, which this isn't, but it's safe.
        runOnJS(endSet)();
      } else {
        wState.current.rep += 1;
        displayRep.value = wState.current.rep;
        // The small delay for the rep number announcement is good.
        setTimeout(() => {
          queueSpeak(String(wState.current.rep));
        }, 150);
        updateUI({ phase: PHASE_DISPLAY[PHASES.CONCENTRIC] });
        startConcentric();
      }
    };

    // 2. Schedule the end of the phase with a single, precise timeout.
    // This is the main timer.
    schedule(duration * 1000, onPhaseEnd);


    // 3. If enabled, start a *separate* recursive tick for audio cues only.
    if (eccentricCountdownEnabled) {
      const audioTick = () => {
        const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
        const remaining = duration - elapsed;
        const whole = Math.ceil(remaining);

        // This timer's only job is to speak.
        if (
          remaining > 0 &&
          whole !== wState.current.lastSpokenSecond &&
          whole <= 5
        ) {
          wState.current.lastSpokenSecond = whole;
          speakEccentric(String(whole));
        }

        // Only schedule the next audio tick if there's more than a second left.
        // This prevents it from interfering with the main timer's end event.
        if (remaining > 1) {
          // NOTE: We don't use the main `schedule` function here, to avoid clearing
          // the main `onPhaseEnd` timeout we set earlier.
          audioTimeoutRef.current = bgSetTimeout(audioTick, 1000);
        }
      };
      audioTick();
    }
  }, [settings, speakEccentric, queueSpeak, schedule, updateUI, displayRep, endSet, startConcentric]);

  startRest = useCallback(() => {
    const duration =
      wState.current.remainingTime > 0
        ? wState.current.remainingTime / 1000
        : settings.restSeconds;
    wState.current.remainingTime = 0;

    wState.current.phase = PHASES.REST;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = duration - elapsed;
      const whole = Math.ceil(remaining);

      statusText.value = `Rest: ${Math.max(0, whole)}s`;

      if (remaining > 0) {
        if (
          whole <= 3 &&
          whole > 0 &&
          whole !== wState.current.lastSpokenSecond
        ) {
          wState.current.lastSpokenSecond = whole;
          // No beeping sound, per user request memory
        }
        schedule(1000 - (Date.now() % 1000), tick);
      } else {
        clearTimer();
        statusText.value = `Press Start for Set ${wState.current.set}`;
        queueSpeak(`Rest complete. Press start for set ${wState.current.set}.`, {
          priority: true,
        });
      }
    };
    tick();
  }, [settings, queueSpeak, schedule, clearTimer, statusText]);

  /*====================================================================
    Public workout controls
  ====================================================================*/
  const resetInternalState = useCallback(() => {
    wState.current = {
      rep: 0,
      set: 1,
      phase: PHASES.STOPPED,
      phaseStart: Date.now(),
      remainingTime: 0,
      lastSpokenSecond: -1,
      isJumping: false,
    };
    displayRep.value = 0;
    displaySet.value = 1;
  }, [displayRep, displaySet]);

  stopWorkout = useCallback(() => {
    clearTimer();
    resetInternalState();
    updateUI({
      isRunning: false,
      isPaused: false,
      phase: '',
    });
    statusText.value = 'Press Start';
    // disableBackgroundExecution();
  }, [clearTimer, resetInternalState, updateUI, statusText]);

  endSet = useCallback(() => {
    const { maxSets } = settings;
    // Clear timer but don't stop speech; the announcement will play, and `onDone` will trigger the rest timer.
    clearTimer(false);
    const nextSet = wState.current.set + 1;

    if (nextSet > maxSets) {
      stopWorkout();
      updateUI({
        isExerciseComplete: true,
      });
      statusText.value = 'Exercise Complete!';
    } else {
      wState.current.set = nextSet;
      wState.current.rep = 0;
      displaySet.value = nextSet;
      displayRep.value = 0;

      updateUI({
        isRunning: false,
        isPaused: false,
        phase: PHASE_DISPLAY[PHASES.REST],
      });
      // Chain the start of the rest timer to the completion of the announcement
      queueSpeak(`Set complete. Rest now.`, {
        priority: true,
        onDone: startRest,
      });
    }
  }, [settings, clearTimer, stopWorkout, updateUI, displayRep, displaySet, queueSpeak, statusText, startRest]);

  const startWorkout = useCallback(() => {
    if (wState.current.phase !== PHASES.STOPPED) return;
    if (statusText.value === 'Exercise Complete!') {
      resetInternalState();
    }


    updateUI({
      isExerciseComplete: false,
      isRunning: true,
      isPaused: false,
    });

    wState.current.rep = 0;
    wState.current.set = 1;
    displayRep.value = 0;
    displaySet.value = 1;
    startCountdown();
  }, [updateUI, displayRep, displaySet, startCountdown, statusText, resetInternalState]);

  const pauseWorkout = useCallback(() => {
    if (!ui.isRunning) return;

    if (ui.isPaused) {
      updateUI({ isPaused: false });
      queueSpeak('Resuming', { priority: true });

      switch (wState.current.phase) {
        case PHASES.COUNTDOWN:
          startCountdown();
          break;
        case PHASES.CONCENTRIC:
          startConcentric();
          break;
        case PHASES.ECCENTRIC:
          startEccentric();
          break;
        case PHASES.REST:
          startRest();
          break;
        default:
          stopWorkout();
      }
    } else {
      clearTimer();
      let duration;
      switch (wState.current.phase) {
        case PHASES.COUNTDOWN:
          duration = settings.countdownSeconds * 1000;
          break;
        case PHASES.CONCENTRIC:
          duration = settings.concentricSeconds * 1000;
          break;
        case PHASES.ECCENTRIC:
          duration = settings.eccentricSeconds * 1000;
          break;
        case PHASES.REST:
          duration = settings.restSeconds * 1000;
          break;
        default:
          duration = 0;
      }
      const elapsed = Date.now() - wState.current.phaseStart;
      wState.current.remainingTime = Math.max(0, duration - elapsed);

      updateUI({ isPaused: true });
      statusText.value = 'Paused';
      queueSpeak('Paused', { priority: true });
    }
  }, [
    ui,
    settings,
    updateUI,
    queueSpeak,
    clearTimer,
    statusText,
    startCountdown
  ]);

  const jumpToRep = useCallback(
    (rep) => {
      clearTimer();
      wState.current.rep = rep;
      wState.current.isJumping = true;
      wState.current.remainingTime = 0;
      displayRep.value = rep;
      updateUI({
        isRunning: true,
        isPaused: false,
        phase: PHASE_DISPLAY[PHASES.CONCENTRIC],
      });
      queueSpeak(`Rep ${rep}.`, { priority: true });
      startConcentric();
    },
    [clearTimer, displayRep, updateUI, queueSpeak],
  );

  const runNextSet = useCallback(() => {
    clearTimer();
    wState.current.isJumping = false;
    updateUI({ isRunning: true, isPaused: false });
    queueSpeak('Get ready.', { priority: true });
    startCountdown();
  }, [clearTimer, updateUI, queueSpeak, startCountdown]);

  useEffect(() => clearTimer, [clearTimer]);

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
      endSet,
      setStatusText: (text) => {
        statusText.value = text;
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
      endSet,
      updateUI,
    ],
  );
}