import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface ControlsProps {
  isRunning: boolean
  isResting: boolean
  isPaused: boolean
  isSetCompleted: boolean
  runNextSet: () => void
  startWorkout: () => void
  stopWorkout: () => void
  pauseWorkout: () => void
  endSet: () => void
}

const Controls: React.FC<ControlsProps> = ({
  isRunning,
  isResting,
  isPaused,
  isSetCompleted,
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
          return (
            <StyledTouchableOpacity
              key="start"
              onPress={isResting ? runNextSet : startWorkout}
              disabled={isSetCompleted}
              className={`p-4 rounded-lg flex-1 items-center ${
                isSetCompleted ? 'bg-gray-500' : 'bg-green-600'
              }`}>
              <StyledText className="text-lg font-semibold text-white">
                {isResting ? 'Next Set' : 'Start'}
              </StyledText>
            </StyledTouchableOpacity>
          )
        }
        if (isPaused) {
          return [
            <StyledTouchableOpacity
              key="resume"
              onPress={pauseWorkout}
              className="p-4 bg-yellow-500 rounded-lg flex-1 items-center">
              <StyledText className="text-lg font-semibold text-white">
                Resume
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="stop-paused"
              onPress={stopWorkout}
              className="p-4 bg-red-600 rounded-lg flex-1 items-center">
              <StyledText className="text-lg font-semibold text-white">
                Restart Set
              </StyledText>
            </StyledTouchableOpacity>,
          ]
        }
        // isRunning && !isPaused
        return [
          <StyledTouchableOpacity
            key="pause"
            onPress={pauseWorkout}
            className="p-4 bg-yellow-500 rounded-lg flex-1 items-center">
            <StyledText className="text-lg font-semibold text-white">
              Pause
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="end-set"
            onPress={endSet}
            className="p-4 bg-blue-600 rounded-lg flex-1 items-center">
            <StyledText className="text-lg font-semibold text-white">
              End Set
            </StyledText>
          </StyledTouchableOpacity>,
          <StyledTouchableOpacity
            key="stop-running"
            onPress={stopWorkout}
            className="p-4 bg-red-600 rounded-lg flex-1 items-center">
            <StyledText className="text-lg font-semibold text-white">
              Restart Set
            </StyledText>
          </StyledTouchableOpacity>,
        ]
      })()}
    </StyledView>
  )
}

export default Controls
