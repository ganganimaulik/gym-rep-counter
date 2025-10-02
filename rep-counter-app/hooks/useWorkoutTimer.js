import { useState, useRef } from 'react';
import * as Speech from 'expo-speech';
import {
  bgSetTimeout,
  bgSetInterval,
  bgClearTimeout,
  bgClearInterval,
} from 'expo-background-timer';

export const useWorkoutTimer = (
  settings,
  onSetComplete,
  { speak, speakEccentric, playBeep }
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

  const stopAllTimers = () => {
    if (intervalRef.current) {
      bgClearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      bgClearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    if (restRef.current) {
      bgClearInterval(restRef.current);
      restRef.current = null;
    }
  };

  const startWorkout = () => {
    if (isRunning) return;
    setIsResting(false);
    stopAllTimers();
    setCurrentRep(0);
    setCurrentSet(1);
    setIsRunning(true);
    setIsPaused(false);
    startCountdown(startRepCycle);
  };

  const pauseWorkout = () => {
    if (!isRunning) return;
    if (isPaused) {
      setIsPaused(false);
      if (currentRep > 0) setCurrentRep(prev => prev - 1);
      startCountdown(startRepCycle);
      setStatusText('In Progress');
      speak('Resuming');
    } else {
      setIsPaused(true);
      stopAllTimers();
      setStatusText('Paused');
      speak('Paused');
    }
  };

  const stopWorkout = () => {
    stopAllTimers();
    setIsRunning(false);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(0);
    setCurrentSet(1);
    setStatusText('Press Start');
    setPhase('');
    Speech.stop();
  };

  const endSet = () => {
    if (!isRunning) return;
    stopAllTimers();
    setIsRunning(false);

    const nextSet = currentSet + 1;

    if (nextSet > settings.maxSets) {
      speak('Exercise complete!');
      onSetComplete(true); // true indicates workout is complete
      stopWorkout();
      setStatusText('Workout Complete!');
    } else {
      setCurrentSet(nextSet);
      setCurrentRep(0);
      startRestTimer(nextSet);
    }
  };

  const startRestTimer = nextSet => {
    setIsResting(true);
    let restCount = settings.restSeconds;
    setStatusText(`Rest: ${restCount}s`);
    speak(`Set complete. Rest for ${restCount} seconds.`);

    restRef.current = bgSetInterval(() => {
      restCount--;
      setStatusText(`Rest: ${restCount}s`);
      if (restCount <= 3 && restCount > 0) playBeep();
      if (restCount <= 0) {
        if(restRef.current) bgClearInterval(restRef.current);
        setStatusText(`Press Start for Set ${nextSet}`);
        speak(`Rest complete. Press start for set ${nextSet}.`);
        playBeep(880);
      }
    }, 1000);
  };

  const runNextSet = () => {
    stopAllTimers();
    setIsResting(false);
    setIsRunning(true);
    setIsPaused(false);
    startCountdown(startRepCycle);
  };

  const startCountdown = callback => {
    stopAllTimers();
    let count = settings.countdownSeconds;
    setStatusText('Get Ready...');

    const countdownRecursion = c => {
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
  };

  const startRepCycle = () => {
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
                settings.eccentricSeconds - eccentricPhaseTime
              );
              if (numberToSpeak > 0) {
                Speech.stop();
                speakEccentric(String(numberToSpeak));
              }
              lastSpokenSecond = currentIntegerSecond;
            }

            if (eccentricPhaseTime >= settings.eccentricSeconds) {
                bgClearInterval(eccentricInterval);
                startRepCycle();
            }
          }, 100);
          intervalRef.current = eccentricInterval;
        }
      }, 100);
      intervalRef.current = concentricInterval;
      return nextRep;
    });
  };

  const jumpToRep = rep => {
    stopAllTimers();
    Speech.stop();
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentRep(rep - 1);
    if (currentSet < 1) setCurrentSet(1);
    startCountdown(startRepCycle);
  };

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
    runNextSet,
    jumpToRep,
    endSet,
    setCurrentSet,
    setCurrentRep,
    stopAllTimers,
    setStatusText,
  };
};