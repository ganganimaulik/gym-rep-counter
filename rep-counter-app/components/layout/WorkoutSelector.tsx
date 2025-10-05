import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import {
  Edit,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react-native'
import WorkoutPicker from '../WorkoutPicker'
import { Workout, Settings } from '../../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface SetTrackerProps {
  totalSets: number
  isSetCompleted: (setNumber: number) => boolean
}

const SetTracker: React.FC<SetTrackerProps> = ({
  totalSets,
  isSetCompleted,
}) => (
  <StyledView className="flex-row justify-center items-center flex-wrap gap-2 my-2">
    {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNumber) => {
      const completed = isSetCompleted(setNumber)
      return (
        <StyledView
          key={setNumber}
          className={`w-6 h-6 rounded-full justify-center items-center ${
            completed ? 'bg-green-500' : 'bg-gray-500'
          }`}>
          {completed ? (
            <Check color="white" size={16} />
          ) : (
            <StyledText className="text-white text-xs font-bold">
              {setNumber}
            </StyledText>
          )}
        </StyledView>
      )
    })}
  </StyledView>
)

interface WorkoutSelectorProps {
  workouts: Workout[]
  currentWorkout: Workout | null
  currentExerciseIndex: number
  settings: Settings
  selectWorkout: (workoutId: string | null) => void
  setModalVisible: (visible: boolean) => void
  prevExercise: () => void
  nextExercise: () => void
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
  activeExerciseId: string | undefined
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
  isSetCompleted,
  activeExerciseId,
}) => {
  return (
    <StyledView className="bg-gray-700 rounded-lg p-4 space-y-4">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-lg font-semibold text-white">
          Current Workout
        </StyledText>
        <StyledTouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center space-x-2 rounded-lg bg-gray-600 p-3">
          <Edit color="#d1d5db" size={16} />
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
      {currentWorkout && (
        <StyledView>
          <StyledText className="text-sm text-gray-400">
            Current Exercise:
          </StyledText>
          <StyledText className="text-lg font-medium text-white">
            {currentWorkout.exercises[currentExerciseIndex]?.name}
          </StyledText>
          <SetTracker
            totalSets={settings.maxSets}
            isSetCompleted={(setNumber) =>
              isSetCompleted(activeExerciseId ?? '', setNumber)
            }
          />
          <StyledView className="flex-row justify-between items-center mt-1">
            <StyledText className="text-sm text-gray-400">
              Exercise {currentExerciseIndex + 1} of{' '}
              {currentWorkout.exercises.length}
            </StyledText>
            <StyledText className="text-sm font-semibold text-gray-200">
              Reps: {settings.maxReps}
            </StyledText>
          </StyledView>
        </StyledView>
      )}
      {currentWorkout && (
        <StyledView className="flex-row justify-between gap-x-4">
          <StyledTouchableOpacity
            onPress={prevExercise}
            disabled={currentExerciseIndex === 0}
            className="p-3 bg-gray-600 rounded-lg flex-1 items-center">
            <ChevronLeft
              color={currentExerciseIndex === 0 ? '#4b5563' : 'white'}
              size={24}
            />
          </StyledTouchableOpacity>
          <StyledTouchableOpacity
            onPress={nextExercise}
            disabled={
              currentExerciseIndex >= currentWorkout.exercises.length - 1
            }
            className="p-3 bg-gray-600 rounded-lg flex-1 items-center">
            <ChevronRight
              color={
                currentExerciseIndex >= currentWorkout.exercises.length - 1
                  ? '#4b5563'
                  : 'white'
              }
              size={24}
            />
          </StyledTouchableOpacity>
        </StyledView>
      )}
    </StyledView>
  )
}

export default WorkoutSelector
