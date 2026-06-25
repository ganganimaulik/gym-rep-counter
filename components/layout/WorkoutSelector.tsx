import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import Toast from 'react-native-toast-message'
import { Edit, ChevronLeft, ChevronRight, Check } from 'lucide-react-native'
import WorkoutPicker from '../WorkoutPicker'
import { Workout, Settings } from '../../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface SetTrackerProps {
  totalSets: number
  isSetCompleted: (setNumber: number) => boolean
  onSetPress: (setNumber: number) => void
}

const SetTracker: React.FC<SetTrackerProps> = ({
  totalSets,
  isSetCompleted,
  onSetPress,
}) => (
  <StyledView className="flex-row justify-end items-center flex-wrap gap-2">
    {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNumber) => {
      const completed = isSetCompleted(setNumber)
      return (
        <StyledTouchableOpacity
          key={setNumber}
          testID={`set-tracker-button-${setNumber}`}
          onPress={() => onSetPress(setNumber)}
          activeOpacity={0.7}
          className={`w-8 h-8 rounded-full justify-center items-center ${
            completed
              ? 'bg-emerald-500 shadow-md shadow-emerald-500/20'
              : 'bg-zinc-800 border border-zinc-700'
          }`}>
          {completed ? (
            <Check color="white" size={16} strokeWidth={3} />
          ) : (
            <StyledText className="text-zinc-400 text-xs font-black">
              {setNumber}
            </StyledText>
          )}
        </StyledTouchableOpacity>
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
  jumpToSet: (set: number) => void
  resetSetsFrom: (exerciseId: string, setNumber: number) => void
  arePreviousSetsCompleted: (exerciseId: string, setNumber: number) => boolean
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
  jumpToSet,
  resetSetsFrom,
  arePreviousSetsCompleted,
}) => {
  return (
    <StyledView className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-4 shadow-xl">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-sm font-black tracking-wider text-zinc-400 uppercase">
          Current Workout
        </StyledText>
        <StyledTouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center space-x-1.5 rounded-xl bg-zinc-800 border border-zinc-700 py-1.5 px-3">
          <Edit color="#a1a1aa" size={14} />
          <StyledText className="text-xs font-bold text-zinc-300">
            Edit
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>

      <WorkoutPicker
        selectedValue={currentWorkout?.id || null}
        onValueChange={(itemValue) => selectWorkout(itemValue)}
        workouts={workouts}
      />

      {currentWorkout && (
        <StyledView className="border-t border-zinc-800/80 pt-4">
          <StyledView className="flex-row justify-between items-center">
            <StyledView className="flex-1 mr-2">
              <StyledText className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Active Exercise
              </StyledText>
              <StyledText className="text-lg font-black text-white mt-0.5 leading-tight">
                {currentWorkout.exercises[currentExerciseIndex]?.name}
              </StyledText>
            </StyledView>
            <SetTracker
              totalSets={settings.maxSets}
              isSetCompleted={(setNumber) =>
                isSetCompleted(activeExerciseId ?? '', setNumber)
              }
              onSetPress={(setNumber) => {
                if (activeExerciseId) {
                  if (arePreviousSetsCompleted(activeExerciseId, setNumber)) {
                    resetSetsFrom(activeExerciseId, setNumber)
                    jumpToSet(setNumber)
                  } else {
                    Toast.show({
                      type: 'error',
                      text1: 'Cannot Skip Sets',
                      text2: 'Please complete the previous sets first.',
                    })
                  }
                }
              }}
            />
          </StyledView>

          <StyledView className="flex-row justify-between items-center mt-3 pt-2 border-t border-zinc-800/40">
            <StyledText className="text-xs font-bold text-zinc-500">
              Exercise {currentExerciseIndex + 1} of{' '}
              {currentWorkout.exercises.length}
            </StyledText>
            <StyledText className="text-xs font-black text-indigo-400">
              Target:{' '}
              {currentWorkout.exercises[currentExerciseIndex]?.reps ??
                settings.maxReps}{' '}
              Reps
            </StyledText>
          </StyledView>
        </StyledView>
      )}

      {currentWorkout && (
        <StyledView className="flex-row justify-between gap-x-3 pt-1">
          <StyledTouchableOpacity
            onPress={prevExercise}
            disabled={currentExerciseIndex === 0}
            activeOpacity={0.7}
            className={`py-3 rounded-xl flex-1 items-center justify-center flex-row ${
              currentExerciseIndex === 0
                ? 'bg-zinc-950/40 opacity-40'
                : 'bg-zinc-800 border border-zinc-700'
            }`}>
            <ChevronLeft
              color={currentExerciseIndex === 0 ? '#52525b' : 'white'}
              size={18}
            />
            <StyledText
              className={`text-xs font-bold ml-1 ${currentExerciseIndex === 0 ? 'text-zinc-600' : 'text-white'}`}>
              Previous
            </StyledText>
          </StyledTouchableOpacity>
          <StyledTouchableOpacity
            onPress={nextExercise}
            disabled={
              currentExerciseIndex >= currentWorkout.exercises.length - 1
            }
            activeOpacity={0.7}
            className={`py-3 rounded-xl flex-1 items-center justify-center flex-row ${
              currentExerciseIndex >= currentWorkout.exercises.length - 1
                ? 'bg-zinc-950/40 opacity-40'
                : 'bg-zinc-800 border border-zinc-700'
            }`}>
            <StyledText
              className={`text-xs font-bold mr-1 ${
                currentExerciseIndex >= currentWorkout.exercises.length - 1
                  ? 'text-zinc-600'
                  : 'text-white'
              }`}>
              Next
            </StyledText>
            <ChevronRight
              color={
                currentExerciseIndex >= currentWorkout.exercises.length - 1
                  ? '#52525b'
                  : 'white'
              }
              size={18}
            />
          </StyledTouchableOpacity>
        </StyledView>
      )}
    </StyledView>
  )
}

export default React.memo(WorkoutSelector)
