import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as Speech from 'expo-speech';
import { bgSetInterval, bgClearInterval } from 'expo-background-timer';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

const TICK_INTERVAL = 100; // ms
const TICK_SECONDS = TICK_INTERVAL / 1000;

// Phase constants
const PHASES = {
  STOPPED: 'stopped',
  COUNTDOWN: 'countdown',
  CONCENTRIC: 'concentric',
  ECCENTRIC: 'eccentric',
  REST: 'rest'
};

const PHASE_DISPLAY = {
  [PHASES.CONCENTRIC]: 'Concentric',
  [PHASES.ECCENTRIC]: 'Eccentric',
  [PHASES.REST]: 'Rest'
};

export const useWorkoutTimer = (
  settings,
  { speak, speakEccentric, playBeep }
) => {
  // --- Reanimated Shared Values ---
  const displayRep = useSharedValue(0);
  const displaySet = useSharedValue(1);

  // --- State Management ---
  const [state, setState] = useState({
    isExerciseComplete: false,
    isRunning: false,
    isPaused: false,
    phase: '',
    statusText: 'Press Start'
  });

  // --- Internal State Ref ---
  const workoutState = useRef({
    rep: 0,
    set: 1,
    phase: PHASES.STOPPED,
    phaseTime: 0,
    lastSpokenSecond: -1,
    isJumping: false
  });

  const timerRef = useRef(null);
  const settingsRef = useRef(settings);

  // Update settings ref when settings change
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // --- Utility Functions ---
  const stopAllTimers = useCallback(() => {
    Speech.stop();
    if (timerRef.current) {
      bgClearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateUIState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // --- Phase Handlers ---
  const handleCountdownPhase = useCallback(() => {
    const state = workoutState.current;
    const { countdownSeconds } = settingsRef.current;
    const remaining = countdownSeconds - state.phaseTime;
    const currentSecond = Math.floor(state.phaseTime);

    // Speak countdown numbers
    if (currentSecond > state.lastSpokenSecond && remaining > 0) {
      state.lastSpokenSecond = currentSecond;
      const numToSpeak = Math.ceil(remaining);
      updateUIState({ statusText: `Get Ready... ${numToSpeak}` });
      speak(String(numToSpeak));
    }

    // Transition to concentric phase
    if (remaining <= 0) {
      playBeep(880);
      speak('Go!');

      if (!state.isJumping && state.rep === 0) {
        state.rep = 1;
      }

      state.phase = PHASES.CONCENTRIC;
      state.phaseTime = 0;
      state.isJumping = false;
      state.lastSpokenSecond = -1;

      speak(String(state.rep));
      displayRep.value = state.rep;

      updateUIState({
        statusText: 'In Progress',
        phase: PHASE_DISPLAY[PHASES.CONCENTRIC]
      });
    }
  }, [speak, playBeep, displayRep, updateUIState]);

  const handleConcentricPhase = useCallback(() => {
    const state = workoutState.current;
    const { concentricSeconds } = settingsRef.current;

    if (state.phaseTime >= concentricSeconds) {
      state.phase = PHASES.ECCENTRIC;
      state.phaseTime = 0;
      state.lastSpokenSecond = -1;
      updateUIState({ phase: PHASE_DISPLAY[PHASES.ECCENTRIC] });
    }
  }, [updateUIState]);

  const handleEccentricPhase = useCallback(() => {
    const state = workoutState.current;
    const { eccentricSeconds, maxReps, eccentricCountdownEnabled } = settingsRef.current;
    const remaining = eccentricSeconds - state.phaseTime;
    const currentSecond = Math.floor(state.phaseTime);

    // Eccentric countdown
    if (eccentricCountdownEnabled &&
      currentSecond > state.lastSpokenSecond &&
      remaining > 0) {
      state.lastSpokenSecond = currentSecond;
      const numToSpeak = Math.ceil(remaining);
      Speech.stop();
      speakEccentric(String(numToSpeak));
    }

    // Phase transition
    if (state.phaseTime >= eccentricSeconds) {
      if (state.rep >= maxReps) {
        runOnJS(endSet)();
      } else {
        state.phase = PHASES.CONCENTRIC;
        state.phaseTime = 0;
        state.rep += 1;
        speak(String(state.rep));
        displayRep.value = state.rep;
        updateUIState({ phase: PHASE_DISPLAY[PHASES.CONCENTRIC] });
      }
    }
  }, [speak, speakEccentric, displayRep, updateUIState]);

  const handleRestPhase = useCallback(() => {
    const state = workoutState.current;
    const { restSeconds } = settingsRef.current;
    const remaining = restSeconds - state.phaseTime;
    const currentSecond = Math.floor(state.phaseTime);

    updateUIState({ statusText: `Rest: ${Math.ceil(remaining)}s` });

    // Rest countdown beeps
    if (remaining <= 3 && currentSecond > state.lastSpokenSecond) {
      state.lastSpokenSecond = currentSecond;
      playBeep();
    }

    // Rest complete
    if (remaining <= 0) {
      stopAllTimers();
      updateUIState({
        isRunning: false,
        statusText: `Press Start for Set ${state.set}`
      });
      speak(`Rest complete. Press start for set ${state.set}.`);
      playBeep(880);
    }
  }, [speak, playBeep, stopAllTimers, updateUIState]);

  // --- Main Timer Tick ---
  const timerTick = useCallback(() => {
    const state = workoutState.current;
    state.phaseTime += TICK_SECONDS;

    const phaseHandlers = {
      [PHASES.COUNTDOWN]: handleCountdownPhase,
      [PHASES.CONCENTRIC]: handleConcentricPhase,
      [PHASES.ECCENTRIC]: handleEccentricPhase,
      [PHASES.REST]: handleRestPhase
    };

    const handler = phaseHandlers[state.phase];
    if (handler) handler();
  }, [handleCountdownPhase, handleConcentricPhase, handleEccentricPhase, handleRestPhase]);

  // --- Timer Control ---
  const startTimer = useCallback(() => {
    stopAllTimers();
    timerRef.current = bgSetInterval(timerTick, TICK_INTERVAL);
  }, [stopAllTimers, timerTick]);

  // --- Workout Control Functions ---
  const resetWorkoutState = useCallback(() => {
    workoutState.current = {
      rep: 0,
      set: 1,
      phase: PHASES.STOPPED,
      phaseTime: 0,
      lastSpokenSecond: -1,
      isJumping: false
    };
    displayRep.value = 0;
    displaySet.value = 1;
  }, [displayRep, displaySet]);

  const stopWorkout = useCallback(() => {
    stopAllTimers();
    resetWorkoutState();
    updateUIState({
      isRunning: false,
      isPaused: false,
      phase: '',
      statusText: 'Press Start'
    });
  }, [stopAllTimers, resetWorkoutState, updateUIState]);

  const endSet = useCallback(() => {
    const state = workoutState.current;
    const { maxSets, restSeconds } = settingsRef.current;
    const nextSet = state.set + 1;

    stopAllTimers();

    if (nextSet > maxSets) {
      stopWorkout();
      updateUIState({
        statusText: 'Exercise Complete!',
        isExerciseComplete: true,
        isRunning: false
      });
    } else {
      state.phase = PHASES.REST;
      state.phaseTime = 0;
      state.lastSpokenSecond = -1;
      state.set = nextSet;
      state.rep = 0;

      displaySet.value = nextSet;
      displayRep.value = 0;

      updateUIState({
        phase: PHASE_DISPLAY[PHASES.REST],
        isRunning: false
      });

      speak(`Set complete. Rest for ${restSeconds} seconds.`);
      startTimer();
    }
  }, [stopAllTimers, stopWorkout, startTimer, speak, displayRep, displaySet, updateUIState]);

  const startWorkout = useCallback(() => {
    if (state.isRunning && !state.isPaused) return;

    if (state.statusText === 'Exercise Complete!') {
      stopWorkout();
    }

    workoutState.current = {
      ...workoutState.current,
      set: 1,
      rep: 0,
      phase: PHASES.COUNTDOWN,
      phaseTime: 0,
      lastSpokenSecond: -1,
      isJumping: false
    };

    displaySet.value = 1;
    displayRep.value = 0;

    updateUIState({
      isExerciseComplete: false,
      isRunning: true,
      isPaused: false
    });

    speak('Get ready.');
    startTimer();
  }, [state, stopWorkout, speak, startTimer, displaySet, displayRep, updateUIState]);

  const pauseWorkout = useCallback(() => {
    if (!state.isRunning) return;

    if (state.isPaused) {
      // Resume
      workoutState.current.phase = PHASES.COUNTDOWN;
      workoutState.current.phaseTime = 0;
      workoutState.current.lastSpokenSecond = -1;
      workoutState.current.isJumping = true;

      updateUIState({ isPaused: false });
      speak('Resuming');
      startTimer();
    } else {
      // Pause
      stopAllTimers();
      updateUIState({
        isPaused: true,
        statusText: 'Paused'
      });
      speak('Paused');
    }
  }, [state, speak, startTimer, stopAllTimers, updateUIState]);

  const jumpToRep = useCallback((rep) => {
    stopAllTimers();

    const state = workoutState.current;
    state.rep = rep;
    state.phase = PHASES.COUNTDOWN;
    state.phaseTime = 0;
    state.lastSpokenSecond = -1;
    state.isJumping = true;

    if (state.set < 1) {
      state.set = 1;
      displaySet.value = 1;
    }

    displayRep.value = rep;

    updateUIState({
      isRunning: true,
      isPaused: false
    });

    speak(`Jumping to rep ${rep}. Get ready.`);
    startTimer();
  }, [speak, startTimer, stopAllTimers, displayRep, displaySet, updateUIState]);

  const runNextSet = useCallback(() => {
    stopAllTimers();

    workoutState.current.phase = PHASES.COUNTDOWN;
    workoutState.current.phaseTime = 0;
    workoutState.current.lastSpokenSecond = -1;
    workoutState.current.isJumping = false;

    updateUIState({
      isRunning: true,
      isPaused: false
    });

    speak('Get ready.');
    startTimer();
  }, [speak, startTimer, stopAllTimers, updateUIState]);

  // Cleanup on unmount
  useEffect(() => {
    return stopAllTimers;
  }, [stopAllTimers]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    currentRep: displayRep,
    currentSet: displaySet,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    isResting: state.phase === PHASE_DISPLAY[PHASES.REST],
    phase: state.phase,
    statusText: state.statusText,
    isExerciseComplete: state.isExerciseComplete,
    startWorkout,
    pauseWorkout,
    stopWorkout,
    runNextSet,
    jumpToRep,
    endSet,
    setStatusText: (text) => updateUIState({ statusText: text }),
    resetExerciseCompleteFlag: () => updateUIState({ isExerciseComplete: false })
  }), [
    displayRep, displaySet, state, startWorkout, pauseWorkout,
    stopWorkout, runNextSet, jumpToRep, endSet, updateUIState
  ]);
};
