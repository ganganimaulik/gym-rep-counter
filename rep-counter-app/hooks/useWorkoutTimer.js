import { useState, useRef, useEffect, useCallback } from 'react';
import {
  bgSetTimeout,
  bgSetInterval,
  bgClearTimeout,
  bgClearInterval,
} from 'expo-background-timer';

export const useWorkoutTimer = (
  settings,
  { playBeep, speak, speakEccentric, stopSpeech },
  onSetComplete,
) => {
  const [currentRep, setCurrentRep] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [phase, setPhase] = useState('');
  const [statusText, setStatusText] = useState('Press Start');

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const restRef = useRef(null);

  const onSetCompleteRef = useRef(onSetComplete);
  useEffect(() => {
    onSetCompleteRef.current = onSetComplete;
  }, [onSetComplete]);

  const stopAllTimers = useCallback(() => {
    if (intervalRef.current) bgClearInterval(intervalRef.current);
    if (countdownRef.current) bgClearTimeout(countdownRef.current);
    if (restRef.current) bgClearInterval(restRef.current);
    intervalRef.current = null;
    countdownRef.current = null;
    restRef.current = null;
    stopSpeech();
  }, [stopSpeech]);

  useEffect(() => {
    return () => stopAllTimers();
  }, [stopAllTimers]);

  const endSet = useCallback(() => {
    stopAllTimers();
    setIsRunning(false);
    setCurrentSet(prevSet => {
      const nextSet = prevSet + 1;
      if (nextSet > settings.maxSets) {
        speak('Exercise complete!');
        if (onSetCompleteRef.current) {
          onSetCompleteRef.current(true); // isWorkoutComplete
        }
        return prevSet;
      } else {
        setCurrentRep(0);
        setIsResting(true);
        let restCount = settings.restSeconds;
        setStatusText(`Rest: ${restCount}s`);
        speak(`Set complete. Rest for ${restCount} seconds.`);
        restRef.current = bgSetInterval(() => {
          restCount--;
          setStatusText(`Rest: ${restCount}s`);
          if (restCount <= 3 && restCount > 0) playBeep();
          if (restCount <= 0) {
            if (restRef.current) bgClearInterval(restRef.current);
            setStatusText(`Press Start for Set ${nextSet}`);
            speak(`Rest complete. Press start for set ${nextSet}.`);
            playBeep(880);
          }
        }, 1000);
        if (onSetCompleteRef.current) {
          onSetCompleteRef.current(false); // set complete, not workout
        }
        return nextSet;
      }
    });
  }, [stopAllTimers, settings.maxSets, settings.restSeconds, speak, playBeep]);

  const startRepCycle = useCallback(() => {
    setCurrentRep(prevRep => {
      const nextRep = prevRep + 1;
      if (nextRep > settings.maxReps) {
        endSet();
        return prevRep;
      }

      speak(String(nextRep));
      setPhase('Concentric');
      let phaseTime = 0;

      const concentricInterval = bgSetInterval(() => {
        phaseTime += 0.1;
        if (phaseTime >= settings.concentricSeconds) {
          bgClearInterval(concentricInterval);
          setPhase('Eccentric');
          let eccentricPhaseTime = 0;
          let lastSpokenSecond = -1;

          const eccentricInterval = bgSetInterval(() => {
            eccentricPhaseTime += 0.1;
            const currentIntegerSecond = Math.floor(eccentricPhaseTime);

            if (
              settings.eccentricCountdownEnabled &&
              currentIntegerSecond > lastSpokenSecond &&
              eccentricPhaseTime < settings.eccentricSeconds
            ) {
              const numberToSpeak = Math.ceil(
                settings.eccentricSeconds - eccentricPhaseTime,
              );
              if (numberToSpeak > 0) {
                speakEccentric(String(numberToSpeak));
              }
              lastSpokenSecond = currentIntegerSecond;
            }

            if (eccentricPhaseTime >= settings.eccentricSeconds) {
              bgClearInterval(eccentricInterval);
              startRepCycle(); // Simple recursive call
            }
          }, 100);
          intervalRef.current = eccentricInterval;
        }
      }, 100);
      intervalRef.current = concentricInterval;
      return nextRep;
    });
  }, [settings, speak, speakEccentric, endSet]);

  const startCountdown = useCallback((callback) => {
      stopAllTimers();
      let count = settings.countdownSeconds;
      setStatusText('Get Ready...');

      const countdownRecursion = (c) => {
        if (c > 0) {
          setStatusText(`Get Ready... ${c}`);
          speak(String(c), {
            onDone: () => {
              countdownRef.current = bgSetTimeout(() => countdownRecursion(c - 1), 700);
            },
          });
        } else {
          setStatusText('Go!');
          speak('Go!', {
            onDone: () => {
              playBeep(880);
              setStatusText('In Progress');
              callback();
            },
          });
        }
      };

      speak('Get ready.', {
        onDone: () => {
          countdownRef.current = bgSetTimeout(() => countdownRecursion(count), 300);
        },
      });
    }, [settings.countdownSeconds, stopAllTimers, speak, playBeep]);

  const startWorkout = useCallback(() => {
    if (isRunning) return;
    setIsResting(false);
    stopAllTimers();
    setCurrentRep(0);
    setCurrentSet(1);
    setIsRunning(true);
    setIsPaused(false);
    startCountdown(startRepCycle);
  }, [isRunning, stopAllTimers, startCountdown, startRepCycle]);

  const pauseWorkout = useCallback(() => {
    if (!isRunning) return;
    if (isPaused) {
      setIsPaused(false);
      setStatusText('In Progress');
      speak('Resuming');
      startCountdown(() => {
        setCurrentRep(prev => (prev > 0 ? prev - 1 : 0));
        startRepCycle();
      });
    } else {
      setIsPaused(true);
      stopAllTimers();
      setStatusText('Paused');
      speak('Paused');
    }
  }, [isRunning, isPaused, stopAllTimers, startCountdown, startRepCycle, speak]);

  const stopWorkout = useCallback(() => {
    stopAllTimers();
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(0);
    setCurrentSet(1);
    setStatusText('Press Start');
    setPhase('');
  }, [stopAllTimers]);

  const runNextSet = useCallback(() => {
    stopAllTimers();
    setIsResting(false);
    setIsRunning(true);
    setIsPaused(false);
    startCountdown(startRepCycle);
  }, [stopAllTimers, startCountdown, startRepCycle]);

  const jumpToRep = useCallback((rep) => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(rep - 1);
    setCurrentSet(prev => (prev < 1 ? 1 : prev));
    startCountdown(startRepCycle);
  }, [stopAllTimers, startCountdown, startRepCycle]);

  useEffect(() => {
    stopWorkout();
  }, [settings, stopWorkout]);

  return {
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
    endSet,
    runNextSet,
    jumpToRep,
  };
};