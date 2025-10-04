import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { styled } from 'nativewind';
import Animated, { useAnimatedProps } from 'react-native-reanimated';

const StyledView = styled(View);
const StyledText = styled(Text);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const StyledAnimatedTextInput = styled(AnimatedTextInput);

const MainDisplay = ({ statusText, currentRep, currentSet, phase }) => {
  const animatedRepProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentRep.value)),
    };
  }, []);

  const animatedSetProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentSet.value)),
    };
  }, []);

  const animatedStatusProps = useAnimatedProps(() => {
    return {
      text: statusText.value,
    };
  }, []);

  return (
    <StyledView className="items-center space-y-4">
      <StyledAnimatedTextInput
        className="text-2xl font-medium text-blue-400 text-center"
        editable={false}
        animatedProps={animatedStatusProps}
        value={statusText.value}
      />
      <StyledView className="flex-row justify-center items-end space-x-4">
        <StyledView className="items-center">
          <StyledAnimatedTextInput
            className="text-8xl font-bold tracking-tight text-white"
            editable={false}
            animatedProps={animatedRepProps}
            value={String(Math.round(currentRep.value))} // Initial value
          />
          <StyledText className="text-lg text-gray-400">REP</StyledText>
        </StyledView>
        <StyledView className="items-center pb-2">
          <StyledAnimatedTextInput
            className="text-6xl font-bold tracking-tight text-white"
            editable={false}
            animatedProps={animatedSetProps}
            value={String(Math.round(currentSet.value))} // Initial value
          />
          <StyledText className="text-lg text-gray-400">SET</StyledText>
        </StyledView>
      </StyledView>
      <StyledText className="text-xl text-gray-400">{phase || ' '}</StyledText>
    </StyledView>
  );
};

export default MainDisplay;