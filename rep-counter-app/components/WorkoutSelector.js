import { View, Text, Pressable } from "react-native";
import { styled } from "nativewind";
import { Feather } from "@expo/vector-icons";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

// Note: The Picker component from react-native is basic.
// For a dropdown with better styling, a custom component or a library like
// react-native-picker-select would be needed. For this conversion, we'll
// use a simple Pressable to indicate where the selector would be.

const WorkoutSelector = ({ onManageWorkouts, workout, exercise, exerciseIndex, totalExercises }) => {
  return (
    <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-lg font-semibold text-white">Current Workout</StyledText>
        <StyledPressable
          className="flex-row items-center space-x-2 rounded-lg bg-gray-600 px-3 py-2 active:bg-gray-500"
          onPress={onManageWorkouts}
        >
          <Feather name="edit" size={16} color="#D1D5DB" />
          <StyledText className="text-sm font-semibold text-white">Manage</StyledText>
        </StyledPressable>
      </StyledView>
      <StyledView className="w-full bg-gray-600 border border-gray-500 rounded-md p-3">
        <StyledText className="text-white">{workout ? workout.name : "Select a workout..."}</StyledText>
      </StyledView>
      {exercise && (
        <StyledView>
          <StyledText className="text-sm text-gray-400">Current Exercise:</StyledText>
          <StyledText className="text-lg font-medium text-white">{exercise.name}</StyledText>
          <StyledText className="text-sm text-gray-400 mt-1">
            Exercise {exerciseIndex + 1} of {totalExercises}
          </StyledText>
        </StyledView>
      )}
    </StyledView>
  );
};

export default WorkoutSelector;