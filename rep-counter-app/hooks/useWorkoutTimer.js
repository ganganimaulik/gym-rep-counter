// useWorkoutTimer.ts - improved audio handling version

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as Speech from 'expo-speech';
import {
  bgSetTimeout,
  bgClearTimeout,
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
  const { speak, speakEccentric, playBeep, queueSpeak } = handlers;

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
    lastSpokenSecond: -1,
    isJumping: false,
  });

  /* ----------------------------------------
     One single timeout at any moment
  ---------------------------------------- */
  const timeoutRef = useRef(null);
  const clearTimer = useCallback(() => {
    if (timeoutRef.current != null) {
      try {
        bgClearTimeout(timeoutRef.current);
      } catch {/* ignore "timeout not found" */ }
      timeoutRef.current = null;
    }
    Speech.stop();
  }, []);

  /*====================================================================
    Small helper that schedules the next *absolute* event.
  ====================================================================*/
  const schedule = useCallback(
    (ms, cb) => {
      clearTimer();
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
  const startCountdown = useCallback(() => {
    const { countdownSeconds } = settings;
    wState.current.phase = PHASES.COUNTDOWN;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;
    updateUI({ phase: 'Get Ready' });
    statusText.value = `Get Ready… ${countdownSeconds}`;

    // Use queueSpeak for initial announcement
    queueSpeak('Get ready.', { priority: true });

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = countdownSeconds - elapsed;
      const whole = Math.ceil(remaining);

      // Only speak if it's a new second and we have at least 1 second left
      if (whole > 0 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole;
        statusText.value = `Get Ready… ${whole}`;

        // Only speak countdown for 3, 2, 1 to avoid overlapping
        if (whole <= 3) {
          queueSpeak(String(whole));
        }
      }

      if (remaining <= 0) {
        playBeep(880);
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
        // Add slight buffer to ensure speech completes
        const nextTick = Math.max(500, 1000 - (Date.now() % 1000));
        schedule(nextTick, tick);
      }
    };
    tick();
  }, [settings, queueSpeak, playBeep, schedule, updateUI, displayRep, statusText]);

  const startConcentric = useCallback(() => {
    const { concentricSeconds } = settings;
    wState.current.phase = PHASES.CONCENTRIC;
    wState.current.phaseStart = Date.now();

    schedule(concentricSeconds * 1000, () => {
      updateUI({ phase: PHASE_DISPLAY[PHASES.ECCENTRIC] });
      startEccentric();
    });
  }, [settings, schedule, updateUI]);

  const startEccentric = useCallback(() => {
    const { eccentricSeconds, eccentricCountdownEnabled, maxReps } = settings;
    wState.current.phase = PHASES.ECCENTRIC;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = eccentricSeconds - elapsed;
      const whole = Math.ceil(remaining);

      // Only countdown last 5 seconds to avoid audio overlap
      if (
        eccentricCountdownEnabled &&
        remaining > 0 &&
        whole !== wState.current.lastSpokenSecond &&
        whole <= 5
      ) {
        wState.current.lastSpokenSecond = whole;
        // Use special eccentric voice without interrupting
        speakEccentric(String(whole));
      }

      if (remaining <= 0) {
        if (wState.current.rep >= maxReps) {
          runOnJS(endSet)();
        } else {
          wState.current.rep += 1;
          displayRep.value = wState.current.rep;

          // Small delay ensures eccentric countdown completes
          setTimeout(() => {
            queueSpeak(String(wState.current.rep));
          }, 150);

          updateUI({ phase: PHASE_DISPLAY[PHASES.CONCENTRIC] });
          startConcentric();
        }
      } else {
        // Ensure adequate spacing between speech
        const nextTick = Math.max(600, 1000 - (Date.now() % 1000));
        schedule(nextTick, tick);
      }
    };
    tick();
  }, [settings, speakEccentric, queueSpeak, schedule, updateUI, displayRep]);

  const startRest = useCallback(() => {
    const { restSeconds } = settings;
    wState.current.phase = PHASES.REST;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;

    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = restSeconds - elapsed;
      const whole = Math.ceil(remaining);

      statusText.value = `Rest: ${whole}s`;

      // Only beep for last 3 seconds
      if (whole <= 3 && whole > 0 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole;
        playBeep();
      }

      if (remaining <= 0) {
        clearTimer();
        updateUI({ isRunning: false });
        statusText.value = `Press Start for Set ${wState.current.set}`;
        queueSpeak(`Rest complete. Press start for set ${wState.current.set}.`, { priority: true });
        playBeep(880);
      } else {
        schedule(1000 - (Date.now() % 1000), tick);
      }
    };
    tick();
  }, [settings, playBeep, queueSpeak, schedule, updateUI, clearTimer, statusText]);

  /*====================================================================
    Public workout controls
  ====================================================================*/
  const resetInternalState = useCallback(() => {
    wState.current = {
      rep: 0,
      set: 1,
      phase: PHASES.STOPPED,
      phaseStart: Date.now(),
      lastSpokenSecond: -1,
      isJumping: false,
    };
    displayRep.value = 0;
    displaySet.value = 1;
  }, [displayRep, displaySet]);

  const stopWorkout = useCallback(() => {
    clearTimer();
    resetInternalState();
    updateUI({
      isRunning: false,
      isPaused: false,
      phase: '',
    });
    statusText.value = 'Press Start';
  }, [clearTimer, resetInternalState, updateUI, statusText]);

  const endSet = useCallback(() => {
    const { maxSets, restSeconds } = settings;
    clearTimer();
    const next = wState.current.set + 1;

    if (next > maxSets) {
      stopWorkout();
      updateUI({
        isExerciseComplete: true,
      });
      statusText.value = 'Exercise Complete!';
    } else {
      wState.current.set = next;
      wState.current.rep = 0;
      displaySet.value = next;
      displayRep.value = 0;

      // Transition to a state where the user must press "Start" for the next set.
      updateUI({
        isRunning: false, // This will show the "Start" button
        isPaused: false,
        phase: PHASE_DISPLAY[PHASES.REST], // So "Start" knows to run the next set
      });

      statusText.value = `Rest: ${restSeconds}s. Press Start`;
      queueSpeak(`Set complete. Rest for ${restSeconds} seconds, then press start.`, {
        priority: true,
      });
    }
  }, [settings, clearTimer, stopWorkout, updateUI, displayRep, displaySet, queueSpeak, statusText]);

  const startWorkout = useCallback(() => {
    if (ui.isRunning && !ui.isPaused) return;
    if (statusText.value === 'Exercise Complete!') stopWorkout();

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
  }, [ui, stopWorkout, updateUI, displayRep, displaySet, startCountdown, statusText]);

  const pauseWorkout = useCallback(() => {
    if (!ui.isRunning) return;
    if (ui.isPaused) {
      wState.current.isJumping = true;
      updateUI({ isPaused: false });
      queueSpeak('Resuming', { priority: true });
      startCountdown();
    } else {
      clearTimer();
      updateUI({ isPaused: true });
      statusText.value = 'Paused';
      queueSpeak('Paused', { priority: true });
    }
  }, [ui, updateUI, queueSpeak, clearTimer, startCountdown, statusText]);

  const jumpToRep = useCallback(
    (rep) => {
      clearTimer();
      wState.current.rep = rep;
      wState.current.isJumping = true;
      displayRep.value = rep;
      updateUI({ isRunning: true, isPaused: false });
      queueSpeak(`Jumping to rep ${rep}. Get ready.`, { priority: true });
      startCountdown();
    },
    [clearTimer, displayRep, updateUI, queueSpeak, startCountdown],
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