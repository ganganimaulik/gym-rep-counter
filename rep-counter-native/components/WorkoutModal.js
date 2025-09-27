import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
} from 'react-native';
import { colors, typography, components, layout } from '../styles';

// This is a simplified representation of an exercise item in the list
const ExerciseItem = ({ item, ondelete }) => (
  <View style={styles.exerciseItem}>
    <Text style={styles.exerciseText}>{item.name} ({item.sets}x{item.reps})</Text>
    <TouchableOpacity onPress={ondelete}>
      <Text style={{ color: colors.danger }}>Delete</Text>
    </TouchableOpacity>
  </View>
);

// This is a simplified representation of a full workout item
const WorkoutItem = ({ workout, onAddExercise, onDeleteExercise, onDeleteWorkout }) => {
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');

  const handleAddExercise = () => {
    if (exerciseName && sets && reps) {
      onAddExercise(workout.id, { name: exerciseName, sets: Number(sets), reps: Number(reps) });
      setExerciseName('');
      setSets('');
      setReps('');
    }
  };

  return (
    <View style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <Text style={typography.h3}>{workout.name}</Text>
        <TouchableOpacity onPress={() => onDeleteWorkout(workout.id)}>
          <Text style={{ color: colors.danger }}>Delete Workout</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={workout.exercises}
        renderItem={({ item }) => <ExerciseItem item={item} ondelete={() => onDeleteExercise(workout.id, item.id)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyListText}>No exercises yet.</Text>}
      />
      <View style={styles.addExerciseContainer}>
        <TextInput
          style={components.input}
          placeholder="New Exercise Name"
          placeholderTextColor={colors.textSecondary}
          value={exerciseName}
          onChangeText={setExerciseName}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput style={[components.input, { flex: 1 }]} placeholder="Sets" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" value={sets} onChangeText={setSets} />
          <TextInput style={[components.input, { flex: 1 }]} placeholder="Reps" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" value={reps} onChangeText={setReps} />
        </View>
        <TouchableOpacity style={[components.button, { backgroundColor: colors.success, marginTop: 8 }]} onPress={handleAddExercise}>
          <Text style={components.buttonText}>Add Exercise</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


const WorkoutModal = ({
  visible,
  onClose,
  workouts,
  onAddWorkout,
  onDeleteWorkout,
  onAddExercise,
  onDeleteExercise,
}) => {
  const [newWorkoutName, setNewWorkoutName] = useState('');

  const handleAddWorkout = () => {
    if (newWorkoutName) {
      onAddWorkout(newWorkoutName);
      setNewWorkoutName('');
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={typography.h3}>Manage Workouts</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.text }}>&times;</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addWorkoutSection}>
            <TextInput
              style={components.input}
              placeholder="New workout name (e.g. Push Day)"
              placeholderTextColor={colors.textSecondary}
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
            />
            <TouchableOpacity
              style={[components.button, { backgroundColor: colors.success, marginTop: 8 }]}
              onPress={handleAddWorkout}
            >
              <Text style={components.buttonText}>Add Workout</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={workouts}
            renderItem={({ item }) => (
              <WorkoutItem
                workout={item}
                onAddExercise={onAddExercise}
                onDeleteExercise={onDeleteExercise}
                onDeleteWorkout={onDeleteWorkout}
              />
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyListText}>No workouts created yet. Add one above!</Text>}
            style={{ width: '100%' }}
          />

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  addWorkoutSection: {
    width: '100%',
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
  },
  workoutCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.input,
    borderRadius: 4,
    marginBottom: 8,
  },
  exerciseText: {
    ...typography.body,
  },
  addExerciseContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  emptyListText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  }
});

export default WorkoutModal;