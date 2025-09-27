import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface NumberButtonsProps {
  maxReps: number;
  onJumpToRep: (rep: number) => void;
}

const NumberButtons = ({ maxReps, onJumpToRep }: NumberButtonsProps) => {
  const buttons = Array.from({ length: maxReps }, (_, i) => i + 1);

  return (
    <StyledView>
      <StyledText className="text-sm font-medium text-gray-400 mb-2 text-center">
        Jump to Rep
      </StyledText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <StyledView className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
          {buttons.map((rep) => (
            <StyledTouchableOpacity
              key={rep}
              className="w-12 h-12 border-2 border-gray-600 rounded-md items-center justify-center"
              onPress={() => onJumpToRep(rep)}
            >
              <StyledText className="text-white font-semibold text-lg">
                {rep}
              </StyledText>
            </StyledTouchableOpacity>
          ))}
        </StyledView>
      </ScrollView>
    </StyledView>
  );
};

export default NumberButtons;