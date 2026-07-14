import React from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import Animated, {
  useAnimatedProps,
  SharedValue,
} from 'react-native-reanimated'

const StyledView = styled(View)
const StyledText = styled(Text)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
const StyledAnimatedTextInput = styled(AnimatedTextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface MainDisplayProps {
  statusText: SharedValue<string>
  currentRep: SharedValue<number>
  currentSet: SharedValue<number>
  phase: string
  addCountdownTime: () => void
}

const getPhaseColor = (currentPhase: string) => {
  const p = (currentPhase || '').toLowerCase()
  if (p.includes('concentric')) {
    return {
      text: 'text-cyan-400',
      border: 'border-cyan-500',
      glow: 'bg-cyan-950/20',
      colorCode: '#22d3ee',
    }
  }
  if (p.includes('eccentric')) {
    return {
      text: 'text-indigo-400',
      border: 'border-indigo-500',
      glow: 'bg-indigo-950/20',
      colorCode: '#818cf8',
    }
  }
  if (p.includes('rest')) {
    return {
      text: 'text-amber-500',
      border: 'border-amber-500',
      glow: 'bg-amber-950/20',
      colorCode: '#fbbf24',
    }
  }
  if (p.includes('ready') || p.includes('countdown') || p.includes('get')) {
    return {
      text: 'text-purple-400',
      border: 'border-purple-500',
      glow: 'bg-purple-950/20',
      colorCode: '#c084fc',
    }
  }
  return {
    text: 'text-zinc-500',
    border: 'border-zinc-800',
    glow: 'bg-zinc-900/40',
    colorCode: '#3f3f46',
  }
}

const MainDisplay: React.FC<MainDisplayProps> = ({
  statusText,
  currentRep,
  currentSet,
  phase,
  addCountdownTime,
}) => {
  const animatedRepProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentRep.value)),
    } as Record<string, string> as never
  }, [])

  const animatedSetProps = useAnimatedProps(() => {
    return {
      text: String(Math.round(currentSet.value)),
    } as Record<string, string> as never
  }, [])

  const animatedStatusProps = useAnimatedProps(() => {
    return {
      text: statusText.value,
    } as Record<string, string> as never
  }, [])

  const handlePress = () => {
    if (phase === 'Get Ready') {
      addCountdownTime()
    }
  }

  const colors = getPhaseColor(phase)

  return (
    <StyledView className="items-center py-6">
      <StyledTouchableOpacity
        testID="main-display-pressable"
        onPress={handlePress}
        activeOpacity={phase === 'Get Ready' ? 0.7 : 1}>
        <StyledView
          className={`w-60 h-60 rounded-full border-4 ${colors.border} ${colors.glow} items-center justify-center relative`}
          style={{
            shadowColor: colors.colorCode,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}>
          {/* Top Badge: Phase name */}
          <StyledView className="absolute top-8">
            <StyledText
              className={`text-xs font-black tracking-[0.25em] uppercase ${colors.text}`}>
              {phase || 'Stopped'}
            </StyledText>
          </StyledView>

          {/* Main Display Area */}
          <StyledView className="items-center justify-center mt-2">
            {phase === 'Rest' || phase === 'Get Ready' || !phase ? (
              <StyledAnimatedTextInput
                testID="main-display-status"
                className="text-3xl font-black text-white text-center w-52"
                editable={false}
                pointerEvents="none"
                animatedProps={animatedStatusProps}
                defaultValue={statusText.value}
                multiline={true}
              />
            ) : (
              <StyledView className="items-center">
                <StyledAnimatedTextInput
                  testID="main-display-reps"
                  className="text-8xl font-black text-white text-center h-24 w-40"
                  editable={false}
                  pointerEvents="none"
                  animatedProps={animatedRepProps}
                  defaultValue={String(Math.round(currentRep.value))}
                />
                <StyledText className="text-zinc-500 text-xs font-black tracking-[0.15em] mt-1">
                  REP
                </StyledText>
              </StyledView>
            )}
          </StyledView>

          {/* Bottom Badge: Set number */}
          {!!phase && phase !== 'Rest' && (
            <StyledView className="absolute bottom-8 flex-row items-center justify-center space-x-1">
              <StyledText className="text-zinc-500 text-xs font-bold tracking-wider">
                SET
              </StyledText>
              <StyledAnimatedTextInput
                testID="main-display-sets"
                className="text-zinc-300 text-sm font-black text-center w-8"
                editable={false}
                pointerEvents="none"
                animatedProps={animatedSetProps}
                defaultValue={String(Math.round(currentSet.value))}
              />
            </StyledView>
          )}
        </StyledView>
      </StyledTouchableOpacity>

      {phase === 'Get Ready' && (
        <StyledText className="text-zinc-500 text-[10px] font-bold tracking-wider mt-3 uppercase">
          Tap circle to add +5 seconds
        </StyledText>
      )}
    </StyledView>
  )
}

export default React.memo(MainDisplay)
