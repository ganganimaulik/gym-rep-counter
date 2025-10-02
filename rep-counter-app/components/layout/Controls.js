import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const Controls = ({
  isRunning,
  isResting,
  isPaused,
  runNextSet,
  startWorkout,
  stopWorkout,
  pauseWorkout,
  endSet,
}) => {
  return (
    <StyledView className="flex-row gap-4">
      {(() => {
        if (!isRunning) {
          return [
            <StyledTouchableOpacity
              key="start"
              onPress={isResting ? runNextSet : startWorkout}
              className="py-3 px-4 bg-green-600 rounded-lg flex-1 items-center"
            >
              <StyledText className="text-lg font-semibold text-white">
                Start
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="stop"
              onPress={stopWorkout}
              className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
            >
              <StyledText className="text-lg font-semibold text-white">
                Stop
              </StyledText>
            </StyledTouchableOpacity>,
          ];
        }
        if (isPaused) {
          return [
            <StyledTouchableOpacity
              key="resume"
              onPress={pauseWorkout}
              className="py-3 px-4 bg-yellow-500 rounded-lg flex-1 items-center"
            >
              <StyledText className="text-lg font-semibold text-white">
                Resume
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="stop-paused"
              onPress={stopWorkout}
              className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
            >
              <StyledText className="text-lg font-semibold text-white">
                Stop
              </StyledText>
            </StyledTouchableOpacity>,
          ];
        }
        // isRunning && !isPaused
        return [
          <StyledTouchableOpacity
            key="pause"
            onPress={pauseWorkout}
            className="py-3 px-4 bg-yellow-500 rounded-lg flex-1 items-center"
          >
            <StyledText className="text-lg font-semibold text-white">
              Pause
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="end-set"
            onPress={endSet}
            className="py-3 px-4 bg-blue-600 rounded-lg flex-1 items-center"
          >
            <StyledText className="text-lg font-semibold text-white">
              End Set
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="stop-running"
            onPress={stopWorkout}
            className="py-3 px-4 bg-red-600 rounded-lg flex-1 items-center"
          >
            <StyledText className="text-lg font-semibold text-white">
              Stop
            </StyledText>
          </StyledTouchableOpacity>,
        ];
      })()}
    </StyledView>
  );
};

export default Controls;