import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface ControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  startWorkout: () => void;
  pauseWorkout: () => void;
  stopWorkout: () => void;
}

const Controls = ({
  isRunning,
  isPaused,
  startWorkout,
  pauseWorkout,
  stopWorkout,
}: ControlsProps) => {
  return (
    <StyledView className="flex-row w-full" style={{ gap: 16 }}>
      {!isRunning ? (
        <StyledTouchableOpacity
          className="py-3 px-4 bg-green-600 rounded-lg flex-1"
          onPress={startWorkout}
        >
          <StyledText className="text-white text-lg font-semibold text-center">
            Start
          </StyledText>
        </StyledTouchableOpacity>
      ) : (
        <StyledTouchableOpacity
          className="py-3 px-4 bg-yellow-500 rounded-lg flex-1"
          onPress={pauseWorkout}
        >
          <StyledText className="text-white text-lg font-semibold text-center">
            {isPaused ? 'Resume' : 'Pause'}
          </StyledText>
        </StyledTouchableOpacity>
      )}
      <StyledTouchableOpacity
        className="py-3 px-4 bg-red-600 rounded-lg flex-1"
        onPress={stopWorkout}
      >
        <StyledText className="text-white text-lg font-semibold text-center">
          Stop
        </StyledText>
      </StyledTouchableOpacity>
    </StyledView>
  );
};

export default Controls;