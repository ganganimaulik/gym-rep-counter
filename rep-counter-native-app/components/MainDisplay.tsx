import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

interface MainDisplayProps {
  rep: number;
  set: number;
  status: string;
  phase: string;
}

const MainDisplay = ({ rep, set, status, phase }: MainDisplayProps) => {
  return (
    <StyledView className="items-center">
      <StyledText className="text-2xl font-medium text-blue-400 mb-2">
        {status}
      </StyledText>
      <StyledView className="flex-row items-end space-x-6">
        <StyledView className="items-center">
          <StyledText className="text-8xl font-bold tracking-tight text-white">
            {rep}
          </StyledText>
          <StyledText className="text-lg text-gray-400">REP</StyledText>
        </StyledView>
        <StyledView className="items-center pb-2">
          <StyledText className="text-6xl font-bold tracking-tight text-white">
            {set}
          </StyledText>
          <StyledText className="text-lg text-gray-400">SET</StyledText>
        </StyledView>
      </StyledView>
      <StyledText className="text-xl text-gray-400 mt-2 capitalize">
        {phase || '\u00A0'}
      </StyledText>
    </StyledView>
  );
};

export default MainDisplay;