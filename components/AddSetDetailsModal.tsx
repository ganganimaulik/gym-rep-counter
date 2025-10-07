import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Button, StyleSheet, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledBlurView = styled(BlurView);

interface AddSetDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reps: number, weight: number) => void;
  initialReps: number;
}

const AddSetDetailsModal: React.FC<AddSetDetailsModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialReps,
}) => {
  const [reps, setReps] = useState(initialReps.toString());
  const [weight, setWeight] = useState('');

  const handleSubmit = () => {
    const repsNum = parseInt(reps, 10);
    const weightNum = parseInt(weight, 10) || 0; // Default to 0 if weight is not entered
    if (!isNaN(repsNum)) {
      onSubmit(repsNum, weightNum);
      setWeight(''); // Reset for next time
      onClose();
    }
  };

  // Update reps state if initialReps prop changes
  React.useEffect(() => {
    setReps(initialReps.toString());
  }, [initialReps]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <StyledBlurView intensity={20} tint="dark" className="flex-1 justify-center items-center">
        <StyledView className="bg-gray-800 p-6 rounded-lg w-11/12">
          <StyledText className="text-white text-2xl font-bold mb-4 text-center">
            Set Complete
          </StyledText>
          <StyledText className="text-gray-300 mb-2">Reps</StyledText>
          <StyledTextInput
            className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <StyledText className="text-gray-300 mb-2">Weight (kg)</StyledText>
          <StyledTextInput
            className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
            keyboardType="number-pad"
            value={weight}
            onChangeText={setWeight}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            autoFocus={true}
          />
          <Button title="Save" onPress={handleSubmit} color="#4F46E5" />
        </StyledView>
      </StyledBlurView>
    </Modal>
  );
};

export default AddSetDetailsModal;