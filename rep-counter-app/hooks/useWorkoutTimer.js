import { useState, useRef, useEffect, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { bgSetInterval, bgClearInterval } from 'expo-background-timer';

const TICK_INTERVAL = 100; // ms

export const useWorkoutTimer = (
  settings,
  { speak, speakEccentric, playBeep }
) => {
  // --- State for UI Rendering ---
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [displayRep, setDisplayRep] = useState(0);
  const [displaySet, setDisplaySet] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState(''); // e.g., Concentric, Eccentric, Rest
  const [statusText, setStatusText] = useState('Press Start');
  const [progress, setProgress] = useState(0); // For the progress bar (0 to 1)

  // --- Refs for Internal Logic ---
  const workoutState = useRef({
    rep: 0,
    set: 1,
    phase: 'stopped', // 'stopped', 'countdown', 'concentric', 'eccentric', 'rest'
    phaseTime: 0,
    lastSpokenSecond: -1,
    isJumping: false, // Flag to handle jump-to-rep logic
  });

  const timerRef = useRef(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const stopAllTimers = useCallback(() => {
    Speech.stop();
    if (timerRef.current) {
      bgClearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const timerTick = useCallback(() => {
    const state = workoutState.current;
    const {
      concentricSeconds,
      eccentricSeconds,
      restSeconds,
      maxReps,
      countdownSeconds,
      eccentricCountdownEnabled,
    } = settingsRef.current;

    state.phaseTime += TICK_INTERVAL / 1000;

    const updateProgress = (totalDuration) => {
      setProgress(Math.min(state.phaseTime / totalDuration, 1));
    };

    switch (state.phase) {
      case 'countdown':
        const remaining = countdownSeconds - state.phaseTime;
        const currentSecond = Math.floor(state.phaseTime);

        if (currentSecond > state.lastSpokenSecond) {
          state.lastSpokenSecond = currentSecond;
          const numToSpeak = Math.ceil(remaining);
          if (numToSpeak > 0) {
            setStatusText(`Get Ready... ${numToSpeak}`);
            speak(String(numToSpeak));
          }
        }

        if (remaining <= 0) {
          playBeep(880);
          speak('Go!');
          setStatusText('In Progress');

          // If starting a rep from 0, move to 1. If jumping, the rep is already set.
          if (!state.isJumping && state.rep === 0) {
            state.rep = 1;
          }

          state.phase = 'concentric';
          state.phaseTime = 0;
          state.isJumping = false; // Reset jump flag

          speak(String(state.rep));
          setDisplayRep(state.rep);
          setPhase('Concentric');
        }
        break;

      case 'concentric':
        updateProgress(concentricSeconds);
        if (state.phaseTime >= concentricSeconds) {
          state.phase = 'eccentric';
          state.phaseTime = 0;
          state.lastSpokenSecond = -1;
          setPhase('Eccentric');
        }
        break;

      case 'eccentric':
        updateProgress(eccentricSeconds);
        const eccentricRemaining = eccentricSeconds - state.phaseTime;
        const eccentricCurrentSecond = Math.floor(state.phaseTime);

        if (
          eccentricCountdownEnabled &&
          eccentricCurrentSecond > state.lastSpokenSecond &&
          eccentricRemaining > 0
        ) {
          state.lastSpokenSecond = eccentricCurrentSecond;
          const numToSpeak = Math.ceil(eccentricRemaining);
          if (numToSpeak > 0) {
            Speech.stop(); // Prevent overlap with rep number
            speakEccentric(String(numToSpeak));
          }
        }

        if (state.phaseTime >= eccentricSeconds) {
          if (state.rep >= maxReps) {
            endSet();
          } else {
            state.phase = 'concentric';
            state.phaseTime = 0;
            state.rep += 1;
            speak(String(state.rep));
            setDisplayRep(state.rep);
            setPhase('Concentric');
          }
        }
        break;

      case 'rest':
        const restRemaining = restSeconds - state.phaseTime;
        updateProgress(restSeconds);
        setStatusText(`Rest: ${Math.ceil(restRemaining)}s`);

        const restCurrentSecond = Math.floor(state.phaseTime);
        if (restRemaining <= 3 && restCurrentSecond > state.lastSpokenSecond) {
          state.lastSpokenSecond = restCurrentSecond;
          playBeep();
        }

        if (restRemaining <= 0) {
          stopAllTimers();
          setIsRunning(false);
          setStatusText(`Press Start for Set ${state.set}`);
          speak(`Rest complete. Press start for set ${state.set}.`);
          playBeep(880);
        }
        break;
    }
  }, [speak, speakEccentric, playBeep, endSet]);

  const startTimer = useCallback(() => {
    stopAllTimers();
    timerRef.current = bgSetInterval(timerTick, TICK_INTERVAL);
  }, [stopAllTimers, timerTick]);

  const stopWorkout = useCallback(() => {
    stopAllTimers();
    setIsRunning(false);
    setIsPaused(false);
    setPhase('');
    setStatusText('Press Start');
    setProgress(0);
    setDisplayRep(0);
    setDisplaySet(1);
    workoutState.current = {
      rep: 0,
      set: 1,
      phase: 'stopped',
      phaseTime: 0,
      lastSpokenSecond: -1,
      isJumping: false,
    };
  }, [stopAllTimers]);

  const endSet = useCallback(() => {
    const state = workoutState.current;
    const { maxSets } = settingsRef.current;
    const nextSet = state.set + 1;

    stopAllTimers();
    setIsRunning(false);

    if (nextSet > maxSets) {
      speak('Exercise complete!');
      stopWorkout();
      setStatusText('Exercise Complete!');
      setIsExerciseComplete(true); // Set completion flag
    } else {
      state.phase = 'rest';
      state.phaseTime = 0;
      state.lastSpokenSecond = -1;
      state.set = nextSet;
      state.rep = 0;

      setDisplaySet(nextSet);
      setDisplayRep(0);
      setPhase('Rest');
      setProgress(0);

      speak(`Set complete. Rest for ${settingsRef.current.restSeconds} seconds.`);
      startTimer();
    }
  }, [stopAllTimers, startTimer, stopWorkout, speak]);

  const startWorkout = () => {
    if (isRunning && !isPaused) return;

    if (statusText === 'Exercise Complete!') {
      stopWorkout();
    }

    setIsExerciseComplete(false); // Reset completion flag

    setIsRunning(true);
    setIsPaused(false);

    workoutState.current = {
      ...workoutState.current,
      set: 1,
      rep: 0,
      phase: 'countdown',
      phaseTime: 0,
      lastSpokenSecond: -1,
      isJumping: false,
    };
    setDisplaySet(1);
    setDisplayRep(0);
    speak('Get ready.');
    startTimer();
  };

  const pauseWorkout = () => {
    if (!isRunning) return;

    if (isPaused) {
      // Resuming: restart the countdown for the current rep
      setIsPaused(false);
      speak('Resuming');

      const state = workoutState.current;
      state.phase = 'countdown';
      state.phaseTime = 0;
      state.lastSpokenSecond = -1;
      state.isJumping = true; // Use jump logic to prevent rep increment

      startTimer();
    } else {
      // Pausing
      setIsPaused(true);
      stopAllTimers();
      setStatusText('Paused');
      speak('Paused');
    }
  };

  const runNextSet = () => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);

    const state = workoutState.current;
    state.phase = 'countdown';
    state.phaseTime = 0;
    state.lastSpokenSecond = -1;
    state.isJumping = false;

    speak('Get ready.');
    startTimer();
  };

  const jumpToRep = (rep) => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);

    const state = workoutState.current;
    state.rep = rep;
    state.phase = 'countdown';
    state.phaseTime = 0;
    state.lastSpokenSecond = -1;
    state.isJumping = true;

    if (state.set < 1) {
      state.set = 1;
      setDisplaySet(1);
    }

    setDisplayRep(rep);
    speak(`Jumping to rep ${rep}. Get ready.`);
    startTimer();
  };

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  return {
    currentRep: displayRep,
    currentSet: displaySet,
    isRunning,
    isPaused,
    isResting: phase === 'Rest',
    phase,
    statusText,
    progress,
    startWorkout,
    pauseWorkout,
    stopWorkout,
    runNextSet,
    jumpToRep,
    endSet,
    isExerciseComplete,
    setStatusText,
  };
};