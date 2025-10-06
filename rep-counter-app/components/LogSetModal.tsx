import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from 'react-native'
import { styled } from 'nativewind'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface LogSetModalProps {
  visible: boolean
  onClose: () => void
  onSave: (reps: number, weight: number) => void
  targetReps: number
}

const LogSetModal: React.FC<LogSetModalProps> = ({
  visible,
  onClose,
  onSave,
  targetReps,
}) => {
  const [reps, setReps] = useState(String(targetReps))
  const [weight, setWeight] = useState('')

  useEffect(() => {
    if (visible) {
      setReps(String(targetReps))
      setWeight('') // Reset weight when modal opens
    }
  }, [visible, targetReps])

  const handleSave = () => {
    const repsNum = parseInt(reps, 10)
    const weightNum = parseFloat(weight) || 0
    if (!isNaN(repsNum) && repsNum > 0) {
      onSave(repsNum, weightNum)
      onClose()
    }
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <StyledView className="flex-1 justify-center items-center bg-black/50">
        <StyledView className="w-11/12 bg-gray-800 rounded-2xl p-6 shadow-lg">
          <StyledText className="text-white text-2xl font-bold mb-4 text-center">
            Log Your Set
          </StyledText>

          <StyledView className="mb-4">
            <StyledText className="text-gray-300 text-base mb-2">
              Reps Completed
            </StyledText>
            <StyledTextInput
              className="bg-gray-700 text-white rounded-lg p-4 text-lg"
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </StyledView>

          <StyledView className="mb-6">
            <StyledText className="text-gray-300 text-base mb-2">
              Weight (kg)
            </StyledText>
            <StyledTextInput
              className="bg-gray-700 text-white rounded-lg p-4 text-lg"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </StyledView>

          <StyledView className="flex-row justify-around">
            <StyledTouchableOpacity
              className="bg-gray-600 rounded-lg py-3 px-8"
              onPress={onClose}>
              <StyledText className="text-white font-bold text-lg">
                Cancel
              </StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              className="bg-blue-500 rounded-lg py-3 px-8"
              onPress={handleSave}>
              <StyledText className="text-white font-bold text-lg">
                Save
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  )
}

export default LogSetModal