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
  onEditLastSet: () => void
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
  onEditLastSet,
}) => {
  return (
    <StyledView className="flex-row gap-4">
      {(() => {
        if (!isRunning) {
          if (isResting) {
            return [
              <StyledTouchableOpacity
                key="next-set"
                onPress={runNextSet}
                className="p-4 rounded-lg flex-1 items-center bg-green-600">
                <StyledText className="text-lg font-semibold text-white">
                  Next Set
                </StyledText>
              </StyledTouchableOpacity>,
              <StyledTouchableOpacity
                key="edit-last-set"
                onPress={onEditLastSet}
                className="p-4 rounded-lg flex-1 items-center bg-gray-500">
                <StyledText className="text-lg font-semibold text-white">
                  Edit Last Set
                </StyledText>
              </StyledTouchableOpacity>,
            ]
          }
          return (
            <StyledTouchableOpacity
              key="start"
              onPress={startWorkout}
              className="p-4 rounded-lg flex-1 items-center bg-green-600">
              <StyledText className="text-lg font-semibold text-white">
                Start
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
