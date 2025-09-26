import { Modal, View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { styled } from "nativewind";
import { Workout, Exercise } from "../hooks/useWorkouts";
import { useState } from "react";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

interface WorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  workouts: Workout[];
  onAddWorkout: (name: string) => void;
  onDeleteWorkout: (id: string) => void;
  onAddExercise: (workoutId: string, exercise: Omit<Exercise, 'id'>) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
}

const AddExerciseForm = ({ workoutId, onAddExercise }) => {
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("12");

  const handleAdd = () => {
    if (name.trim()) {
      onAddExercise(workoutId, {
        name: name.trim(),
        sets: parseInt(sets) || 3,
        reps: parseInt(reps) || 12,
      });
      setName("");
      setSets("3");
      setReps("12");
    }
  };

  return (
    <StyledView className="add-exercise-form pt-2">
      <StyledView className="grid grid-cols-12 gap-2">
        <StyledTextInput
          placeholder="New Exercise"
          placeholderTextColor="#9CA3AF"
          className="exercise-name col-span-5 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white"
          value={name}
          onChangeText={setName}
        />
        <StyledTextInput
          placeholder="Sets"
          placeholderTextColor="#9CA3AF"
          className="exercise-sets col-span-2 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white"
          value={sets}
          onChangeText={setSets}
          keyboardType="numeric"
        />
        <StyledTextInput
          placeholder="Reps"
          placeholderTextColor="#9CA3AF"
          className="exercise-reps col-span-2 bg-gray-600 border border-gray-500 rounded-md p-2 text-sm text-white"
          value={reps}
          onChangeText={setReps}
          keyboardType="numeric"
        />
        <StyledPressable
          className="add-exercise-btn col-span-3 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold flex items-center justify-center space-x-1"
          onPress={handleAdd}
        >
          <StyledText className="text-white text-center">Add</StyledText>
        </StyledPressable>
      </StyledView>
    </StyledView>
  );
};

export default function WorkoutModal({
  visible,
  onClose,
  workouts,
  onAddWorkout,
  onDeleteWorkout,
  onAddExercise,
  onDeleteExercise,
}: WorkoutModalProps) {
  const [newWorkoutName, setNewWorkoutName] = useState("");

  const handleAddWorkout = () => {
    if (newWorkoutName.trim()) {
      onAddWorkout(newWorkoutName.trim());
      setNewWorkoutName("");
    }
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
            <StyledPressable onPress={onClose}>
              <StyledText className="text-gray-400 text-2xl">×</StyledText>
            </StyledPressable>
          </StyledView>
          <StyledScrollView>
            <StyledView className="mb-6 bg-gray-700 rounded-lg p-4">
              <StyledText className="text-lg font-semibold mb-3 text-white">Add New Workout</StyledText>
              <StyledView className="space-y-3">
                <StyledTextInput
                  placeholder="Workout name (e.g., Push Day)"
                  placeholderTextColor="#9CA3AF"
                  className="w-full bg-gray-600 border border-gray-500 rounded-md p-2 text-white"
                  value={newWorkoutName}
                  onChangeText={setNewWorkoutName}
                />
                <StyledPressable
                  className="w-full py-2 px-4 bg-green-600 rounded-lg active:bg-green-700"
                  onPress={handleAddWorkout}
                >
                  <StyledText className="text-white font-semibold text-center">Add Workout</StyledText>
                </StyledPressable>
              </StyledView>
            </StyledView>

            <StyledView className="space-y-4">
              {workouts.length === 0 ? (
                <StyledText className="text-center text-gray-400 py-8">
                  No workouts created yet. Add one above!
                </StyledText>
              ) : (
                workouts.map((workout) => (
                  <StyledView key={workout.id} className="bg-gray-700 rounded-lg p-4 space-y-3">
                    <StyledView className="flex-row justify-between items-center">
                      <StyledText className="text-lg font-semibold text-white">{workout.name}</StyledText>
                      <StyledPressable onPress={() => onDeleteWorkout(workout.id)}>
                        <StyledText className="text-red-400">Delete Workout</StyledText>
                      </StyledPressable>
                    </StyledView>
                    <StyledView className="space-y-2">
                      {workout.exercises.map((exercise, index) => (
                        <StyledView key={exercise.id} className="flex-row items-center justify-between bg-gray-600/50 p-2 rounded-md">
                          <StyledText className="text-sm font-medium text-white">{`${index + 1}. ${exercise.name}`}</StyledText>
                          <StyledView className="flex-row items-center space-x-3">
                            <StyledText className="text-xs text-gray-400 font-mono">{`${exercise.sets}x${exercise.reps}`}</StyledText>
                            <StyledPressable onPress={() => onDeleteExercise(workout.id, exercise.id)}>
                               <StyledText className="text-red-400 text-lg">×</StyledText>
                            </StyledPressable>
                          </StyledView>
                        </StyledView>
                      ))}
                    </StyledView>
                    <AddExerciseForm workoutId={workout.id} onAddExercise={onAddExercise} />
                  </StyledView>
                ))
              )}
            </StyledView>
          </StyledScrollView>
        </StyledView>
      </StyledView>
    </Modal>
  );
}