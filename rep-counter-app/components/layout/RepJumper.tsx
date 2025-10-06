import React from 'react'
import { View, Text } from 'react-native'
import { styled } from 'nativewind'
import NumberButton from '../NumberButton'
import { SharedValue } from 'react-native-reanimated'

const StyledView = styled(View)
const StyledText = styled(Text)

interface RepJumperProps {
  maxReps: number
  currentRep: SharedValue<number>
  jumpToRep: (rep: number) => void
}

const RepJumper: React.FC<RepJumperProps> = ({
  maxReps,
  currentRep,
  jumpToRep,
}) => {
  const renderNumberButtons = () => {
    const buttons = []
    for (let i = 1; i <= maxReps; i++) {
      buttons.push(
        <NumberButton
          key={i}
          number={i}
          onPress={() => jumpToRep(i)}
          currentRep={currentRep}
        />,
      )
    }
    return buttons
  }

  return (
    <StyledView>
      <StyledText className="text-sm font-medium text-gray-400 mb-4 text-center">
        Jump to Rep
      </StyledText>
      <StyledView className="flex-row flex-wrap justify-center gap-4">
        {renderNumberButtons()}
      </StyledView>
    </StyledView>
  )
}

export default RepJumper
