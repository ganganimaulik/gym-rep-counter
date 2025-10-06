import React from 'react'
import { Modal, View, Text, TouchableOpacity, FlatList } from 'react-native'
import { styled } from 'nativewind'
import { X } from 'lucide-react-native'
import { RepHistoryLog, Workout } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface HistoryLogModalProps {
  visible: boolean
  onClose: () => void
  history: RepHistoryLog[]
  workouts: Workout[]
}

const findExerciseName = (exerciseId: string, workouts: Workout[]): string => {
  for (const workout of workouts) {
    const exercise = workout.exercises.find((ex) => ex.id === exerciseId)
    if (exercise) {
      return exercise.name
    }
  }
  return 'Unknown Exercise'
}

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

const HistoryLogModal: React.FC<HistoryLogModalProps> = ({
  visible,
  onClose,
  history,
  workouts,
}) => {
  const renderItem = ({ item }: { item: RepHistoryLog }) => (
    <StyledView className="bg-gray-700 p-3 rounded-lg mb-2">
      <StyledText className="text-white font-bold">
        {findExerciseName(item.exerciseId, workouts)}
      </StyledText>
      <StyledText className="text-gray-300">
        Set {item.setNumber}: {item.repsCompleted} reps at {item.weight} kg
      </StyledText>
      <StyledText className="text-gray-400 text-xs mt-1">
        {formatTimestamp(item.timestamp)}
      </StyledText>
    </StyledView>
  )

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <StyledView className="flex-1 justify-center items-center bg-black/50 p-4">
        <StyledView className="bg-gray-800 rounded-2xl shadow-lg p-4 w-full max-w-lg max-h-[90vh]">
          <StyledView className="flex-row justify-between items-center pb-4 border-b border-gray-700">
            <StyledText className="text-2xl font-bold text-white">
              History Log
            </StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <X color="#9ca3af" size={24} />
            </StyledTouchableOpacity>
          </StyledView>

          {history.length > 0 ? (
            <FlatList
              data={history.sort((a, b) => b.timestamp - a.timestamp)}
              renderItem={renderItem}
              keyExtractor={(item) => item.timestamp.toString()}
              className="mt-4"
            />
          ) : (
            <StyledView className="mt-4 items-center justify-center h-48">
              <StyledText className="text-gray-400 text-lg">
                No history yet.
              </StyledText>
            </StyledView>
          )}

          <StyledView className="flex-row justify-end pt-4 mt-4 border-t border-gray-700">
            <StyledTouchableOpacity
              onPress={onClose}
              className="py-2 px-6 bg-blue-600 rounded-lg">
              <StyledText className="font-semibold text-white">
                Close
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  )
}

export default HistoryLogModal