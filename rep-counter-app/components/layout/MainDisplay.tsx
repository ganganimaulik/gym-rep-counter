import React from 'react'
import { View, Text, TextInput } from 'react-native'
import { styled } from 'nativewind'
import Animated, {
  useAnimatedProps,
  SharedValue,
} from 'react-native-reanimated'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
const StyledAnimatedTextInput = styled(AnimatedTextInput)

interface MainDisplayProps {
  statusText: SharedValue<string>
  currentRep: SharedValue<number>
  currentSet: SharedValue<number>
  phase: string
  weight: number
  onWeightChange: (text: string) => void
  isWorkoutRunning: boolean
}

const MainDisplay: React.FC<MainDisplayProps> = ({
  statusText,
  currentRep,
  currentSet,
  phase,
  weight,
  onWeightChange,
  isWorkoutRunning,
}) => {
  const animatedRepProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentRep.value)),
    } as any
  }, [])

  const animatedSetProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentSet.value)),
    } as any
  }, [])

  const animatedStatusProps = useAnimatedProps(() => {
    return {
      text: statusText.value,
    } as any
  }, [])

  return (
    <StyledView className="items-center space-y-4">
      <StyledAnimatedTextInput
        className="text-2xl font-medium text-blue-400 text-center"
        editable={false}
        animatedProps={animatedStatusProps}
        defaultValue={statusText.value}
      />
      <StyledView className="flex-row justify-center items-end space-x-2">
        <StyledView className="items-center">
          <StyledAnimatedTextInput
            className="text-8xl font-bold tracking-tight text-white text-center"
            editable={false}
            animatedProps={animatedRepProps}
            defaultValue={String(Math.round(currentRep.value))}
          />
          <StyledText className="text-lg text-gray-400">REP</StyledText>
        </StyledView>
        <StyledView className="items-center pb-2">
          <StyledAnimatedTextInput
            className="text-6xl font-bold tracking-tight text-white text-center"
            editable={false}
            animatedProps={animatedSetProps}
            defaultValue={String(Math.round(currentSet.value))}
          />
          <StyledText className="text-lg text-gray-400">SET</StyledText>
        </StyledView>
        <StyledView className="items-center pb-2">
          <StyledTextInput
            className="text-6xl font-bold tracking-tight text-white text-center"
            value={String(weight)}
            onChangeText={onWeightChange}
            keyboardType="numeric"
            editable={!isWorkoutRunning}
            maxLength={4}
            contextMenuHidden
          />
          <StyledText className="text-lg text-gray-400">WEIGHT</StyledText>
        </StyledView>
      </StyledView>
      <StyledText className="text-xl text-gray-400">{phase || ' '}</StyledText>
    </StyledView>
  )
}

export default MainDisplay
