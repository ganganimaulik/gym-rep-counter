import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { styled } from "nativewind";
import { Feather, AntDesign } from "@expo/vector-icons";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);
const StyledTextInput = styled(TextInput);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);

const WorkoutModal = ({
  isVisible,
  onClose,
  workouts,
  onAddWorkout,
  onDeleteWorkout,
  onAddExercise,
  onDeleteExercise,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <StyledView className="flex-1 justify-center items-center bg-black/50">
        <StyledSafeAreaView className="bg-gray-800 rounded-2xl shadow-lg w-[90%] max-h-[90vh]">
          <StyledView className="flex-row justify-between items-center p-4 border-b border-gray-700">
            <StyledText className="text-2xl font-bold text-white">
              Manage Workouts
            </StyledText>
            <StyledPressable onPress={onClose}>
              <AntDesign name="close" size={24} color="#9CA3AF" />
            </StyledPressable>
          </StyledView>

          <StyledScrollView className="p-4">
            {/* Add New Workout */}
            <StyledView className="mb-6 bg-gray-700 rounded-lg p-4">
              <AddWorkoutForm onAddWorkout={onAddWorkout} />
            </StyledView>

            {/* Existing Workouts */}
            <StyledView className="space-y-4">
              {workouts.length === 0 ? (
                <StyledText className="text-center text-gray-400 py-8">
                  No workouts created yet. Add one above!
                </StyledText>
              ) : (
                workouts.map((workout) => (
                  <WorkoutItem
                    key={workout.id}
                    workout={workout}
                    onDeleteWorkout={onDeleteWorkout}
                    onAddExercise={onAddExercise}
                    onDeleteExercise={onDeleteExercise}
                  />
                ))
              )}
            </StyledView>
          </StyledScrollView>
        </StyledSafeAreaView>
      </StyledView>
    </Modal>
  );
};

const AddWorkoutForm = ({ onAddWorkout }) => {
  const [name, setName] = React.useState("");

  const handleAdd = () => {
    if (name.trim()) {
      onAddWorkout(name.trim());
      setName("");
    }
  };

  return (
    <>
      <StyledText className="text-lg font-semibold mb-3 text-white">
        Add New Workout
      </StyledText>
      <StyledView className="space-y-3">
        <StyledTextInput
          placeholder="Workout name (e.g., Push Day)"
          placeholderTextColor="#9CA3AF"
          className="w-full bg-gray-600 border border-gray-500 rounded-md p-2 text-white"
          value={name}
          onChangeText={setName}
        />
        <StyledPressable
          className="w-full py-2 px-4 bg-green-600 rounded-lg active:bg-green-700 flex-row items-center justify-center space-x-2"
          onPress={handleAdd}
        >
          <Feather name="plus" size={20} color="white" />
          <StyledText className="font-semibold text-white">
            Add Workout
          </StyledText>
        </StyledPressable>
      </StyledView>
    </>
  );
};

const WorkoutItem = ({ workout, onDeleteWorkout, onAddExercise, onDeleteExercise }) => (
  <StyledView className="bg-gray-700 rounded-lg p-4 space-y-3">
    <StyledView className="flex-row justify-between items-center">
      <StyledText className="text-lg font-semibold text-white">
        {workout.name}
      </StyledText>
      <StyledPressable
        className="p-1 rounded-md text-red-400 active:bg-gray-600"
        onPress={() => onDeleteWorkout(workout.id)}
      >
        <Feather name="trash-2" size={20} color="#F87171" />
      </StyledPressable>
    </StyledView>
    <StyledView className="space-y-2">
      {workout.exercises.map((ex, index) => (
        <ExerciseItem
          key={ex.id}
          exercise={ex}
          index={index}
          workoutId={workout.id}
          onDeleteExercise={onDeleteExercise}
        />
      ))}
      <AddExerciseForm workoutId={workout.id} onAddExercise={onAddExercise} />
    </StyledView>
  </StyledView>
);

const ExerciseItem = ({ exercise, index, workoutId, onDeleteExercise }) => (
  <StyledView className="flex-row items-center justify-between bg-gray-600/50 p-2 rounded-md">
    <StyledText className="text-sm font-medium text-white">
      {`${index + 1}. ${exercise.name}`}
    </StyledText>
    <StyledView className="flex-row items-center space-x-3">
      <StyledText className="text-xs text-gray-400 font-mono">
        {`${exercise.sets}x${exercise.reps}`}
      </StyledText>
      <StyledPressable
        className="p-1 rounded-md text-red-400 active:bg-gray-500"
        onPress={() => onDeleteExercise(workoutId, exercise.id)}
      >
        <AntDesign name="close" size={16} color="#F87171" />
      </StyledPressable>
    </StyledView>
  </StyledView>
);

const AddExerciseForm = ({ workoutId, onAddExercise }) => {
  const [name, setName] = React.useState("");
  const [sets, setSets] = React.useState("3");
  const [reps, setReps] = React.useState("12");

  const handleAdd = () => {
    if (name.trim()) {
      onAddExercise(workoutId, name.trim(), parseInt(sets) || 3, parseInt(reps) || 12);
      setName("");
      setSets("3");
      setReps("12");
    }
  };

  return (
    <StyledView className="pt-2">
      <StyledView className="flex-row gap-2">
        <StyledTextInput
          placeholder="New Exercise"
          placeholderTextColor="#9CA3AF"
          className="flex-1 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white"
          value={name}
          onChangeText={setName}
        />
        <StyledTextInput
          placeholder="Sets"
          placeholderTextColor="#9CA3AF"
          className="w-14 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white text-center"
          keyboardType="number-pad"
          value={sets}
          onChangeText={setSets}
        />
        <StyledTextInput
          placeholder="Reps"
          placeholderTextColor="#9CA3AF"
          className="w-14 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white text-center"
          keyboardType="number-pad"
          value={reps}
          onChangeText={setReps}
        />
        <StyledPressable
          className="bg-green-600 rounded-md active:bg-green-700 items-center justify-center px-3"
          onPress={handleAdd}
        >
          <Feather name="plus" size={16} color="white" />
        </StyledPressable>
      </StyledView>
    </StyledView>
  );
};

// React is needed for state management in the forms
import React from "react";

export default WorkoutModal;