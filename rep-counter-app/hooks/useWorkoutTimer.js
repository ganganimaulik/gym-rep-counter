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
export function useWorkoutTimer(
  settings, handlers
) {
  /* ----------------------------------------
     External helpers
  ---------------------------------------- */
  const { speak, speakEccentric, playBeep } = handlers;

  /* ----------------------------------------
     Reanimated shared values
  ---------------------------------------- */
  const displayRep = useSharedValue(0);
  const displaySet = useSharedValue(1);

  /* ----------------------------------------
     React state for UI
  ---------------------------------------- */
  const [ui, setUI] = useState({
    isExerciseComplete: false,
    isRunning: false,
    isPaused: false,
    phase: '',
    statusText: 'Press Start',
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
    phaseStart: Date.now(),      // absolute start time of current phase
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
      } catch {/* ignore “timeout not found” */ }
      timeoutRef.current = null;
    }
    Speech.stop();
  }, []);


  /*====================================================================
    Small helper that schedules the next *absolute* event.
  ====================================================================*/
  const schedule = useCallback(
    (ms, cb) => {
      clearTimer();                                      // cancel previous

      // Wrap the real callback so we null-out the ref BEFORE user code runs.
      const id = bgSetTimeout(() => {
        timeoutRef.current = null;                       // <-- important
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
    updateUI({ phase: 'Get Ready', statusText: `Get Ready… ${countdownSeconds}` });

    speak('Get ready.');

    /* inner recursive fn -------------------------------------------*/
    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = countdownSeconds - elapsed;
      const whole = Math.ceil(remaining);

      if (whole > 0 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole;
        speak(String(whole));
        updateUI({ statusText: `Get Ready… ${whole}` });
      }

      if (remaining <= 0) {
        playBeep(880);
        speak('Go!');
        if (!wState.current.isJumping && wState.current.rep === 0)
          wState.current.rep = 1;
        displayRep.value = wState.current.rep;
        updateUI({
          phase: PHASE_DISPLAY[PHASES.CONCENTRIC],
          statusText: 'In Progress',
        });
        startConcentric();
      } else {
        schedule(1000 - (Date.now() % 1000), tick);  // schedule at next second boundary
      }
    };
    tick();
  }, [settings, speak, playBeep, schedule, updateUI, displayRep]);

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

    /* inner recursive fn -------------------------------------------*/
    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = eccentricSeconds - elapsed;
      const whole = Math.ceil(remaining);

      if (
        eccentricCountdownEnabled &&
        remaining > 0 &&
        whole !== wState.current.lastSpokenSecond
      ) {
        wState.current.lastSpokenSecond = whole;
        Speech.stop();
        speakEccentric(String(whole));
      }

      if (remaining <= 0) {
        if (wState.current.rep >= maxReps) {
          runOnJS(endSet)();     // jump back to JS thread
        } else {
          wState.current.rep += 1;
          displayRep.value = wState.current.rep;
          speak(String(wState.current.rep));
          updateUI({ phase: PHASE_DISPLAY[PHASES.CONCENTRIC] });
          startConcentric();
        }
      } else {
        schedule(1000 - (Date.now() % 1000), tick);
      }
    };
    tick();
  }, [settings, speakEccentric, schedule, updateUI, displayRep]);

  const startRest = useCallback(() => {
    const { restSeconds } = settings;
    wState.current.phase = PHASES.REST;
    wState.current.phaseStart = Date.now();
    wState.current.lastSpokenSecond = -1;

    /* inner recursive fn -------------------------------------------*/
    const tick = () => {
      const elapsed = (Date.now() - wState.current.phaseStart) / 1000;
      const remaining = restSeconds - elapsed;
      const whole = Math.ceil(remaining);

      updateUI({ statusText: `Rest: ${whole}s` });

      if (whole <= 3 && whole !== wState.current.lastSpokenSecond) {
        wState.current.lastSpokenSecond = whole;
        playBeep();
      }

      if (remaining <= 0) {
        clearTimer();
        updateUI({
          isRunning: false,
          statusText: `Press Start for Set ${wState.current.set}`,
        });
        speak(`Rest complete. Press start for set ${wState.current.set}.`);
        playBeep(880);
      } else {
        schedule(1000 - (Date.now() % 1000), tick);
      }
    };
    tick();
  }, [settings, playBeep, speak, schedule, updateUI, clearTimer]);

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
      statusText: 'Press Start',
    });
  }, [clearTimer, resetInternalState, updateUI]);

  const endSet = useCallback(() => {
    const { maxSets, restSeconds } = settings;
    clearTimer();
    const next = wState.current.set + 1;

    if (next > maxSets) {
      stopWorkout();
      updateUI({
        statusText: 'Exercise Complete!',
        isExerciseComplete: true,
      });
    } else {
      wState.current.set = next;
      wState.current.rep = 0;
      displaySet.value = next;
      displayRep.value = 0;
      updateUI({
        phase: PHASE_DISPLAY[PHASES.REST],
        isRunning: false,
      });
      speak(`Set complete. Rest for ${restSeconds} seconds.`);
      startRest();
    }
  }, [settings, clearTimer, stopWorkout, updateUI, displayRep, displaySet, startRest, speak]);

  const startWorkout = useCallback(() => {
    if (ui.isRunning && !ui.isPaused) return;
    if (ui.statusText === 'Exercise Complete!') stopWorkout();

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
  }, [ui, stopWorkout, updateUI, displayRep, displaySet, startCountdown]);

  const pauseWorkout = useCallback(() => {
    if (!ui.isRunning) return;
    if (ui.isPaused) {
      // resume
      wState.current.isJumping = true;
      updateUI({ isPaused: false });
      speak('Resuming');
      startCountdown(); // quick 3-2-1 resume
    } else {
      clearTimer();
      updateUI({ isPaused: true, statusText: 'Paused' });
      speak('Paused');
    }
  }, [ui, updateUI, speak, clearTimer, startCountdown]);

  const jumpToRep = useCallback(
    (rep) => {
      clearTimer();
      wState.current.rep = rep;
      wState.current.isJumping = true;
      displayRep.value = rep;
      updateUI({ isRunning: true, isPaused: false });
      speak(`Jumping to rep ${rep}. Get ready.`);
      startCountdown();
    },
    [clearTimer, displayRep, updateUI, speak, startCountdown],
  );

  const runNextSet = useCallback(() => {
    clearTimer();
    wState.current.isJumping = false;
    updateUI({ isRunning: true, isPaused: false });
    speak('Get ready.');
    startCountdown();
  }, [clearTimer, updateUI, speak, startCountdown]);

  /* ----------------------------------------
     unmount cleanup
  ---------------------------------------- */
  useEffect(() => clearTimer, [clearTimer]);

  /* ----------------------------------------
     public API
  ---------------------------------------- */
  return useMemo(
    () => ({
      currentRep: displayRep,
      currentSet: displaySet,
      isRunning: ui.isRunning,
      isPaused: ui.isPaused,
      isResting: ui.phase === PHASE_DISPLAY[PHASES.REST],
      phase: ui.phase,
      statusText: ui.statusText,
      isExerciseComplete: ui.isExerciseComplete,
      startWorkout,
      pauseWorkout,
      stopWorkout,
      runNextSet,
      jumpToRep,
      endSet,
      setStatusText: (text) => updateUI({ statusText: text }),
      resetExerciseCompleteFlag: () => updateUI({ isExerciseComplete: false }),
    }),
    [
      displayRep,
      displaySet,
      ui,
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
