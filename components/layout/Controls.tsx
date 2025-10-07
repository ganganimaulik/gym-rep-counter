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
  runNextSet: () => void
  startWorkout: () => void
  stopWorkout: () => void
  pauseWorkout: () => void
  endSet: () => void
  addCountdownTime: () => void
  phase: string
}

const Controls: React.FC<ControlsProps> = ({
  isRunning,
  isResting,
  isPaused,
  runNextSet,
  startWorkout,
  stopWorkout,
  pauseWorkout,
  endSet,
  addCountdownTime,
  phase,
}) => {
  return (
    <StyledView className="flex-row gap-4">
      {(() => {
        if (!isRunning) {
          return (
            <StyledTouchableOpacity
              key="start"
              onPress={isResting ? runNextSet : startWorkout}
              className="p-4 rounded-lg flex-1 items-center bg-green-600">
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
                Restart
              </StyledText>
            </StyledTouchableOpacity>,
          ]
        }
        if (phase === 'Get Ready') {
          return [
            <StyledTouchableOpacity
              key="add-5s"
              onPress={addCountdownTime}
              className="p-4 bg-blue-500 rounded-lg flex-1 items-center">
              <StyledText className="text-lg font-semibold text-white">
                Add 5s
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="pause-countdown"
              onPress={pauseWorkout}
              className="p-4 bg-yellow-500 rounded-lg flex-1 items-center">
              <StyledText className="text-lg font-semibold text-white">
                Pause
              </StyledText>
            </StyledTouchableOpacity>,
            <StyledTouchableOpacity
              key="stop-countdown"
              onPress={stopWorkout}
              className="p-4 bg-red-600 rounded-lg flex-1 items-center">
              <StyledText className="text-lg font-semibold text-white">
                Cancel
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
              Restart
            </StyledText>
          </StyledTouchableOpacity>,
        ]
      })()}
    </StyledView>
  )
}

export default Controls
