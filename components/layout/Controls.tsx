import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
} from 'lucide-react-native'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface ControlsProps {
  isRunning: boolean
  isResting: boolean
  isRestComplete: boolean
  isPaused: boolean
  runNextSet: () => void
  startWorkout: () => void
  stopWorkout: () => void
  pauseWorkout: () => void
  endSet: () => void
}

const Controls: React.FC<ControlsProps> = ({
  isRunning,
  isResting,
  isRestComplete,
  isPaused,
  runNextSet,
  startWorkout,
  stopWorkout,
  pauseWorkout,
  endSet,
}) => {
  return (
    <StyledView className="flex-row justify-center items-center gap-4 w-full px-2 py-4">
      {(() => {
        if (!isRunning) {
          return (
            <StyledTouchableOpacity
              key="start"
              onPress={isResting ? runNextSet : startWorkout}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center py-4 px-6 rounded-2xl flex-1 ${
                isResting
                  ? isRestComplete
                    ? 'bg-emerald-600'
                    : 'bg-amber-500'
                  : 'bg-emerald-600'
              } shadow-lg shadow-emerald-600/20`}>
              {isResting ? (
                isRestComplete ? (
                  <>
                    <Play color="white" size={20} fill="white" />
                    <StyledText className="text-white text-base font-bold ml-2 tracking-wide uppercase">
                      Start Next Set
                    </StyledText>
                  </>
                ) : (
                  <>
                    <SkipForward color="white" size={20} />
                    <StyledText className="text-white text-base font-bold ml-2 tracking-wide uppercase">
                      Skip Rest
                    </StyledText>
                  </>
                )
              ) : (
                <>
                  <Play color="white" size={20} fill="white" />
                  <StyledText className="text-white text-base font-bold ml-2 tracking-wide uppercase">
                    Start Workout
                  </StyledText>
                </>
              )}
            </StyledTouchableOpacity>
          )
        }
        if (isPaused) {
          return [
            <StyledTouchableOpacity
              key="resume"
              onPress={pauseWorkout}
              activeOpacity={0.8}
              className="flex-row items-center justify-center py-4 px-6 rounded-2xl flex-[2] bg-emerald-600 shadow-lg shadow-emerald-600/20">
              <Play color="white" size={20} fill="white" />
              <StyledText className="text-white text-base font-bold ml-2 tracking-wide uppercase">
                Resume
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="stop-paused"
              onPress={stopWorkout}
              activeOpacity={0.8}
              className="flex-row items-center justify-center py-4 px-4 rounded-2xl flex-1 bg-zinc-800 border border-zinc-700">
              <RotateCcw color="#ef4444" size={20} />
              <StyledText className="text-red-500 text-sm font-bold ml-1.5 uppercase">
                Reset
              </StyledText>
            </StyledTouchableOpacity>,
          ]
        }
        // isRunning && !isPaused
        return [
          <StyledTouchableOpacity
            key="pause"
            onPress={pauseWorkout}
            activeOpacity={0.8}
            className="flex-row items-center justify-center py-4 px-4 rounded-2xl flex-1 bg-amber-500 shadow-lg shadow-amber-500/20">
            <Pause color="white" size={20} fill="white" />
            <StyledText className="text-white text-sm font-bold ml-1.5 uppercase">
              Pause
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="end-set"
            onPress={endSet}
            activeOpacity={0.8}
            className="flex-row items-center justify-center py-4 px-6 rounded-2xl flex-[2] bg-blue-600 shadow-lg shadow-blue-600/20">
            <CheckCircle2 color="white" size={20} />
            <StyledText className="text-white text-base font-bold ml-2 tracking-wide uppercase">
              End Set
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="stop-running"
            onPress={stopWorkout}
            activeOpacity={0.8}
            className="flex-row items-center justify-center py-4 px-4 rounded-2xl flex-1 bg-zinc-950 border border-zinc-800">
            <RotateCcw color="#ef4444" size={18} />
            <StyledText className="text-red-500 text-[11px] font-bold ml-1 uppercase">
              Reset
            </StyledText>
          </StyledTouchableOpacity>,
        ]
      })()}
    </StyledView>
  )
}

export default React.memo(Controls)
