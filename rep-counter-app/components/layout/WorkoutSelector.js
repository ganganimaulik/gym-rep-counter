import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { Edit, ChevronLeft, ChevronRight } from 'lucide-react-native';
import WorkoutPicker from '../WorkoutPicker';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const WorkoutSelector = ({
  workouts,
  currentWorkout,
  currentExerciseIndex,
  settings,
  selectWorkout,
  setModalVisible,
  prevExercise,
  nextExercise,
}) => {
  return (
<StyledView className="bg-gray-700 rounded-lg p-4 space-y-4">
      <StyledView className="flex-row justify-between items-center">
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
    </StyledView>
  );
};

export default WorkoutSelector;