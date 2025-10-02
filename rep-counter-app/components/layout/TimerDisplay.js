import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

const TimerDisplay = ({ statusText, currentRep, currentSet, phase }) => {
  return (
    <StyledView className="items-center">
      <StyledText className="text-2xl font-medium text-blue-400 mb-2">
        {statusText}
      </StyledText>
      <StyledView className="flex-row justify-center items-end space-x-6">
        <StyledView>
          <StyledText className="text-8xl font-bold tracking-tight text-white">
            {currentRep}
          </StyledText>
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
      <StyledText className="text-xl text-gray-400 mt-2">
        {phase || ' '}
      </StyledText>
    </StyledView>
  );
};

export default TimerDisplay;