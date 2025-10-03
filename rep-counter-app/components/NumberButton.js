import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styled } from 'nativewind';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const AnimatedView = Animated.createAnimatedComponent(StyledTouchableOpacity);

const NumberButton = ({ number, onPress, currentRep }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = currentRep.value === number;
    const backgroundColor = isActive ? '#2563eb' : 'transparent'; // bg-blue-600 or transparent
    const borderColor = isActive ? '#2563eb' : '#4b5563'; // border-blue-600 or border-gray-600

    return {
      backgroundColor,
      borderColor,
    };
  });

  return (
    <AnimatedView
      onPress={onPress}
      style={animatedStyle}
      className="p-2 border-2 rounded-md items-center justify-center"
    >
      <StyledText className="text-white">{number}</StyledText>
    </AnimatedView>
  );
};

export default NumberButton;