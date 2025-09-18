import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import MainButtons from './components/MainButtons';
import NumberButtons from './components/NumberButtons';
import Settings from './components/Settings';
import * as KeepAwake from 'expo-keep-awake';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SETTINGS_KEY = 'repCounterSettings';

export default function App() {
  // State
  const [currentRep, setCurrentRep] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [statusText, setStatusText] = useState('Press Start');
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [settings, setSettings] = useState({
    countdownSeconds: 3,
    maxReps: 12,
    maxSets: 4,
    restSeconds: 60,
    concentricSeconds: 1,
    eccentricSeconds: 3,
    eccentricCountdownEnabled: true,
  });

  // Timers
  const intervalRef = useRef(null);
  const phaseTimeoutRef = useRef(null);

  // --- Audio ---
  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
        shouldDuckAndroid: false,
        interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to set audio mode', error);
    }
  };

  const speak = (text) => {
    Speech.stop();
    Speech.speak(text, { rate: 1.1 });
  };

  // --- Core Functions ---

  const stopAllTimers = () => {
    clearInterval(intervalRef.current);
    clearTimeout(phaseTimeoutRef.current);
    intervalRef.current = null;
    phaseTimeoutRef.current = null;
    Speech.stop();
  };

  const startWorkout = (startRep = 0) => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentSet(1);
    setCurrentRep(startRep);
    KeepAwake.activateKeepAwakeAsync();
    startCountdown(() => {
      if (startRep > 0) {
        startRepCycle(startRep);
      } else {
        startRepCycle(1);
      }
    });
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
    setProgress(0);
    KeepAwake.deactivateKeepAwake();
  };

  const pauseWorkout = () => {
    if (!isRunning) return;

    if (isPaused) { // Resuming
      setIsPaused(false);
      KeepAwake.activateKeepAwakeAsync();
      startCountdown(() => startRepCycle(currentRep));
    } else { // Pausing
      setIsPaused(true);
      stopAllTimers();
      setStatusText('Paused');
      speak('Paused');
      KeepAwake.deactivateKeepAwake();
    }
  };

  const endSet = () => {
      if (!isRunning) return;
      stopAllTimers();
      if (currentSet < settings.maxSets) {
          setIsResting(true);
          startRestTimer();
      } else {
          stopWorkout();
          setStatusText("Workout Complete!");
          speak("Workout complete. Well done!");
      }
  };

  const startCountdown = (callback) => {
    let count = settings.countdownSeconds;
    setStatusText(`Get Ready... ${count}`);
    speak(`Get ready. ${count}`);
    intervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setStatusText(`Get Ready... ${count}`);
        speak(count);
      } else if (count === 0) {
        setStatusText('Go!');
        speak("Go!");
      } else {
        stopAllTimers();
        setStatusText('In Progress');
        callback();
      }
    }, 1000);
  };

  const startRepCycle = (rep) => {
    if (rep > settings.maxReps) {
      endSet();
      return;
    }
    setCurrentRep(rep);
    speak(rep);

    // Concentric
    setPhase('Concentric');
    runPhaseTimer(settings.concentricSeconds, () => {
      // Eccentric
      setPhase('Eccentric');
      let lastSpokenSecond = -1;
      runPhaseTimer(settings.eccentricSeconds, () => {
        startRepCycle(rep + 1);
      }, (currentTime) => { // onUpdate callback
          if (settings.eccentricCountdownEnabled) {
              const currentIntegerSecond = Math.floor(currentTime);
              if (currentIntegerSecond > lastSpokenSecond && currentTime < settings.eccentricSeconds) {
                  const numberToSpeak = Math.ceil(settings.eccentricSeconds - currentTime);
                  if (numberToSpeak > 0) {
                      speak(numberToSpeak);
                  }
                  lastSpokenSecond = currentIntegerSecond;
              }
          }
      });
    });
  };

  const runPhaseTimer = (duration, callback, onUpdate) => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setProgress((elapsed / duration) * 100);
      if (onUpdate) onUpdate(elapsed);
    }, 100);

    phaseTimeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setProgress(100);
      callback();
    }, duration * 1000);
  };

  const startRestTimer = () => {
      let restCount = settings.restSeconds;
      setStatusText(`Rest: ${restCount}s`);
      speak(`Set ${currentSet} complete. Rest for ${restCount} seconds.`);

      intervalRef.current = setInterval(() => {
          restCount--;
          setStatusText(`Rest: ${restCount}s`);
          if (restCount <= 3 && restCount > 0) {
            speak(restCount)
          }
          if (restCount <= 0) {
              stopAllTimers();
              setIsResting(false);
              setCurrentSet(prev => prev + 1);
              setCurrentRep(0);
              speak(`Rest complete. Press start for set ${currentSet + 1}.`);
              startCountdown(() => startRepCycle(1));
          }
      }, 1000);
  };

  const jumpToRep = (repNumber) => {
    stopAllTimers();
    setIsRunning(true);
    setIsPaused(false);
    setIsResting(false);
    KeepAwake.activateKeepAwakeAsync();
    startCountdown(() => startRepCycle(repNumber));
  };

  // --- Effects ---
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings !== null) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Failed to load settings.', error);
      }
    };

    loadSettings();
    configureAudio();

    return () => {
      stopAllTimers();
      KeepAwake.deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
      LayoutAnimation.easeInEaseOut();
  }, [isRunning, isPaused, isResting, phase]);


  // --- Event Handlers ---
  const handleSaveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings.', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.innerContainer}>
        <View style={styles.mainDisplay}>
          <Text style={styles.statusText}>{statusText}</Text>
          <View style={styles.repSetContainer}>
            <View style={styles.repContainer}>
              <Text style={styles.repDisplayText}>{currentRep}</Text>
              <Text style={styles.labelText}>REP</Text>
            </View>
            <View style={styles.setContainer}>
              <Text style={styles.setDisplayText}>{currentSet}</Text>
              <Text style={styles.labelText}>SET</Text>
            </View>
          </View>
          <Text style={styles.phaseDisplay}>{phase || ' '}</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        <MainButtons
          isRunning={isRunning}
          isPaused={isPaused}
          isResting={isResting}
          onStart={() => startWorkout(0)}
          onPause={pauseWorkout}
          onStop={stopWorkout}
          onEndSet={endSet}
        />

        <NumberButtons
          maxReps={settings.maxReps}
          onJumpToRep={jumpToRep}
          currentRep={currentRep}
        />

        <Settings settings={settings} onSave={handleSaveSettings} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // bg-gray-900
  },
  innerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-around',
  },
  mainDisplay: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#60a5fa', // text-blue-400
    marginBottom: 8,
    minHeight: 30,
  },
  repSetContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 24,
  },
  repContainer: {
    alignItems: 'center',
  },
  setContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  repDisplayText: {
    fontSize: 100,
    fontWeight: 'bold',
    color: 'white',
    lineHeight: 100,
  },
  setDisplayText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: 'white',
    lineHeight: 72,
  },
  labelText: {
    fontSize: 18,
    color: '#9ca3af', // text-gray-400
  },
  phaseDisplay: {
    fontSize: 20,
    color: '#9ca3af', // text-gray-400
    marginTop: 8,
    minHeight: 24,
    textTransform: 'capitalize',
  },
  progressBarContainer: {
    height: 16,
    backgroundColor: '#374151', // bg-gray-700
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBar: {
    height: 16,
    backgroundColor: '#3b82f6', // bg-blue-500
    borderRadius: 8,
  },
});
