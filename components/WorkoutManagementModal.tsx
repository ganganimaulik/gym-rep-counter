import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { styled } from 'nativewind'
import { X, Trash2, Plus, GripVertical, Timer } from 'lucide-react-native'
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { randomUUID } from 'expo-crypto'
import { Workout, Exercise, Settings } from '../hooks/useData'
import type { WeightUnit } from '../declarations'
import {
  TIMING_FIELDS,
  TIMING_FIELD_SPECS,
  describeTimingOverrides,
  isValidTimingValue,
  parseTimingInput,
  type TimingField,
} from '../utils/exerciseTiming'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

interface WorkoutManagementModalProps {
  visible: boolean
  onClose: () => void
  workouts: Workout[]
  setWorkouts: (workouts: Workout[]) => void
  // Global timing defaults, shown as the placeholder for each per-exercise
  // override so a blank field reads as "inherits <global value>".
  settings: Settings
}

interface EditExerciseState {
  visible: boolean
  workoutId: string
  exercise: Exercise | null
}

interface WorkoutItemProps {
  workout: Workout
  addExercise: (
    workoutId: string,
    exerciseName: string,
    sets: number,
    reps: number,
  ) => void
  deleteExercise: (workoutId: string, exerciseId: string) => void
  updateExerciseOrder: (
    workoutId: string,
    reorderedExercises: Exercise[],
  ) => void
  openEditModal: (workoutId: string, exercise: Exercise) => void
  deleteWorkout: (id: string) => void
}

const WorkoutItem: React.FC<WorkoutItemProps> = React.memo(
  ({
    workout,
    addExercise,
    deleteExercise,
    updateExerciseOrder,
    openEditModal,
    deleteWorkout,
  }) => {
    const [exerciseName, setExerciseName] = useState('')
    const [sets, setSets] = useState('3')
    const [reps, setReps] = useState('12')

    const handleAddExercise = () => {
      addExercise(
        workout.id,
        exerciseName,
        parseInt(sets, 10) || 3,
        parseInt(reps, 10) || 12,
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
        activeOpacity={0.7}
        className={`flex-row items-center justify-between bg-zinc-800/80 border border-zinc-800/40 p-3 rounded-xl mb-2 ${
          isActive ? 'bg-zinc-700/80 border-indigo-500' : ''
        }`}>
        <StyledView className="flex-row items-center flex-1">
          <StyledView className="mr-2.5">
            <GripVertical color="#71717a" size={16} />
          </StyledView>
          <StyledText className="text-sm font-semibold text-white flex-1">
            {getIndex()! + 1}. {ex.name}
          </StyledText>
        </StyledView>
        <StyledView className="mx-3 items-end">
          <StyledText className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            {ex.sets} sets × {ex.reps} reps
          </StyledText>
          {!!describeTimingOverrides(ex) && (
            <StyledView className="flex-row items-center mt-0.5">
              <Timer color="#818cf8" size={10} />
              <StyledText className="text-[10px] text-indigo-400 font-bold ml-1">
                {describeTimingOverrides(ex)}
              </StyledText>
            </StyledView>
          )}
        </StyledView>
        <Pressable
          testID="delete-exercise-button"
          onPress={() => deleteExercise(workout.id, ex.id)}
          style={{ padding: 4 }}>
          <X color="#f87171" size={16} />
        </Pressable>
      </StyledTouchableOpacity>
    )

    return (
      <StyledView className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 mb-4 shadow-xl">
        <StyledView className="flex-row justify-between items-center mb-3">
          <StyledText className="text-lg font-black text-white">
            {workout.name}
          </StyledText>
          <StyledTouchableOpacity
            testID="delete-workout-button"
            onPress={() => deleteWorkout(workout.id)}
            activeOpacity={0.7}
            className="p-1 bg-red-950/20 border border-red-900/30 rounded-lg">
            <Trash2 color="#ef4444" size={18} />
          </StyledTouchableOpacity>
        </StyledView>

        {workout.exercises.length > 0 ? (
          <DraggableFlatList
            data={workout.exercises}
            renderItem={renderExercise}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => updateExerciseOrder(workout.id, data)}
            scrollEnabled={false}
          />
        ) : (
          <StyledText className="text-zinc-500 text-xs italic mb-2">
            No exercises added yet.
          </StyledText>
        )}

        <StyledView className="pt-3 mt-3 border-t border-zinc-800/60">
          <StyledView className="flex-row gap-2">
            <StyledTextInput
              placeholder="Exercise name"
              placeholderTextColor="#52525b"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white font-medium"
              value={exerciseName}
              onChangeText={setExerciseName}
            />
            <StyledTextInput
              placeholder="Sets"
              placeholderTextColor="#52525b"
              className="w-14 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white text-center font-bold"
              keyboardType="number-pad"
              value={sets}
              onChangeText={setSets}
            />
            <StyledTextInput
              placeholder="Reps"
              placeholderTextColor="#52525b"
              className="w-14 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white text-center font-bold"
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
            />
          </StyledView>
          <StyledTouchableOpacity
            onPress={handleAddExercise}
            activeOpacity={0.7}
            className="mt-3 bg-emerald-600 rounded-xl py-2.5 flex-row items-center justify-center space-x-1 shadow-md shadow-emerald-600/10">
            <Plus color="white" size={16} />
            <StyledText className="text-xs font-black text-white uppercase tracking-wider">
              Add Exercise
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>
    )
  },
)
WorkoutItem.displayName = 'WorkoutItem'

// Draft text for each timing override; '' means "follow the global setting".
type TimingDrafts = Record<TimingField, string>

const emptyTimingDrafts = (): TimingDrafts =>
  TIMING_FIELDS.reduce(
    (acc, field) => ({ ...acc, [field]: '' }),
    {} as TimingDrafts,
  )

const timingDraftsFrom = (exercise: Exercise): TimingDrafts =>
  TIMING_FIELDS.reduce((acc, field) => {
    const value = exercise[field]
    acc[field] = isValidTimingValue(field, value) ? String(value) : ''
    return acc
  }, emptyTimingDrafts())

const WorkoutManagementModal: React.FC<WorkoutManagementModalProps> = ({
  visible,
  workouts,
  setWorkouts,
  settings,
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
  const [editWeightUnit, setEditWeightUnit] = useState<WeightUnit>('kg')
  const [editVariants, setEditVariants] = useState('')
  // Kept as strings until save: parsing on every keystroke would fight the
  // decimal point on the rep-tempo fields.
  const [editTiming, setEditTiming] = useState<TimingDrafts>(emptyTimingDrafts)

  if (!visible) return null

  const openEditModal = (workoutId: string, exercise: Exercise) => {
    setEditExercise({ visible: true, workoutId, exercise })
    setEditName(exercise.name)
    setEditSets(exercise.sets.toString())
    setEditReps(exercise.reps.toString())
    setEditWeightUnit(exercise.weightUnit ?? 'kg')
    setEditVariants((exercise.variants ?? []).join(', '))
    setEditTiming(timingDraftsFrom(exercise))
  }

  const closeEditModal = () => {
    setEditExercise({ visible: false, workoutId: '', exercise: null })
    setEditName('')
    setEditSets('')
    setEditReps('')
    setEditWeightUnit('kg')
    setEditVariants('')
    setEditTiming(emptyTimingDrafts())
  }

  const saveEditExercise = () => {
    if (!editExercise.exercise || !editName.trim()) return

    const variants = editVariants
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    const updatedWorkouts = workouts.map((w) => {
      if (w.id === editExercise.workoutId) {
        return {
          ...w,
          exercises: w.exercises.map((ex) => {
            if (ex.id !== editExercise.exercise!.id) return ex
            const updated: Exercise = {
              ...ex,
              name: editName.trim(),
              sets: parseInt(editSets, 10) || ex.sets,
              reps: parseInt(editReps, 10) || ex.reps,
              weightUnit: editWeightUnit,
            }
            // Workouts are synced to Firestore as-is, which rejects
            // undefined values — drop the key entirely when empty.
            if (variants.length > 0) {
              updated.variants = variants
            } else {
              delete updated.variants
            }
            for (const field of TIMING_FIELDS) {
              const value = parseTimingInput(field, editTiming[field])
              if (value === undefined) {
                delete updated[field]
              } else {
                updated[field] = value
              }
            }
            return updated
          }),
        }
      }
      return w
    })
    setWorkouts(updatedWorkouts)
    closeEditModal()
  }

  const generateId = () => {
    return randomUUID()
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StyledView className="flex-1 bg-zinc-950 p-4">
        {/* Header */}
        <StyledView className="flex-row justify-between items-center pb-3 border-b border-zinc-900 mb-4">
          <StyledText className="text-2xl font-black text-white">
            ROUTINES
          </StyledText>
        </StyledView>

        {/* Add New Routine Card */}
        <StyledView className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledText className="text-sm font-black text-zinc-400 tracking-wider uppercase mb-3">
            Create Routine
          </StyledText>
          <StyledView className="flex-row gap-2">
            <StyledTextInput
              placeholder="Routine name (e.g. Chest & Triceps)"
              placeholderTextColor="#52525b"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white font-medium"
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
            />
            <StyledTouchableOpacity
              onPress={addWorkout}
              activeOpacity={0.7}
              className="px-4 bg-purple-600 rounded-xl flex-row items-center justify-center space-x-1 shadow-md shadow-purple-600/15">
              <Plus color="white" size={18} />
              <StyledText className="text-xs font-black text-white uppercase tracking-wider">
                Create
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>

        {/* Routines List */}
        <FlatList
          data={workouts}
          renderItem={({ item }) => (
            <WorkoutItem
              workout={item}
              addExercise={addExercise}
              deleteExercise={deleteExercise}
              updateExerciseOrder={updateExerciseOrder}
              openEditModal={openEditModal}
              deleteWorkout={deleteWorkout}
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />

        {/* Edit Exercise Overlay */}
        {editExercise.visible && (
          <StyledView className="absolute inset-0 bg-black/60 z-50">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
              <StyledView className="flex-1 justify-center items-center p-4">
                <StyledScrollView
                  className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                  // Scrollable so the timing fields can't push Save off-screen
                  // on shorter devices.
                  contentContainerStyle={{ padding: 24 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>
                  <StyledText className="text-white text-xl font-black mb-1 text-center">
                    Edit Exercise
                  </StyledText>
                  {editExercise.exercise && (
                    <StyledText className="text-zinc-500 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                      {editExercise.exercise.name}
                    </StyledText>
                  )}

                  <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                    Exercise Name
                  </StyledText>
                  <StyledTextInput
                    testID="edit-exercise-name"
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-semibold text-sm"
                    placeholder="Exercise name"
                    placeholderTextColor="#52525b"
                    value={editName}
                    onChangeText={setEditName}
                  />

                  <StyledView className="flex-row gap-3 mb-4">
                    <StyledView className="flex-1">
                      <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                        Sets
                      </StyledText>
                      <StyledTextInput
                        testID="edit-exercise-sets"
                        className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl text-center font-bold text-sm"
                        keyboardType="number-pad"
                        value={editSets}
                        onChangeText={setEditSets}
                      />
                    </StyledView>
                    <StyledView className="flex-1">
                      <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                        Reps
                      </StyledText>
                      <StyledTextInput
                        testID="edit-exercise-reps"
                        className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl text-center font-bold text-sm"
                        keyboardType="number-pad"
                        value={editReps}
                        onChangeText={setEditReps}
                      />
                    </StyledView>
                  </StyledView>

                  <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                    Weight Unit
                  </StyledText>
                  <StyledView className="flex-row bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden mb-4">
                    {(['kg', 'plates'] as WeightUnit[]).map((unit) => (
                      <StyledTouchableOpacity
                        key={unit}
                        testID={`edit-exercise-unit-${unit}`}
                        onPress={() => setEditWeightUnit(unit)}
                        activeOpacity={0.7}
                        className={`flex-1 py-2.5 items-center ${
                          editWeightUnit === unit ? 'bg-indigo-600' : ''
                        }`}>
                        <StyledText
                          className={`text-xs font-black uppercase tracking-wider ${
                            editWeightUnit === unit
                              ? 'text-white'
                              : 'text-zinc-500'
                          }`}>
                          {unit}
                        </StyledText>
                      </StyledTouchableOpacity>
                    ))}
                  </StyledView>

                  <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                    Variants (comma-separated, optional)
                  </StyledText>
                  <StyledTextInput
                    testID="edit-exercise-variants"
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-semibold text-sm"
                    placeholder="e.g. Standing, Sitting"
                    placeholderTextColor="#52525b"
                    value={editVariants}
                    onChangeText={setEditVariants}
                  />

                  <StyledView className="border-t border-zinc-800/60 pt-4">
                    <StyledView className="flex-row items-center mb-1">
                      <Timer color="#818cf8" size={13} />
                      <StyledText className="text-zinc-400 text-xs font-bold ml-1.5 uppercase tracking-wide">
                        Timing For This Exercise
                      </StyledText>
                    </StyledView>
                    <StyledText className="text-zinc-500 text-[11px] mb-3 leading-snug">
                      Leave blank to use your global setting (shown greyed out).
                    </StyledText>

                    <StyledView className="flex-row flex-wrap -mx-1.5">
                      {TIMING_FIELDS.map((field) => (
                        <StyledView key={field} className="w-1/2 px-1.5 mb-3">
                          <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                            {TIMING_FIELD_SPECS[field].label}
                          </StyledText>
                          <StyledTextInput
                            testID={`edit-exercise-timing-${field}`}
                            className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl text-center font-bold text-sm"
                            keyboardType={
                              TIMING_FIELD_SPECS[field].integer
                                ? 'number-pad'
                                : 'decimal-pad'
                            }
                            placeholder={String(settings[field])}
                            placeholderTextColor="#52525b"
                            value={editTiming[field]}
                            onChangeText={(text) =>
                              setEditTiming((prev) => ({
                                ...prev,
                                [field]: text,
                              }))
                            }
                          />
                        </StyledView>
                      ))}
                    </StyledView>
                  </StyledView>

                  <StyledView className="flex-row gap-3 mt-2">
                    <StyledTouchableOpacity
                      onPress={closeEditModal}
                      activeOpacity={0.7}
                      className="flex-1 bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center">
                      <StyledText className="text-zinc-300 font-bold text-sm">
                        Cancel
                      </StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity
                      onPress={saveEditExercise}
                      activeOpacity={0.7}
                      className="flex-1 bg-indigo-600 py-3 rounded-xl items-center shadow-lg shadow-indigo-600/15">
                      <StyledText className="text-white font-bold text-sm">
                        Save
                      </StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>
                </StyledScrollView>
              </StyledView>
            </KeyboardAvoidingView>
          </StyledView>
        )}
      </StyledView>
    </GestureHandlerRootView>
  )
}

export default WorkoutManagementModal
