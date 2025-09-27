import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);

const NumberButton = ({ number, onPress, isActive }) => {
  return (
    <StyledTouchableOpacity
      onPress={onPress}
      className={`p-2 border-2 border-gray-600 rounded-md items-center justify-center ${isActive ? 'bg-blue-600 border-blue-600' : ''}`}
    >
      <StyledText className={`text-white ${isActive ? 'font-bold' : ''}`}>{number}</StyledText>
    </StyledTouchableOpacity>
  );
};

export default NumberButton;