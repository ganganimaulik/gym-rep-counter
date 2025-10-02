import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';
import NumberButton from '../NumberButton';

const StyledView = styled(View);
const StyledText = styled(Text);

const RepJumper = ({ maxReps, onJumpToRep, currentRep }) => {
  const renderNumberButtons = () => {
    let buttons = [];
    for (let i = 1; i <= maxReps; i++) {
      buttons.push(
        <NumberButton
          key={i}
          number={i}
          onPress={() => onJumpToRep(i)}
          isActive={currentRep === i}
        />,
      );
    }
    return buttons;
  };

  return (
    <StyledView>
      <StyledText className="text-sm font-medium text-gray-400 mb-2 text-center">
        Jump to Rep
      </StyledText>
      <StyledView className="flex-row flex-wrap justify-center gap-2">
        {renderNumberButtons()}
      </StyledView>
    </StyledView>
  );
};

export default RepJumper;