import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { styled } from 'nativewind';
import Animated, { useAnimatedProps } from 'react-native-reanimated';

// Create an animated component for TextInput
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledAnimatedTextInput = styled(AnimatedTextInput);

// Custom component to handle animated text updates
const AnimatedTextDisplay = ({ animatedProps, style, ...props }) => {
  return (
    <StyledAnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      value="0" // Initial value
      style={style}
      animatedProps={animatedProps}
      {...props}
    />
  );
};

const MainDisplay = ({ statusText, currentRep, currentSet, phase }) => {
  const animatedStatusProps = useAnimatedProps(() => {
    return {
      text: statusText.value,
    };
  });

  const animatedRepProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(currentRep.value)}`,
    };
  });

  const animatedPhaseProps = useAnimatedProps(() => {
    return {
      text: phase.value || ' ',
    };
  });

  return (
    <StyledView className="items-center mt-4">
      <AnimatedTextDisplay
        animatedProps={animatedStatusProps}
        style={{
          fontSize: 24,
          fontWeight: '500',
          color: '#60a5fa', // text-blue-400
          marginBottom: 8,
          textAlign: 'center',
        }}
      />
      <StyledView className="flex-row justify-center items-end space-x-6">
        <StyledView>
          <AnimatedTextDisplay
            animatedProps={animatedRepProps}
            style={{
              fontSize: 88, // text-8xl
              fontWeight: 'bold',
              letterSpacing: -2, // tracking-tight
              color: '#ffffff', // text-white
              textAlign: 'center',
            }}
          />
          <StyledText className="text-lg text-gray-400 text-center">
            REP
          </StyledText>
        </StyledView>
        <StyledView className="pb-2">
          <StyledText className="text-6xl font-bold tracking-tight text-white">
            {currentSet}
          </StyledText>
          <StyledText className="text-lg text-gray-400 text-center">
            SET
          </StyledText>
        </StyledView>
      </StyledView>
      <AnimatedTextDisplay
        animatedProps={animatedPhaseProps}
        style={{
          fontSize: 20, // text-xl
          color: '#9ca3af', // text-gray-400
          marginTop: 8,
          textAlign: 'center',
        }}
      />
    </StyledView>
  );
};

export default MainDisplay;