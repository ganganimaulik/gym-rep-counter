import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { Edit, ChevronLeft, ChevronRight } from 'lucide-react-native';
import WorkoutPicker from '../WorkoutPicker';
import { Workout, Settings } from '../../hooks/useData';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface WorkoutSelectorProps {
  workouts: Workout[];
  currentWorkout: Workout | null;
  currentExerciseIndex: number;
  settings: Settings;
  selectWorkout: (workoutId: string | null) => void;
  setModalVisible: (visible: boolean) => void;
  prevExercise: () => void;
  nextExercise: () => void;
}

const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({
  workouts,
  currentWorkout,
  currentExerciseIndex,
  settings,
  selectWorkout,
  setModalVisible,
  prevExercise,
  nextExercise,
}) => {
  const currentExercise = currentWorkout?.exercises[currentExerciseIndex];

  return (
    <StyledView className="bg-gray-700/50 rounded-xl p-4 space-y-4">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-lg font-semibold text-white">
          Workout
        </StyledText>
        <StyledTouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center space-x-2 rounded-lg bg-gray-600/80 px-3 py-2"
        >
          <Edit color="#d1d5db" size={14} />
          <StyledText className="text-sm font-semibold text-white">
            Manage
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>
      <WorkoutPicker
        selectedValue={currentWorkout?.id || null}
        onValueChange={(itemValue) => selectWorkout(itemValue)}
        workouts={workouts}
      />
      {currentWorkout && currentExercise && (
        <StyledView className="pt-2">
          <StyledView className="flex-row justify-between items-baseline pb-1">
            <StyledText className="text-sm text-gray-400">
              Exercise {currentExerciseIndex + 1} of {currentWorkout.exercises.length}
            </StyledText>
            <StyledText className="text-sm font-semibold text-gray-200">
              {currentExercise.sets} Sets, {currentExercise.reps} Reps
            </StyledText>
          </StyledView>

          <StyledView className="flex-row justify-between items-center bg-gray-900/40 p-3 rounded-lg">
            <StyledTouchableOpacity
              onPress={prevExercise}
              disabled={currentExerciseIndex === 0}
              className="p-2"
            >
              <ChevronLeft
                color={currentExerciseIndex === 0 ? '#4b5563' : 'white'}
                size={22}
              />
            </StyledTouchableOpacity>

            <StyledText className="text-base font-medium text-white text-center flex-1">
              {currentExercise.name}
            </StyledText>

            <StyledTouchableOpacity
              onPress={nextExercise}
              disabled={currentExerciseIndex >= currentWorkout.exercises.length - 1}
              className="p-2"
            >
              <ChevronRight
                color={
                  currentExerciseIndex >= currentWorkout.exercises.length - 1
                    ? '#4b5563'
                    : 'white'
                }
                size={22}
              />
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      )}
    </StyledView>
  );
};

export default WorkoutSelector;