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

  return (
    <StyledView className="items-center mt-4">
      <StyledText className="text-2xl font-medium text-blue-400 mb-2">
        {statusText}
      </StyledText>
      <StyledView className="flex-row justify-center items-end space-x-6">
        <StyledView>
          <StyledAnimatedTextInput
            className="text-8xl font-bold tracking-tight text-white"
            editable={false}
            animatedProps={animatedRepProps}
            value={String(Math.round(currentRep.value))} // Initial value
          />
          <StyledText className="text-lg text-gray-400 text-center">
            REP
          </StyledText>
        </StyledView>
        <StyledView className="pb-2">
          <StyledAnimatedTextInput
            className="text-6xl font-bold tracking-tight text-white"
            editable={false}
            animatedProps={animatedSetProps}
            value={String(Math.round(currentSet.value))} // Initial value
          />
          <StyledText className="text-lg text-gray-400 text-center">
            SET
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledText className="text-xl text-gray-400 mt-2">
        {phase || ' '}
      </StyledText>
    </StyledView>
  );
};

export default MainDisplay;