import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { styled } from 'nativewind'
import { X, Trash2, Plus, GripVertical } from 'lucide-react-native'
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Workout, Exercise } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface WorkoutManagementModalProps {
  visible: boolean
  onClose: () => void
  workouts: Workout[]
  setWorkouts: (workouts: Workout[]) => void
}

interface EditExerciseState {
  visible: boolean
  workoutId: string
  exercise: Exercise | null
}

const WorkoutManagementModal: React.FC<WorkoutManagementModalProps> = ({
  visible,
  onClose,
  workouts,
  setWorkouts,
}) => {
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [editExercise, setEditExercise] = useState<EditExerciseState>({
    visible: false,
    workoutId: '',
    exercise: null,
  })
  const [editName, setEditName] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editReps, setEditReps] = useState('')

  const openEditModal = (workoutId: string, exercise: Exercise) => {
    setEditExercise({ visible: true, workoutId, exercise })
    setEditName(exercise.name)
    setEditSets(exercise.sets.toString())
    setEditReps(exercise.reps.toString())
  }

  const closeEditModal = () => {
    setEditExercise({ visible: false, workoutId: '', exercise: null })
    setEditName('')
    setEditSets('')
    setEditReps('')
  }

  const saveEditExercise = () => {
    if (!editExercise.exercise || !editName.trim()) return

    const updatedWorkouts = workouts.map((w) => {
      if (w.id === editExercise.workoutId) {
        return {
          ...w,
          exercises: w.exercises.map((ex) =>
            ex.id === editExercise.exercise!.id
              ? {
                  ...ex,
                  name: editName.trim(),
                  sets: parseInt(editSets, 10) || ex.sets,
                  reps: parseInt(editReps, 10) || ex.reps,
                }
              : ex,
          ),
        }
      }
      return w
    })
    setWorkouts(updatedWorkouts)
    closeEditModal()
  }

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  const addWorkout = () => {
    if (newWorkoutName.trim()) {
      const newWorkout: Workout = {
        id: generateId(),
        name: newWorkoutName.trim(),
        exercises: [],
      }
      const updatedWorkouts = [...workouts, newWorkout]
      setWorkouts(updatedWorkouts)
      setNewWorkoutName('')
    }
  }

  const deleteWorkout = (id: string) => {
    const updatedWorkouts = workouts.filter((w) => w.id !== id)
    setWorkouts(updatedWorkouts)
  }

  const addExercise = (
    workoutId: string,
    exerciseName: string,
    sets: number,
    reps: number,
  ) => {
    if (exerciseName.trim()) {
      const updatedWorkouts = workouts.map((w) => {
        if (w.id === workoutId) {
          return {
            ...w,
            exercises: [
              ...w.exercises,
              { id: generateId(), name: exerciseName.trim(), sets, reps },
            ],
          }
        }
        return w
      })
      setWorkouts(updatedWorkouts)
    }
  }

  const deleteExercise = (workoutId: string, exerciseId: string) => {
    const updatedWorkouts = workouts.map((w) => {
      if (w.id === workoutId) {
        return {
          ...w,
          exercises: w.exercises.filter((ex) => ex.id !== exerciseId),
        }
      }
      return w
    })
    setWorkouts(updatedWorkouts)
  }

  const updateExerciseOrder = (
    workoutId: string,
    reorderedExercises: Exercise[],
  ) => {
    const updatedWorkouts = workouts.map((w) => {
      if (w.id === workoutId) {
        return { ...w, exercises: reorderedExercises }
      }
      return w
    })
    setWorkouts(updatedWorkouts)
  }

  const WorkoutItem = ({ workout }: { workout: Workout }) => {
    const [exerciseName, setExerciseName] = useState('')
    const [sets, setSets] = useState('3')
    const [reps, setReps] = useState('12')

    const handleAddExercise = () => {
      addExercise(
        workout.id,
        exerciseName,
        parseInt(sets, 10),
        parseInt(reps, 10),
      )
      setExerciseName('')
    }

    const renderExercise = ({
      item: ex,
      drag,
      isActive,
      getIndex,
    }: RenderItemParams<Exercise>) => (
      <StyledTouchableOpacity
        onPress={() => openEditModal(workout.id, ex)}
        onLongPress={drag}
        disabled={isActive}
        className={`flex-row items-center justify-between bg-gray-600/50 p-2 rounded-md mb-2 ${isActive ? 'opacity-50' : ''}`}>
        <StyledView className="flex-row items-center flex-1">
          <GripVertical color="#9ca3af" size={20} className="mr-2" />
          <StyledText className="text-sm font-medium text-white flex-1">
            {getIndex()! + 1}. {ex.name}
          </StyledText>
        </StyledView>
        <StyledText className="text-xs text-gray-400 font-mono mx-3">
          {ex.sets}x{ex.reps}
        </StyledText>
        <Pressable
          onPress={() => deleteExercise(workout.id, ex.id)}
          style={{ padding: 4 }}>
          <X color="#f87171" size={16} />
        </Pressable>
      </StyledTouchableOpacity>
    )

    return (
      <StyledView className="bg-gray-700 rounded-lg p-3 space-y-2 mb-2">
        <StyledView className="flex-row justify-between items-center">
          <StyledText className="text-lg font-semibold text-white">
            {workout.name}
          </StyledText>
          <StyledTouchableOpacity
            onPress={() => deleteWorkout(workout.id)}
            className="p-1">
            <Trash2 color="#f87171" size={20} />
          </StyledTouchableOpacity>
        </StyledView>
        <DraggableFlatList
          data={workout.exercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => updateExerciseOrder(workout.id, data)}
          containerStyle={{ flex: 1 }}
        />
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
            className="mt-2 bg-green-600 hover:bg-green-700 rounded-md py-2 flex-row items-center justify-center space-x-1">
            <Plus color="white" size={16} />
            <StyledText className="text-sm font-semibold text-white">
              Add
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>
    )
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StyledView className="flex-1 justify-center items-center bg-black/50 p-4">
          <StyledView className="bg-gray-800 rounded-2xl shadow-lg p-4 w-full max-w-lg max-h-[90vh]">
            <StyledView className="flex-row justify-between items-center pb-4 border-b border-gray-700">
              <StyledText className="text-2xl font-bold text-white">
                Manage Workouts
              </StyledText>
              <StyledTouchableOpacity onPress={onClose}>
                <X color="#9ca3af" size={24} />
              </StyledTouchableOpacity>
            </StyledView>

            <StyledView className="my-4 bg-gray-700 rounded-lg p-4">
              <StyledText className="text-lg font-semibold mb-3 text-white">
                Add New Workout
              </StyledText>
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
                  className="w-full py-2 px-4 bg-green-600 rounded-lg flex-row items-center justify-center space-x-2">
                  <Plus color="white" size={20} />
                  <StyledText className="font-semibold text-white">
                    Add Workout
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>

            <FlatList
              data={workouts}
              renderItem={({ item }) => <WorkoutItem workout={item} />}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              containerStyle={{ flex: 1 }}
            />
          </StyledView>

          {/* Edit Exercise Overlay */}
          {editExercise.visible && (
            <StyledView className="absolute inset-0">
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'flex-start' }}
                keyboardVerticalOffset={0}>
                <StyledView className="items-center px-3">
                  <StyledView className="bg-gray-800 rounded-3xl shadow-2xl p-6 w-full">
                    {/* Header */}
                    <StyledView className="flex-row justify-between items-center pb-5 mb-5 border-b border-gray-600">
                      <StyledText className="text-2xl font-bold text-white">
                        Edit Exercise
                      </StyledText>
                      <StyledTouchableOpacity 
                        onPress={closeEditModal}
                        className="p-2 bg-gray-700 rounded-full">
                        <X color="#9ca3af" size={20} />
                      </StyledTouchableOpacity>
                    </StyledView>

                    {/* Exercise Name Field */}
                    <StyledView className="mb-5">
                      <StyledText className="text-sm font-medium text-gray-300 mb-2">
                        Exercise Name
                      </StyledText>
                      <StyledTextInput
                        placeholder="Enter exercise name"
                        placeholderTextColor="#6b7280"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-4 text-white text-base"
                        value={editName}
                        onChangeText={setEditName}
                      />
                    </StyledView>

                    {/* Sets and Reps Row */}
                    <StyledView className="flex-row gap-4 mb-6">
                      <StyledView className="flex-1">
                        <StyledText className="text-sm font-medium text-gray-300 mb-2">
                          Sets
                        </StyledText>
                        <StyledTextInput
                          placeholder="0"
                          placeholderTextColor="#6b7280"
                          className="w-full bg-gray-700 border border-gray-600 rounded-xl p-4 text-white text-lg text-center font-semibold"
                          keyboardType="number-pad"
                          value={editSets}
                          onChangeText={setEditSets}
                        />
                      </StyledView>
                      <StyledView className="flex-1">
                        <StyledText className="text-sm font-medium text-gray-300 mb-2">
                          Reps
                        </StyledText>
                        <StyledTextInput
                          placeholder="0"
                          placeholderTextColor="#6b7280"
                          className="w-full bg-gray-700 border border-gray-600 rounded-xl p-4 text-white text-lg text-center font-semibold"
                          keyboardType="number-pad"
                          value={editReps}
                          onChangeText={setEditReps}
                        />
                      </StyledView>
                    </StyledView>

                    {/* Action Buttons */}
                    <StyledView className="flex-row gap-4">
                      <StyledTouchableOpacity
                        onPress={closeEditModal}
                        className="flex-1 py-4 bg-gray-700 rounded-xl items-center border border-gray-600">
                        <StyledText className="font-semibold text-gray-300 text-base">
                          Cancel
                        </StyledText>
                      </StyledTouchableOpacity>
                      <StyledTouchableOpacity
                        onPress={saveEditExercise}
                        className="flex-1 py-4 bg-green-500 rounded-xl items-center">
                        <StyledText className="font-bold text-white text-base">
                          Save Changes
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>
                </StyledView>
              </KeyboardAvoidingView>
            </StyledView>
          )}
        </StyledView>
      </GestureHandlerRootView>
    </Modal>
  )
}

export default WorkoutManagementModal
