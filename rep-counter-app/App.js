import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  AppState,
  Image,
} from 'react-native';
import { styled } from 'nativewind';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Edit,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { WEB_CLIENT_ID, IOS_CLIENT_ID } from '@env';
import { auth, db } from './utils/firebase';

import NumberButton from './components/NumberButton';
import SettingsPanel from './components/SettingsPanel';
import WorkoutManagementModal from './components/WorkoutManagementModal';
import WorkoutPicker from './components/WorkoutPicker';
import { getDefaultWorkouts } from './utils/defaultWorkouts';
import { IOS } from 'nativewind/dist/utils/selector';

const StyledSafeAreaView = styled(SafeAreaView);
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

const App = () => {
  useKeepAwake();

  // State
  const [currentRep, setCurrentRep] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [phase, setPhase] = useState('');
  const [statusText, setStatusText] = useState('Press Start');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const [settings, setSettings] = useState({
    countdownSeconds: 5,
    restSeconds: 60,
    maxReps: 15,
    maxSets: 3,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
    volume: 1.0,
  });

  const [workouts, setWorkouts] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [femaleVoice, setFemaleVoice] = useState(null);

  // Refs
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const restRef = useRef(null);
  const soundRef = useRef();
  const appState = useRef(AppState.currentState);

  const findFemaleVoice = async () => {
    const voices = await Speech.getAvailableVoicesAsync();
    const foundVoice = voices.find(
      v =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Serena'),
    );
    if (foundVoice) {
      setFemaleVoice(foundVoice.identifier);
    }
  };

  // --- Effects ---
  useEffect(() => {
    const initializeApp = async () => {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID,
      });

      const subscriber = onAuthStateChanged(auth, onAuthStateChange);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 2, // MixWithOthers
        shouldDuckAndroid: true,
        interruptionModeAndroid: 2, // DuckOthers
        playThroughEarpieceAndroid: false,
      });
      await loadSettings();
      await loadWorkouts();
      await findFemaleVoice();

      return subscriber;
    };

    initializeApp();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      unloadSound();
    };
  }, []);

  useEffect(() => {
    if (currentWorkout && currentWorkout.exercises.length > 0) {
      const exercise = currentWorkout.exercises[currentExerciseIndex];
      setSettings(prev => ({
        ...prev,
        maxReps: exercise.reps,
        maxSets: exercise.sets,
      }));
    }
  }, [currentWorkout, currentExerciseIndex]);

  // --- Authentication ---
  const onAuthStateChange = async user => {
    setUser(user);
    if (user) {
      await syncUserData(user);
    } else {
      await loadSettings();
      await loadWorkouts();
    }
    if (initializing) {
      setInitializing(false);
    }
  };

  const onGoogleButtonPress = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      return signInWithCredential(auth, googleCredential);
    } catch (error) {
      console.error(error);
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
      await auth.signOut();
    } catch (error) {
      console.error(error);
    }
  };

  // --- Data Persistence & Sync ---
  const syncUserData = async firebaseUser => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.settings) {
        setSettings(userData.settings);
        await AsyncStorage.setItem(
          'repCounterSettings',
          JSON.stringify(userData.settings),
        );
      }
      if (userData.workouts) {
        setWorkouts(userData.workouts);
        await AsyncStorage.setItem(
          'workouts',
          JSON.stringify(userData.workouts),
        );
      }
    } else {
      await setDoc(userDocRef, {
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        settings: settings,
        workouts: workouts,
      });
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (e) {
      console.error('Failed to load settings.', e);
    }
  };

  const saveSettings = async newSettings => {
    try {
      await AsyncStorage.setItem(
        'repCounterSettings',
        JSON.stringify(newSettings),
      );
      setSettings(newSettings);
      setSettingsVisible(false);

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to save settings.', e);
    }
  };

  const loadWorkouts = async () => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts');
      if (savedWorkouts) {
        setWorkouts(JSON.parse(savedWorkouts));
      } else {
        const defaultWorkouts = getDefaultWorkouts();
        setWorkouts(defaultWorkouts);
        await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts));
      }
    } catch (e) {
      console.error('Failed to load workouts.', e);
    }
  };

  const saveWorkouts = async newWorkouts => {
    setWorkouts(newWorkouts);
    await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { workouts: newWorkouts }, { merge: true });
    }
  };

  // --- Audio & Speech ---
  const playBeep = async (freq = 440) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/beep.mp3'),
        { shouldPlay: true, volume: settings.volume },
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
  };

  const speak = (text, options) => {
    Speech.speak(text, {
      volume: settings.volume,
      rate: 1.2,
      ...options,
    });
  };

  const speakEccentric = text => {
    Speech.speak(text, {
      volume: settings.volume,
      rate: 1.2,
      voice: femaleVoice,
    });
  };

  // --- Core Logic ---
  const stopAllTimers = () => {
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    clearInterval(restRef.current);
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
      if (
        currentWorkout &&
        currentExerciseIndex < currentWorkout.exercises.length - 1
      ) {
        nextExercise();
      } else {
        stopWorkout();
        setStatusText('Workout Complete!');
      }
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

    restRef.current = setInterval(() => {
      restCount--;
      setStatusText(`Rest: ${restCount}s`);
      if (restCount <= 3 && restCount > 0) playBeep();
      if (restCount <= 0) {
        clearInterval(restRef.current);
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
            countdownRef.current = setTimeout(
              () => countdownRecursion(c - 1),
              700,
            );
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
        countdownRef.current = setTimeout(() => countdownRecursion(count), 300);
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

      clearInterval(intervalRef.current);

      const concentricInterval = setInterval(() => {
        phaseTime += 0.1;

        if (phaseTime >= settings.concentricSeconds) {
          clearInterval(concentricInterval);

          setPhase('Eccentric');
          let eccentricPhaseTime = 0;
          let lastSpokenSecond = -1;

          const eccentricInterval = setInterval(() => {
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
                Speech.stop();
                speakEccentric(String(numberToSpeak));
              }
              lastSpokenSecond = currentIntegerSecond;
            }

            if (eccentricPhaseTime >= settings.eccentricSeconds) {
              clearInterval(eccentricInterval);
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

  const selectWorkout = workoutId => {
    const workout = workouts.find(w => w.id === workoutId);
    setCurrentWorkout(workout);
    setCurrentExerciseIndex(0);
    stopWorkout();
  };

  const nextExercise = () => {
    if (
      currentWorkout &&
      currentExerciseIndex < currentWorkout.exercises.length - 1
    ) {
      stopWorkout();
      setCurrentExerciseIndex(prev => prev + 1);
      speak(
        `Next exercise: ${currentWorkout.exercises[currentExerciseIndex + 1].name
        }`,
      );
    }
  };

  const prevExercise = () => {
    if (currentWorkout && currentExerciseIndex > 0) {
      stopWorkout();
      setCurrentExerciseIndex(prev => prev - 1);
      speak(
        `Previous exercise: ${currentWorkout.exercises[currentExerciseIndex - 1].name
        }`,
      );
    }
  };

  const renderNumberButtons = () => {
    let buttons = [];
    for (let i = 1; i <= settings.maxReps; i++) {
      buttons.push(
        <NumberButton
          key={i}
          number={i}
          onPress={() => jumpToRep(i)}
          isActive={currentRep === i}
        />,
      );
    }
    return buttons;
  };

  if (initializing) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
        <StyledText className="text-white text-xl">Loading...</StyledText>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StatusBar barStyle="light-content" />
      <StyledScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <StyledView className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
          {/* User Profile Section */}
          {user && (
            <StyledView className="flex-row items-center justify-between bg-gray-700 rounded-lg p-3">
              <StyledView className="flex-row items-center space-x-3">
                <Image
                  source={{ uri: user.photoURL }}
                  className="w-10 h-10 rounded-full"
                />
                <StyledView>
                  <StyledText className="text-white font-semibold">
                    {user.displayName}
                  </StyledText>
                  <StyledText className="text-gray-400 text-sm">
                    {user.email}
                  </StyledText>
                </StyledView>
              </StyledView>
              <StyledTouchableOpacity
                onPress={signOut}
                className="p-2 bg-red-600 rounded-lg"
              >
                <LogOut color="white" size={20} />
              </StyledTouchableOpacity>
            </StyledView>
          )}

          {/* Workout Selection */}
          <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
            <StyledView className="flex-row justify-between items-center mb-2">
              <StyledText className="text-lg font-semibold text-white">
                Current Workout
              </StyledText>
              <StyledTouchableOpacity
                onPress={() => setModalVisible(true)}
                className="flex-row items-center space-x-2 rounded-lg bg-gray-600 px-3 py-2"
              >
                <Edit color="#d1d5db" size={16} />
                <StyledText className="text-sm font-semibold text-white">
                  Manage
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
            <WorkoutPicker
              selectedValue={currentWorkout?.id}
              onValueChange={itemValue => selectWorkout(itemValue)}
              workouts={workouts}
            />
            {currentWorkout && (
              <StyledView>
                <StyledText className="text-sm text-gray-400">
                  Current Exercise:
                </StyledText>
                <StyledText className="text-lg font-medium text-white">
                  {currentWorkout.exercises[currentExerciseIndex]?.name}
                </StyledText>
                <StyledView className="flex-row justify-between items-center mt-1">
                  <StyledText className="text-sm text-gray-400">
                    Exercise {currentExerciseIndex + 1} of{' '}
                    {currentWorkout.exercises.length}
                  </StyledText>
                  <StyledText className="text-sm font-semibold text-gray-200">
                    Sets: {settings.maxSets}
                  </StyledText>
                </StyledView>
              </StyledView>
            )}
          </StyledView>

          {/* Main Display */}
          <StyledView className="items-center">
            <StyledText className="text-2xl font-medium text-blue-400 mb-2">
              {statusText}
            </StyledText>
            <StyledView className="flex-row justify-center items-end space-x-6">
              <StyledView>
                <StyledText className="text-8xl font-bold tracking-tight text-white">
                  {currentRep}
                </StyledText>
                <StyledText className="text-lg text-gray-400 text-center">
                  REP
                </StyledText>
              </StyledView>
              <StyledView className="pb-2">
                <StyledText className="text-6xl font-bold tracking-tight text-white">
                  {currentSet}
                </StyledText>
                <StyledText className="text-lg text-gray-400 text-center">
                  SET
                </StyledText>
              </StyledView>
            </StyledView>
            <StyledText className="text-xl text-gray-400 mt-2">
              {phase || ' '}
            </StyledText>
          </StyledView>

          {/* Main Controls */}
          <StyledView className="flex-row gap-4">
            {(() => {
              if (!isRunning) {
                return [
                  <StyledTouchableOpacity
                    key="start"
                    onPress={isResting ? runNextSet : startWorkout}
                    className="py-3 px-4 bg-green-600 rounded-lg flex-1 items-center"
                  >
                    <StyledText className="text-lg font-semibold text-white">
                      Start
                    </StyledText>
                  </StyledTouchableOpacity>,
                  <StyledTouchableOpacity
                    key="stop"
                    onPress={stopWorkout}
                    className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
                  >
                    <StyledText className="text-lg font-semibold text-white">
                      Stop
                    </StyledText>
                  </StyledTouchableOpacity>,
                ];
              }
              if (isPaused) {
                return [
                  <StyledTouchableOpacity
                    key="resume"
                    onPress={pauseWorkout}
                    className="py-3 px-4 bg-yellow-500 rounded-lg flex-1 items-center"
                  >
                    <StyledText className="text-lg font-semibold text-white">
                      Resume
                    </StyledText>
                  </StyledTouchableOpacity>,
                  <StyledTouchableOpacity
                    key="stop-paused"
                    onPress={stopWorkout}
                    className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
                  >
                    <StyledText className="text-lg font-semibold text-white">
                      Stop
                    </StyledText>
                  </StyledTouchableOpacity>,
                ];
              }
              // isRunning && !isPaused
              return [
                <StyledTouchableOpacity
                  key="pause"
                  onPress={pauseWorkout}
                  className="py-3 px-4 bg-yellow-500 rounded-lg flex-1 items-center"
                >
                  <StyledText className="text-lg font-semibold text-white">
                    Pause
                  </StyledText>
                </StyledTouchableOpacity>,
                <StyledTouchableOpacity
                  key="end-set"
                  onPress={endSet}
                  className="py-3 px-4 bg-blue-600 rounded-lg flex-1 items-center"
                >
                  <StyledText className="text-lg font-semibold text-white">
                    End Set
                  </StyledText>
                </StyledTouchableOpacity>,
                <StyledTouchableOpacity
                  key="stop-running"
                  onPress={stopWorkout}
                  className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
                >
                  <StyledText className="text-lg font-semibold text-white">
                    Stop
                  </StyledText>
                </StyledTouchableOpacity>,
              ];
            })()}
          </StyledView>

          {/* Exercise Navigation */}
          {currentWorkout && (
            <StyledView className="flex-row justify-between gap-4">
              <StyledTouchableOpacity
                onPress={prevExercise}
                disabled={currentExerciseIndex === 0}
                className="py-2 px-4 bg-gray-600 rounded-lg flex-1 items-center"
              >
                <ChevronLeft
                  color={currentExerciseIndex === 0 ? '#4b5563' : 'white'}
                />
              </StyledTouchableOpacity>
              <StyledTouchableOpacity
                onPress={nextExercise}
                disabled={
                  currentExerciseIndex >= currentWorkout.exercises.length - 1
                }
                className="py-2 px-4 bg-gray-600 rounded-lg flex-1 items-center"
              >
                <ChevronRight
                  color={
                    currentExerciseIndex >= currentWorkout.exercises.length - 1
                      ? '#4b5563'
                      : 'white'
                  }
                />
              </StyledTouchableOpacity>
            </StyledView>
          )}

          {/* Number Jump Buttons */}
          <StyledView>
            <StyledText className="text-sm font-medium text-gray-400 mb-2 text-center">
              Jump to Rep
            </StyledText>
            <StyledView className="flex-row flex-wrap justify-center gap-2">
              {renderNumberButtons()}
            </StyledView>
          </StyledView>

          {/* Settings */}
          <StyledView className="items-center">
            <StyledTouchableOpacity
              onPress={() => setSettingsVisible(!settingsVisible)}
              className="flex-row items-center space-x-2"
            >
              <SettingsIcon color="#60a5fa" size={16} />
              <StyledText className="text-blue-400">Settings</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
          <SettingsPanel
            visible={settingsVisible}
            settings={settings}
            onSave={saveSettings}
            onGoogleButtonPress={onGoogleButtonPress}
            user={user}
          />
        </StyledView>
      </StyledScrollView>

      <WorkoutManagementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        workouts={workouts}
        setWorkouts={saveWorkouts}
      />
    </StyledSafeAreaView>
  );
};

export default App;