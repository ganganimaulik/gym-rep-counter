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
      className="p-2 border-2 rounded-md items-center justify-center"
      style={animatedStyle}
    >
      <StyledText className="text-white">{number}</StyledText>
    </StyledTouchableOpacity>
  );
};

export default NumberButton;