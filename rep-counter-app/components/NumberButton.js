import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styled } from 'nativewind';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const StyledTouchableOpacity = styled(AnimatedTouchableOpacity);
const StyledText = styled(Text);

const NumberButton = ({ number, onPress, currentRep }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = Math.round(currentRep.value) === number;
    return {
      backgroundColor: isActive ? '#2563eb' : 'transparent',
      borderColor: isActive ? '#2563eb' : '#4b5563',
    };
  });

  return (
    <StyledTouchableOpacity
      onPress={onPress}
      className="p-3 border-2 rounded-lg items-center justify-center w-14 h-14"
      style={animatedStyle}
    >
      <StyledText className="text-white text-lg font-bold">
        {number}
      </StyledText>
    </StyledTouchableOpacity>
  );
};

export default NumberButton;