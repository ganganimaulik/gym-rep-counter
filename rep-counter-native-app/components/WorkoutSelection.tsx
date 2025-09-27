import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { Picker } from '@react-native-picker/picker';
import WorkoutManagementModal from './WorkoutManagementModal';
import { Workout, Exercise } from '../types';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface WorkoutSelectionProps {
  workouts: Workout[];
  currentWorkout: Workout | null;
  selectWorkout: (workout: Workout) => void;
  addWorkout: (name: string) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (workoutId: string, exercise: Omit<Exercise, 'id'>) => void;
  deleteExercise: (workoutId: string, exerciseId: string) => void;
}

const WorkoutSelection = ({
  workouts,
  currentWorkout,
  selectWorkout,
  addWorkout,
  deleteWorkout,
  addExercise,
  deleteExercise,
}: WorkoutSelectionProps) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-lg font-semibold text-white">Current Workout</StyledText>
        <StyledTouchableOpacity
          className="flex-row items-center space-x-2 rounded-lg bg-gray-600 px-3 py-2"
          onPress={() => setModalVisible(true)}
        >
          <StyledText className="text-sm font-semibold text-white">Manage</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
      <Picker
        selectedValue={currentWorkout?.id}
        onValueChange={(itemValue) => {
          const workout = workouts.find(w => w.id === itemValue);
          if (workout) selectWorkout(workout);
        }}
        style={{ color: 'white' }}
        dropdownIconColor="white"
      >
        {workouts.map(workout => (
          <Picker.Item key={workout.id} label={workout.name} value={workout.id} />
        ))}
      </Picker>

      <WorkoutManagementModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        workouts={workouts}
        addWorkout={addWorkout}
        deleteWorkout={deleteWorkout}
        addExercise={addExercise}
        deleteExercise={deleteExercise}
      />
    </StyledView>
  );
};

export default WorkoutSelection;