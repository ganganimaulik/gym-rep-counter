import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Button,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { styled } from 'nativewind'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledBlurView = styled(BlurView)
const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView)
const StyledSafeAreaView = styled(SafeAreaView)

interface AddSetDetailsModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (reps: number, weight: number) => void
  initialReps: number
  exerciseName?: string
}

const AddSetDetailsModal: React.FC<AddSetDetailsModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialReps,
  exerciseName,
}) => {
  const [reps, setReps] = useState(initialReps.toString())
  const [weight, setWeight] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (isSubmitting) return
    const repsNum = parseInt(reps, 10)
    const weightNum = parseFloat(weight) || 0 // Default to 0 if weight is not entered
    if (!isNaN(repsNum)) {
      setIsSubmitting(true)
      // The parent hides the modal once the set is saved; calling onClose here
      // as well would trigger the dismiss path and log the set twice.
      onSubmit(repsNum, weightNum)
      setWeight('') // Reset for next time
    }
  }

  // Update reps state if initialReps prop changes
  React.useEffect(() => {
    setReps(initialReps.toString())
  }, [initialReps])

  // Reset isSubmitting and any leftover weight input when modal opens
  React.useEffect(() => {
    if (visible) {
      setIsSubmitting(false)
      setWeight('')
    }
  }, [visible])

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <StyledBlurView intensity={20} tint="dark" className="flex-1">
        <StyledSafeAreaView className="flex-1">
          <StyledKeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-center items-center">
            <StyledView className="bg-gray-800 p-6 rounded-lg w-11/12">
              <StyledText
                className={`text-white text-2xl font-bold text-center ${exerciseName ? 'mb-1' : 'mb-4'}`}>
                Set Complete
              </StyledText>
              {exerciseName ? (
                <StyledText
                  className="text-indigo-400 text-lg font-semibold mb-4 text-center"
                  testID="set-complete-exercise-name">
                  {exerciseName}
                </StyledText>
              ) : null}
              <StyledText className="text-gray-300 mb-2">Reps</StyledText>
              <StyledTextInput
                className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                testID="reps-input"
              />
              <StyledText className="text-gray-300 mb-2">
                Weight (kg)
              </StyledText>
              <StyledTextInput
                className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                autoFocus={true}
                testID="weight-input"
              />
              <Button
                title={isSubmitting ? 'Saving...' : 'Save'}
                onPress={handleSubmit}
                color="#4F46E5"
                disabled={isSubmitting}
              />
            </StyledView>
          </StyledKeyboardAvoidingView>
        </StyledSafeAreaView>
      </StyledBlurView>
    </Modal>
  )
}

export default AddSetDetailsModal
