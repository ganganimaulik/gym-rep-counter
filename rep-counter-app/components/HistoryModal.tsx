import React from 'react'
import { Modal, View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { styled } from 'nativewind'
import { X } from 'lucide-react-native'
import HistoryView from './HistoryView'
import { RepHistoryLog, Workout } from '../hooks/useData'

const StyledSafeAreaView = styled(SafeAreaView)
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface HistoryModalProps {
  visible: boolean
  onClose: () => void
  history: RepHistoryLog[]
  workouts: Workout[]
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  history,
  workouts,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}>
      <StyledSafeAreaView className="flex-1 bg-gray-900">
        <StyledView className="flex-1 p-4">
          <StyledView className="flex-row justify-between items-center mb-4">
            <StyledText className="text-white text-3xl font-bold">
              Workout History
            </StyledText>
            <StyledTouchableOpacity onPress={onClose} className="p-2">
              <X color="white" size={28} />
            </StyledTouchableOpacity>
          </StyledView>
          <HistoryView history={history} workouts={workouts} />
        </StyledView>
      </StyledSafeAreaView>
    </Modal>
  )
}

export default HistoryModal
