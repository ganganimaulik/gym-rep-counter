import { useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

export const useWorkoutTimer = ({ settings, onStateChange, onExerciseComplete }) => {
  const [state, setState] = useState({
    rep: 0,
    set: 1,
    phase: '', // 'concentric', 'eccentric', 'rest', 'countdown'
    status: 'Press Start',
    isRunning: false,
    isPaused: false,
    isResting: false,
    progress: 0,
  });

  const intervalRef = useRef(null);
  const soundRef = useRef(null);

  // Destructure for easier access
  const {
    countdownSeconds,
    maxReps,
    maxSets,
    restSeconds,
    concentricSeconds,
    eccentricSeconds,
    eccentricCountdownEnabled,
    volume,
  } = settings;

  // Effect to broadcast state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const _playSound = async (type) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        type === 'start' ? require('../assets/start.mp3') : require('../assets/beep.mp3'),
        { shouldPlay: true, volume }
      );
      soundRef.current = sound;
    } catch (error) {
      // console.error("Couldn't play sound", error);
      // Asset files don't exist yet, so this will fail. We'll add them later.
    }
  };

  const _speak = (text, rate = 1.2) => {
    Speech.speak(text, {
      rate,
      volume,
    });
  };

  const stopAll = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    Speech.stop();
    setState(prev => ({
      ...prev,
      rep: 0,
      set: 1,
      phase: '',
      status: 'Press Start',
      isRunning: false,
      isPaused: false,
      isResting: false,
      progress: 0,
    }));
  };

  const startWorkout = (startRep = 0) => {
    stopAll();
    setState(prev => ({ ...prev, isPaused: false }));
    _startCountdown(() => {
      _startRepCycle(startRep);
    });
  };

  const pauseWorkout = () => {
    if (!state.isRunning) return;

    if (state.isPaused) { // Resuming
      setState(prev => ({ ...prev, isPaused: false, status: 'Resuming...' }));
      _startCountdown(() => {
        _startRepCycle(state.rep); // Resume from the current rep
      });
    } else { // Pausing
      if (intervalRef.current) clearInterval(intervalRef.current);
      Speech.stop();
      setState(prev => ({ ...prev, isPaused: true, status: 'Paused' }));
      _speak('Paused');
    }
  };

  const _startCountdown = (callback) => {
    let count = countdownSeconds;
    setState(prev => ({ ...prev, phase: 'countdown', status: `Get Ready... ${count}`, rep: 0, set: 1 }));
    _speak(`Get ready. ${count}`);

    intervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setState(prev => ({ ...prev, status: `Get Ready... ${count}` }));
        _speak(count);
      } else {
        clearInterval(intervalRef.current);
        _speak('Go!');
        _playSound('start');
        setState(prev => ({ ...prev, isRunning: true, status: 'In Progress' }));
        callback();
      }
    }, 1000);
  };

  const _startRepCycle = (startRep = 0) => {
    let currentRep = startRep;

    const nextRep = () => {
        currentRep++;
        if (currentRep > maxReps) {
            _startRestTimer();
            return;
        }

        setState(prev => ({ ...prev, rep: currentRep }));
        _speak(currentRep);

        // Concentric
        let phaseTime = 0;
        setState(prev => ({ ...prev, phase: 'Concentric' }));
        intervalRef.current = setInterval(() => {
            phaseTime += 0.1;
            setState(prev => ({ ...prev, progress: (phaseTime / concentricSeconds) * 100 }));

            if (phaseTime >= concentricSeconds) {
                clearInterval(intervalRef.current);

                // Eccentric
                phaseTime = 0;
                setState(prev => ({ ...prev, phase: 'Eccentric' }));
                let lastSpokenSecond = -1;

                intervalRef.current = setInterval(() => {
                    phaseTime += 0.1;
                    setState(prev => ({ ...prev, progress: (phaseTime / eccentricSeconds) * 100 }));

                    const currentIntegerSecond = Math.floor(phaseTime);
                    if (eccentricCountdownEnabled && currentIntegerSecond > lastSpokenSecond && phaseTime < eccentricSeconds) {
                        const numToSpeak = Math.ceil(eccentricSeconds - phaseTime);
                        if (numToSpeak > 0) {
                            _speak(numToSpeak, 1.5);
                        }
                        lastSpokenSecond = currentIntegerSecond;
                    }

                    if (phaseTime >= eccentricSeconds) {
                        clearInterval(intervalRef.current);
                        nextRep(); // Start next rep
                    }
                }, 100);
            }
        }, 100);
    };

    nextRep();
  };

  const _startRestTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const nextSet = state.set + 1;
    if (nextSet > maxSets) {
      _speak('Exercise complete!');
      stopAll();
      setState(prev => ({...prev, status: 'Exercise Complete!'}));
      if (onExerciseComplete) {
        onExerciseComplete();
      }
      return;
    }

    _speak(`Set ${state.set} complete. Rest for ${restSeconds} seconds.`);
    let restCount = restSeconds;
    setState(prev => ({
      ...prev,
      isResting: true,
      isRunning: false,
      phase: 'rest',
      status: `Rest: ${restCount}s`,
    }));

    intervalRef.current = setInterval(() => {
      restCount--;
      setState(prev => ({ ...prev, status: `Rest: ${restCount}s` }));

      if (restCount <= 3 && restCount > 0) _playSound('beep');

      if (restCount <= 0) {
        clearInterval(intervalRef.current);
        _speak(`Rest complete. Get ready for set ${nextSet}.`);
        setState(prev => ({ ...prev, isResting: false, set: nextSet }));
        startWorkout(0); // Start the next set
      }
    }, 1000);
  };

  const endSet = () => {
      if(!state.isRunning) return;
      _startRestTimer();
  }

  return {
    workoutState: state,
    startWorkout,
    pauseWorkout,
    stopWorkout: stopAll,
    endSet,
  };
};