import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { layout, colors, typography, components } from './styles';
import { useKeepAwake } from 'expo-keep-awake';
import SettingsPanel from './components/SettingsPanel';
import WorkoutModal from './components/WorkoutModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const getDefaultWorkouts = () => [
    {
      id: generateId(),
      name: "Day 1 (Lower)",
      exercises: [
        { id: generateId(), name: "Leg Press", sets: 4, reps: 10 },
        { id: generateId(), name: "RDL", sets: 4, reps: 10 },
      ],
    },
    {
      id: generateId(),
      name: "Day 2 (Upper)",
      exercises: [
        { id: generateId(), name: "Horizontal Press", sets: 4, reps: 10 },
        { id: generateId(), name: "Horizontal Row", sets: 4, reps: 12 },
      ],
    },
];

const App = () => {
  useKeepAwake();

  // UI State
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isWorkoutModalVisible, setIsWorkoutModalVisible] = useState(false);
  const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);

  // Data State
  const [workouts, setWorkouts] = useState([]);
  const [currentWorkoutId, setCurrentWorkoutId] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [settings, setSettings] = useState({
    countdownSeconds: 5,
    maxReps: 15,
    maxSets: 3,
    restSeconds: 60,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
    volume: 1.0,
  });

  const handleExerciseComplete = () => {
    const workout = workouts.find(w => w.id === currentWorkoutId);
    if (workout && currentExerciseIndex < workout.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      // Automatically start the next exercise's timer if desired
      // For now, we'll let the user do it manually
    } else {
      setIsWorkoutComplete(true);
    }
  };

  // Workout Timer Logic
  const [workoutState, setWorkoutState] = useState({});
  const { startWorkout, pauseWorkout, stopWorkout, endSet } = useWorkoutTimer({
      settings,
      onStateChange: setWorkoutState,
      onExerciseComplete: handleExerciseComplete,
  });

  const { rep, set, phase, status, isRunning, isPaused, progress } = workoutState;

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadWorkouts();
  }, []);

  // Update settings when exercise changes
  useEffect(() => {
    if (currentWorkoutId) {
      const workout = workouts.find(w => w.id === currentWorkoutId);
      if (workout && workout.exercises.length > 0) {
        const exercise = workout.exercises[currentExerciseIndex];
        setSettings(prev => ({
          ...prev,
          maxReps: exercise.reps,
          maxSets: exercise.sets,
        }));
        setIsWorkoutComplete(false); // Reset completion status
      }
    }
  }, [currentWorkoutId, currentExerciseIndex, workouts]);


  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (e) { console.error('Failed to load settings.', e); }
  };

  const handleSaveSettings = async () => {
    try {
      await AsyncStorage.setItem('repCounterSettings', JSON.stringify(settings));
      setIsSettingsVisible(false);
    } catch (e) { console.error('Failed to save settings.', e); }
  };

  const loadWorkouts = async () => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts');
      if (savedWorkouts && JSON.parse(savedWorkouts).length > 0) {
        setWorkouts(JSON.parse(savedWorkouts));
      } else {
        setWorkouts(getDefaultWorkouts());
      }
    } catch (e) { console.error('Failed to load workouts.', e); }
  };

  const saveWorkouts = async (newWorkouts) => {
    try {
      setWorkouts(newWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
    } catch (e) { console.error('Failed to save workouts.', e); }
  };

  const handleAddWorkout = (name) => {
    const newWorkout = { id: generateId(), name, exercises: [] };
    saveWorkouts([...workouts, newWorkout]);
  };

  const handleDeleteWorkout = (id) => {
    saveWorkouts(workouts.filter(w => w.id !== id));
  };

  const handleAddExercise = (workoutId, exercise) => {
    const newWorkouts = workouts.map(w => {
      if (w.id === workoutId) {
        return { ...w, exercises: [...w.exercises, { ...exercise, id: generateId() }] };
      }
      return w;
    });
    saveWorkouts(newWorkouts);
  };

  const handleDeleteExercise = (workoutId, exerciseId) => {
    const newWorkouts = workouts.map(w => {
      if (w.id === workoutId) {
        return { ...w, exercises: w.exercises.filter(e => e.id !== exerciseId) };
      }
      return w;
    });
    saveWorkouts(newWorkouts);
  };

  const navigateExercise = (direction) => {
      const workout = workouts.find(w => w.id === currentWorkoutId);
      if(!workout) return;

      const newIndex = currentExerciseIndex + direction;
      if(newIndex >= 0 && newIndex < workout.exercises.length) {
          setCurrentExerciseIndex(newIndex);
      }
  }

  const currentWorkout = workouts.find(w => w.id === currentWorkoutId);
  const currentExercise = currentWorkout?.exercises[currentExerciseIndex];

  return (
    <SafeAreaView style={layout.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Workout Selection */}
          <View style={styles.workoutSelectionContainer}>
            <View style={{flex: 1}}>
                <Picker
                    selectedValue={currentWorkoutId}
                    onValueChange={(itemValue) => {
                        stopWorkout();
                        setCurrentWorkoutId(itemValue);
                        setCurrentExerciseIndex(0);
                    }}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                    enabled={!isRunning}
                >
                    <Picker.Item label="Select a workout..." value={null} />
                    {workouts.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
                </Picker>
            </View>
            <TouchableOpacity onPress={() => setIsWorkoutModalVisible(true)} style={styles.manageButton} disabled={isRunning}>
              <Text style={components.buttonText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {currentExercise && (
            <View style={styles.exerciseInfo}>
              <Text style={typography.h3}>{currentExercise.name}</Text>
              <Text style={typography.label}>
                Exercise {currentExerciseIndex + 1} of {currentWorkout.exercises.length}
              </Text>
            </View>
          )}

          {isWorkoutComplete ? (
              <Text style={styles.statusText}>Workout Complete!</Text>
          ) : (
            <>
                <Text style={styles.statusText}>{status || 'Press Start'}</Text>

                <View style={styles.displayContainer}>
                    <View style={styles.displayBox}>
                    <Text style={styles.repDisplay}>{rep || 0}</Text>
                    <Text style={styles.displayLabel}>REP</Text>
                    </View>
                    <View style={styles.displayBox}>
                    <Text style={styles.setDisplay}>{set || 1}</Text>
                    <Text style={styles.displayLabel}>SET</Text>
                    </View>
                </View>

                <Text style={styles.phaseDisplay}>{phase || ' '}</Text>

                <View style={styles.progressBarContainer}>
                    <View style={[components.progressBar, { width: `${progress || 0}%` }]} />
                </View>
            </>
          )}


          {/* Controls */}
          <View style={styles.controlsContainer}>
            {!isRunning ? (
              <TouchableOpacity onPress={() => startWorkout()} style={[components.button, styles.startButton, {flex: 2}]} disabled={!currentWorkoutId || isWorkoutComplete}>
                <Text style={components.buttonText}>Start</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={pauseWorkout} style={[components.button, styles.pauseButton]}>
                  <Text style={components.buttonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={endSet} style={[components.button, styles.endSetButton]}>
                  <Text style={components.buttonText}>End Set</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={stopWorkout} style={[components.button, styles.stopButton]}>
              <Text style={components.buttonText}>Stop</Text>
            </TouchableOpacity>
          </View>

          {!isRunning && currentWorkoutId && (
            <View style={styles.navContainer}>
                <TouchableOpacity onPress={() => navigateExercise(-1)} disabled={currentExerciseIndex === 0}>
                    <Text style={[styles.navText, currentExerciseIndex === 0 && styles.navTextDisabled]}>&larr; Previous</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigateExercise(1)} disabled={!currentWorkout || currentExerciseIndex === currentWorkout.exercises.length - 1}>
                    <Text style={[styles.navText, (!currentWorkout || currentExerciseIndex === currentWorkout.exercises.length - 1) && styles.navTextDisabled]}>Next &rarr;</Text>
                </TouchableOpacity>
            </View>
          )}

          {/* Settings Toggle */}
          <TouchableOpacity
            style={styles.settingsToggle}
            onPress={() => setIsSettingsVisible(!isSettingsVisible)}
            disabled={isRunning}
          >
            <Text style={styles.settingsToggleText}>
              {isSettingsVisible ? 'Hide Settings' : 'Settings'}
            </Text>
          </TouchableOpacity>

          {/* Settings Panel */}
          <SettingsPanel
            visible={isSettingsVisible}
            settings={settings}
            onSettingChange={(key, val) => setSettings(prev => ({ ...prev, [key]: val }))}
            onSave={handleSaveSettings}
          />
        </View>
      </ScrollView>

      <WorkoutModal
        visible={isWorkoutModalVisible}
        onClose={() => setIsWorkoutModalVisible(false)}
        workouts={workouts}
        onAddWorkout={handleAddWorkout}
        onDeleteWorkout={handleDeleteWorkout}
        onAddExercise={handleAddExercise}
        onDeleteExercise={handleDeleteExercise}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
    card: {
        ...layout.card,
        alignItems: 'center',
        width: '100%',
    },
    workoutSelectionContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        backgroundColor: colors.card,
        borderRadius: 8,
    },
    picker: {
        color: colors.text,
    },
    pickerItem: {
        color: colors.text,
        backgroundColor: colors.surface, // For iOS
    },
    manageButton: {
        ...components.button,
        backgroundColor: colors.input,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    exerciseInfo: {
        alignItems: 'center',
        marginBottom: 16,
    },
    statusText: {
        ...typography.h3,
        color: colors.primary,
        marginBottom: 16,
        minHeight: 30,
    },
    displayContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    displayBox: {
        alignItems: 'center',
        marginHorizontal: 24,
    },
    repDisplay: { ...typography.h1 },
    setDisplay: { ...typography.h2 },
    displayLabel: { ...typography.label, fontSize: 18 },
    phaseDisplay: {
        ...typography.body,
        fontSize: 20,
        color: colors.textSecondary,
        marginBottom: 16,
        height: 24,
    },
    progressBarContainer: {
        width: '100%',
        height: 16,
        backgroundColor: colors.input,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 24,
    },
    controlsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 16,
    },
    startButton: { backgroundColor: colors.success, flex: 1 },
    pauseButton: { backgroundColor: colors.secondary, flex: 1 },
    endSetButton: { backgroundColor: colors.primary, flex: 1 },
    stopButton: { backgroundColor: colors.danger, flex: 1 },
    navContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 16,
        paddingHorizontal: 16,
    },
    navText: {
        color: colors.primary,
        fontSize: 16,
    },
    navTextDisabled: {
        color: colors.textSecondary,
    },
    settingsToggle: { marginTop: 24, padding: 8 },
    settingsToggleText: { color: colors.primary, fontSize: 16 },
});

export default App;