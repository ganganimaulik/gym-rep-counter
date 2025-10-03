import { useState, useRef, useEffect, useCallback } from 'react';
import * as Speech from 'expo-speech';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';

export const useWorkoutTimer = (
  settings,
  { speak, speakEccentric, playBeep }
) => {
  // --- State for UI Rendering (Reanimated) ---
  const displayRep = useSharedValue(0);
  const statusText = useSharedValue('Press Start');
  const progress = useSharedValue(0);
  const phase = useSharedValue(''); // e.g., Concentric, Eccentric, Rest

  // --- State for Component Logic (React) ---
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [displaySet, setDisplaySet] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- Refs for Internal Logic ---
  const timer = useSharedValue(0); // The main animated value
  const workoutState = useRef({
    set: 1,
    rep: 0,
    phase: 'stopped', // 'stopped', 'countdown', 'concentric', 'eccentric', 'rest'
    lastSpokenSecond: -1,
    isJumping: false,
  });
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const stopAllTimers = useCallback(() => {
    Speech.stop();
    cancelAnimation(timer);
    timer.value = 0;
    progress.value = 0;
  }, [timer, progress]);

  const startTimerAnimation = (duration, onComplete) => {
    timer.value = 0; // Reset timer
    progress.value = 0; // Reset progress
    timer.value = withTiming(
      1,
      { duration: duration * 1000 },
      (finished) => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      }
    );
  };

  const endSet = useCallback(() => {
    const state = workoutState.current;
    const { maxSets, restSeconds } = settingsRef.current;
    const nextSet = state.set + 1;

    stopAllTimers();
    setIsRunning(false);

    if (nextSet > maxSets) {
      stopWorkout();
      statusText.value = 'Exercise Complete!';
      setIsExerciseComplete(true);
    } else {
      state.phase = 'rest';
      state.set = nextSet;
      state.rep = 0;
      state.lastSpokenSecond = -1;

      setDisplaySet(nextSet);
      displayRep.value = 0;
      phase.value = 'Rest';
      statusText.value = `Rest: ${restSeconds}s`;

      speak(`Set complete. Rest for ${restSeconds} seconds.`);
      startTimerAnimation(restSeconds, () => {
        setIsRunning(false);
        statusText.value = `Press Start for Set ${state.set}`;
        speak(`Rest complete. Press start for set ${state.set}.`);
        playBeep(880);
      });
    }
  }, [
    stopAllTimers,
    stopWorkout,
    speak,
    playBeep,
    timer,
    progress,
    statusText,
    displayRep,
    phase,
  ]);

  const startRepCycle = useCallback(() => {
    const state = workoutState.current;
    const { concentricSeconds, eccentricSeconds, maxReps } = settingsRef.current;

    state.phase = 'concentric';
    phase.value = 'Concentric';
    if (!state.isJumping) {
      state.rep += 1;
    }
    state.isJumping = false;

    displayRep.value = state.rep;
    speak(String(state.rep));

    // Concentric phase
    startTimerAnimation(concentricSeconds, () => {
      // Eccentric phase
      state.phase = 'eccentric';
      phase.value = 'Eccentric';
      startTimerAnimation(eccentricSeconds, () => {
        // Check for end of set
        if (state.rep >= maxReps) {
          endSet();
        } else {
          // Start next rep
          startRepCycle();
        }
      });
    });
  }, [speak, endSet, timer, displayRep, phase]);

  const startCountdown = (startMessage, onComplete) => {
    const { countdownSeconds } = settingsRef.current;
    const state = workoutState.current;

    state.phase = 'countdown';
    phase.value = 'Get Ready';
    statusText.value = `Get Ready... ${countdownSeconds}`;

    speak(startMessage, {
      onDone: () => {
        startTimerAnimation(countdownSeconds, () => {
          playBeep(880);
          speak('Go!', {
            onDone: () => {
              statusText.value = 'In Progress';
              if (onComplete) {
                onComplete();
              }
            },
          });
        });
      },
    });
  };

  const startWorkout = () => {
    if (isRunning && !isPaused) return;

    if (statusText.value === 'Exercise Complete!') {
      stopWorkout();
    }

    setIsExerciseComplete(false);
    setIsRunning(true);
    setIsPaused(false);

    const state = workoutState.current;
    state.set = 1;
    state.rep = 0;
    state.isJumping = false;
    state.lastSpokenSecond = -1;
    setDisplaySet(1);
    displayRep.value = 0;

    startCountdown('Get ready.', startRepCycle);
  };

  const pauseWorkout = () => {
    if (!isRunning) return;

    if (isPaused) {
      // Resuming
      setIsPaused(false);
      const state = workoutState.current;
      state.isJumping = true; // Prevent rep increment
      startCountdown('Resuming', startRepCycle);
    } else {
      // Pausing
      setIsPaused(true);
      cancelAnimation(timer);
      Speech.stop();
      statusText.value = 'Paused';
      speak('Paused');
    }
  };

  const runNextSet = () => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);

    const state = workoutState.current;
    state.rep = 0;
    state.isJumping = false;
    state.lastSpokenSecond = -1;

    startCountdown('Get ready.', startRepCycle);
  };

  const jumpToRep = (rep) => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);

    const state = workoutState.current;
    state.rep = rep;
    state.isJumping = true;

    if (state.set < 1) {
      state.set = 1;
      setDisplaySet(1);
    }
    displayRep.value = rep;

    startCountdown(`Jumping to rep ${rep}. Get ready.`, startRepCycle);
  };

  const stopWorkout = useCallback(() => {
    stopAllTimers();
    setIsRunning(false);
    setIsPaused(false);
    phase.value = '';
    statusText.value = 'Press Start';
    progress.value = 0;
    displayRep.value = 0;
    setDisplaySet(1);
    workoutState.current = {
      set: 1,
      rep: 0,
      phase: 'stopped',
      lastSpokenSecond: -1,
      isJumping: false,
    };
  }, [stopAllTimers, phase, statusText, progress, displayRep]);

  const resetExerciseCompleteFlag = useCallback(() => {
    setIsExerciseComplete(false);
  }, []);

  // --- Animated Derived Values ---
  useDerivedValue(() => {
    const state = workoutState.current;
    const {
      countdownSeconds,
      concentricSeconds,
      eccentricSeconds,
      restSeconds,
      eccentricCountdownEnabled,
    } = settingsRef.current;
    const currentTime = timer.value;

    // Update progress based on current phase
    if (
      state.phase === 'concentric' ||
      state.phase === 'eccentric' ||
      state.phase === 'rest'
    ) {
      progress.value = currentTime;
    }

    // Update status text for relevant phases
    if (state.phase === 'rest') {
      const restRemaining = restSeconds * (1 - currentTime);
      statusText.value = `Rest: ${Math.ceil(restRemaining)}s`;
    } else if (state.phase === 'countdown') {
      const remaining = countdownSeconds * (1 - currentTime);
      const numToSpeak = Math.ceil(remaining);
      const currentSecond = Math.floor(countdownSeconds * currentTime);

      if (currentSecond > state.lastSpokenSecond) {
        state.lastSpokenSecond = currentSecond;
        if (numToSpeak > 0) {
          statusText.value = `Get Ready... ${numToSpeak}`;
          runOnJS(speak)(String(numToSpeak));
        }
      }
    }

    // Eccentric countdown speech
    if (state.phase === 'eccentric' && eccentricCountdownEnabled) {
      const remaining = eccentricSeconds * (1 - currentTime);
      const numToSpeak = Math.ceil(remaining);
      const currentSecond = Math.floor(eccentricSeconds * currentTime);
      if (currentSecond > state.lastSpokenSecond) {
        state.lastSpokenSecond = currentSecond;
        if (numToSpeak > 0) {
          runOnJS(Speech.stop)();
          runOnJS(speakEccentric)(String(numToSpeak));
        }
      }
    }
  }, [timer]);

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  return {
    currentRep: displayRep,
    currentSet: displaySet,
    isRunning,
    isPaused,
    isResting: phase.value === 'Rest',
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
    setStatusText: (text) => {
      statusText.value = text;
    },
    resetExerciseCompleteFlag,
  };
};