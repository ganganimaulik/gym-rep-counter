import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { styled } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Trash2, Plus } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

const WorkoutManagementModal = ({ visible, onClose, onSelectWorkout, workouts, setWorkouts }) => {
  const [newWorkoutName, setNewWorkoutName] = useState('');

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const addWorkout = async () => {
    if (newWorkoutName.trim()) {
      const newWorkout = {
        id: generateId(),
        name: newWorkoutName.trim(),
        exercises: [],
      };
      const updatedWorkouts = [...workouts, newWorkout];
      setWorkouts(updatedWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(updatedWorkouts));
      setNewWorkoutName('');
    }
  };

  const deleteWorkout = async (id) => {
    const updatedWorkouts = workouts.filter(w => w.id !== id);
    setWorkouts(updatedWorkouts);
    await AsyncStorage.setItem('workouts', JSON.stringify(updatedWorkouts));
  };

  const addExercise = async (workoutId, exerciseName, sets, reps) => {
    if (exerciseName.trim()) {
      const updatedWorkouts = workouts.map(w => {
        if (w.id === workoutId) {
          return {
            ...w,
            exercises: [...w.exercises, { id: generateId(), name: exerciseName.trim(), sets, reps }],
          };
        }
        return w;
      });
      setWorkouts(updatedWorkouts);
      await AsyncStorage.setItem('workouts', JSON.stringify(updatedWorkouts));
    }
  };

  const deleteExercise = async (workoutId, exerciseId) => {
    const updatedWorkouts = workouts.map(w => {
      if (w.id === workoutId) {
        return {
          ...w,
          exercises: w.exercises.filter(ex => ex.id !== exerciseId),
        };
      }
      return w;
    });
    setWorkouts(updatedWorkouts);
    await AsyncStorage.setItem('workouts', JSON.stringify(updatedWorkouts));
  };

  const WorkoutItem = ({ workout }) => {
    const [exerciseName, setExerciseName] = useState('');
    const [sets, setSets] = useState('3');
    const [reps, setReps] = useState('12');

    const handleAddExercise = () => {
      addExercise(workout.id, exerciseName, parseInt(sets), parseInt(reps));
      setExerciseName('');
    };

    return (
      <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3 mb-4">
        <StyledView className="flex-row justify-between items-center">
          <StyledText className="text-lg font-semibold text-white">{workout.name}</StyledText>
          <StyledTouchableOpacity onPress={() => deleteWorkout(workout.id)} className="p-1">
            <Trash2 color="#f87171" size={20} />
          </StyledTouchableOpacity>
        </StyledView>
        <StyledView className="space-y-2">
          {workout.exercises.map((ex, index) => (
            <StyledView key={ex.id} className="flex-row items-center justify-between bg-gray-600/50 p-2 rounded-md">
              <StyledText className="text-sm font-medium text-white flex-1">{index + 1}. {ex.name}</StyledText>
              <StyledText className="text-xs text-gray-400 font-mono mx-3">{ex.sets}x{ex.reps}</StyledText>
              <StyledTouchableOpacity onPress={() => deleteExercise(workout.id, ex.id)} className="p-1">
                 <X color="#f87171" size={16} />
              </StyledTouchableOpacity>
            </StyledView>
          ))}
        </StyledView>
        <StyledView className="pt-2">
          <StyledView className="flex-row gap-2">
            <StyledTextInput
              placeholder="New Exercise"
              placeholderTextColor="#9ca3af"
              className="flex-1 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white"
              value={exerciseName}
              onChangeText={setExerciseName}
            />
            <StyledTextInput
              placeholder="Sets"
              placeholderTextColor="#9ca3af"
              className="w-16 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white text-center"
              keyboardType="number-pad"
              value={sets}
              onChangeText={setSets}
            />
            <StyledTextInput
              placeholder="Reps"
              placeholderTextColor="#9ca3af"
              className="w-16 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white text-center"
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
            />
          </StyledView>
          <StyledTouchableOpacity
            onPress={handleAddExercise}
            className="mt-2 bg-green-600 hover:bg-green-700 rounded-md py-2 flex-row items-center justify-center space-x-1"
          >
            <Plus color="white" size={16} />
            <StyledText className="text-sm font-semibold text-white">Add</StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>
    );
  };


  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <StyledView className="flex-1 justify-center items-center bg-black/50 p-4">
        <StyledView className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-lg max-h-[90vh]">
          <StyledView className="flex-row justify-between items-center pb-4 mb-4 border-b border-gray-700">
            <StyledText className="text-2xl font-bold text-white">Manage Workouts</StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <X color="#9ca3af" size={24} />
            </StyledTouchableOpacity>
          </StyledView>

          <StyledView className="mb-6 bg-gray-700 rounded-lg p-4">
            <StyledText className="text-lg font-semibold mb-3 text-white">Add New Workout</StyledText>
            <StyledView className="space-y-3">
              <StyledTextInput
                placeholder="Workout name (e.g., Push Day)"
                placeholderTextColor="#9ca3af"
                className="w-full bg-gray-600 border border-gray-500 rounded-md p-2 text-white"
                value={newWorkoutName}
                onChangeText={setNewWorkoutName}
              />
              <StyledTouchableOpacity
                onPress={addWorkout}
                className="w-full py-2 px-4 bg-green-600 rounded-lg flex-row items-center justify-center space-x-2"
              >
                <Plus color="white" size={20} />
                <StyledText className="font-semibold text-white">Add Workout</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>

          <FlatList
            data={workouts}
            renderItem={({ item }) => <WorkoutItem workout={item} />}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </StyledView>
      </StyledView>
    </Modal>
  );
};

export default WorkoutManagementModal;