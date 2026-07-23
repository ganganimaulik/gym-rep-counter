import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { styled } from 'nativewind'
import type { WeightUnit } from '../declarations'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledBlurView = styled(BlurView)
const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView)
const StyledSafeAreaView = styled(SafeAreaView)

interface AddSetDetailsModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (
    reps: number,
    weight: number,
    weightUnit: WeightUnit,
    variant?: string,
  ) => void
  initialReps: number
  exerciseName?: string
  // Default unit for this exercise (from the routine config); the user can
  // still switch units for an individual set.
  defaultWeightUnit?: WeightUnit
  // Variants configured on the exercise (e.g. ["Standing", "Sitting"]).
  variants?: string[]
}

const AddSetDetailsModal: React.FC<AddSetDetailsModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialReps,
  exerciseName,
  defaultWeightUnit = 'kg',
  variants,
}) => {
  const [reps, setReps] = useState(initialReps.toString())
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(defaultWeightUnit)
  const [variant, setVariant] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (isSubmitting) return
    const repsNum = parseInt(reps, 10)
    const weightNum = parseFloat(weight) || 0 // Default to 0 if weight is not entered
    if (!isNaN(repsNum)) {
      setIsSubmitting(true)
      // The parent hides the modal once the set is saved; calling onClose here
      // as well would trigger the dismiss path and log the set twice.
      onSubmit(repsNum, weightNum, weightUnit, variant)
      setWeight('') // Reset for next time
    }
  }

  // Reset per-set state when the modal opens (or when its defaults change
  // while open). Reps resets here too so a remembered rep count is shown every
  // time and a previous edit doesn't linger across opens.
  React.useEffect(() => {
    if (visible) {
      setIsSubmitting(false)
      setReps(initialReps.toString())
      setWeight('')
      setWeightUnit(defaultWeightUnit)
      setVariant(undefined)
    }
  }, [visible, defaultWeightUnit, initialReps])

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
              {variants && variants.length > 0 ? (
                <>
                  <StyledText className="text-gray-300 mb-2">
                    Variant
                  </StyledText>
                  <StyledView className="flex-row flex-wrap gap-2 mb-4">
                    {variants.map((v) => (
                      <StyledTouchableOpacity
                        key={v}
                        testID={`variant-option-${v}`}
                        onPress={() =>
                          setVariant((prev) => (prev === v ? undefined : v))
                        }
                        activeOpacity={0.7}
                        className={`px-3 py-2 rounded-lg border ${
                          variant === v
                            ? 'bg-indigo-600 border-indigo-500'
                            : 'bg-gray-700 border-gray-600'
                        }`}>
                        <StyledText
                          className={`text-sm font-semibold ${
                            variant === v ? 'text-white' : 'text-gray-300'
                          }`}>
                          {v}
                        </StyledText>
                      </StyledTouchableOpacity>
                    ))}
                  </StyledView>
                </>
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
              <StyledView className="flex-row justify-between items-center mb-2">
                <StyledText className="text-gray-300">
                  Weight ({weightUnit})
                </StyledText>
                <StyledView className="flex-row bg-gray-700 rounded-lg overflow-hidden">
                  {(['kg', 'plates'] as WeightUnit[]).map((unit) => (
                    <StyledTouchableOpacity
                      key={unit}
                      testID={`weight-unit-${unit}`}
                      onPress={() => setWeightUnit(unit)}
                      activeOpacity={0.7}
                      className={`px-3 py-1.5 ${
                        weightUnit === unit ? 'bg-indigo-600' : ''
                      }`}>
                      <StyledText
                        className={`text-xs font-bold uppercase ${
                          weightUnit === unit ? 'text-white' : 'text-gray-400'
                        }`}>
                        {unit}
                      </StyledText>
                    </StyledTouchableOpacity>
                  ))}
                </StyledView>
              </StyledView>
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
