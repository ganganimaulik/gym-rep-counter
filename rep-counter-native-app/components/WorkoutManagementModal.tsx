import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { styled } from 'nativewind';
import { Workout, Exercise } from '../types';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

interface WorkoutManagementModalProps {
  isVisible: boolean;
  onClose: () => void;
  workouts: Workout[];
  addWorkout: (name: string) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (workoutId: string, exercise: Omit<Exercise, 'id'>) => void;
  deleteExercise: (workoutId: string, exerciseId: string) => void;
}

const WorkoutManagementModal = ({ isVisible, onClose, workouts, addWorkout, deleteWorkout, addExercise, deleteExercise }: WorkoutManagementModalProps) => {
  const [newWorkoutName, setNewWorkoutName] = useState('');

  const handleAddWorkout = () => {
    if (newWorkoutName.trim()) {
      addWorkout(newWorkoutName.trim());
      setNewWorkoutName('');
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <StyledView className="flex-1 justify-center items-center bg-black/50">
        <StyledView className="w-11/12 max-h-[80vh] bg-gray-800 rounded-2xl p-6">
          <StyledView className="flex-row justify-between items-center pb-4 mb-4 border-b border-gray-700">
            <StyledText className="text-2xl font-bold text-white">
              Manage Workouts
            </StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <StyledText className="text-gray-400 text-2xl font-bold">×</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
          <StyledScrollView>
            {/* Add New Workout Form */}
            <StyledView className="mb-6 bg-gray-700 rounded-lg p-4">
              <StyledText className="text-lg font-semibold mb-3 text-white">
                Add New Workout
              </StyledText>
              <StyledTextInput
                className="w-full bg-gray-600 border border-gray-500 rounded-md p-2 text-white"
                placeholder="Workout name (e.g., Push Day)"
                placeholderTextColor="#9CA3AF"
                value={newWorkoutName}
                onChangeText={setNewWorkoutName}
              />
              <StyledTouchableOpacity
                className="mt-3 w-full py-2 px-4 bg-green-600 rounded-lg"
                onPress={handleAddWorkout}
              >
                <StyledText className="text-white font-semibold text-center">Add Workout</StyledText>
              </StyledTouchableOpacity>
            </StyledView>

            {/* Existing Workouts List */}
            <StyledView className="space-y-4">
              {workouts.map(workout => (
                <WorkoutItem
                  key={workout.id}
                  workout={workout}
                  deleteWorkout={deleteWorkout}
                  addExercise={addExercise}
                  deleteExercise={deleteExercise}
                />
              ))}
            </StyledView>
          </StyledScrollView>
        </StyledView>
      </StyledView>
    </Modal>
  );
};

interface WorkoutItemProps {
  workout: Workout;
  deleteWorkout: (id: string) => void;
  addExercise: (workoutId: string, exercise: Omit<Exercise, 'id'>) => void;
  deleteExercise: (workoutId: string, exerciseId: string) => void;
}

const WorkoutItem = ({ workout, deleteWorkout, addExercise, deleteExercise }: WorkoutItemProps) => {
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('12');

  const handleAddExercise = () => {
    if (exerciseName.trim()) {
      addExercise(workout.id, {
        name: exerciseName.trim(),
        sets: parseInt(sets, 10) || 3,
        reps: parseInt(reps, 10) || 12,
      });
      setExerciseName('');
      setSets('3');
      setReps('12');
    }
  };

  return (
    <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-lg font-semibold text-white">{workout.name}</StyledText>
        <StyledTouchableOpacity onPress={() => deleteWorkout(workout.id)}>
          <StyledText className="text-red-400">Delete</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
      <StyledView className="space-y-2">
        {workout.exercises.map((ex, index) => (
          <StyledView key={ex.id} className="flex-row items-center justify-between bg-gray-600/50 p-2 rounded-md">
            <StyledText className="text-sm font-medium text-white">{index + 1}. {ex.name}</StyledText>
            <StyledView className="flex-row items-center space-x-3">
              <StyledText className="text-xs text-gray-400 font-mono">{ex.sets}×{ex.reps}</StyledText>
              <StyledTouchableOpacity onPress={() => deleteExercise(workout.id, ex.id)}>
                <StyledText className="text-red-400 font-bold">X</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        ))}
      </StyledView>
      <StyledView className="pt-2">
        <StyledView className="flex-row gap-2">
          <StyledTextInput
            placeholder="New Exercise"
            placeholderTextColor="#9CA3AF"
            value={exerciseName}
            onChangeText={setExerciseName}
            className="flex-1 bg-gray-600 rounded p-2 text-white"
          />
          <StyledTextInput
            placeholder="Sets"
            placeholderTextColor="#9CA3AF"
            value={sets}
            onChangeText={setSets}
            keyboardType="numeric"
            className="w-16 bg-gray-600 rounded p-2 text-white text-center"
          />
          <StyledTextInput
            placeholder="Reps"
            placeholderTextColor="#9CA3AF"
            value={reps}
            onChangeText={setReps}
            keyboardType="numeric"
            className="w-16 bg-gray-600 rounded p-2 text-white text-center"
          />
        </StyledView>
        <StyledTouchableOpacity
          className="mt-2 bg-green-600 rounded p-2"
          onPress={handleAddExercise}
        >
          <StyledText className="text-white font-semibold text-center">Add Exercise</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
};

export default WorkoutManagementModal;