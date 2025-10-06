import React from 'react'
import { ScrollView, View, Text } from 'react-native'
import { styled } from 'nativewind'
import { RepHistoryLog, Workout } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)

interface HistoryViewProps {
  history: RepHistoryLog[]
  workouts: Workout[]
}

interface GroupedHistory {
  [date: string]: RepHistoryLog[]
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, workouts }) => {
  const getExerciseName = (exerciseId: string): string => {
    for (const workout of workouts) {
      const exercise = workout.exercises.find((ex) => ex.id === exerciseId)
      if (exercise) {
        return exercise.name
      }
    }
    return 'Unknown Exercise'
  }

  const groupedHistory = history.reduce((acc, log) => {
    const date = log.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(log)
    return acc
  }, {} as GroupedHistory)

  const sortedDates = Object.keys(groupedHistory).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )

  if (history.length === 0) {
    return (
      <StyledView className="flex-1 justify-center items-center p-4">
        <StyledText className="text-gray-400 text-lg">
          No workout history yet.
        </StyledText>
      </StyledView>
    )
  }

  return (
    <StyledScrollView contentContainerStyle={{ paddingBottom: 20 }}>
      {sortedDates.map((date) => (
        <StyledView key={date} className="mb-6">
          <StyledText className="text-white text-xl font-bold mb-3 border-b border-gray-600 pb-2">
            {new Date(date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </StyledText>
          {groupedHistory[date].map((log, index) => (
            <StyledView
              key={index}
              className="bg-gray-700 rounded-lg p-3 mb-2 flex-row justify-between items-center">
              <StyledView className="flex-1">
                <StyledText className="text-white font-semibold text-base">
                  {getExerciseName(log.exerciseId)}
                </StyledText>
                <StyledText className="text-gray-300">
                  Set {log.setNumber}
                </StyledText>
              </StyledView>
              <StyledView className="items-end">
                <StyledText className="text-white text-base">
                  {log.reps} reps
                </StyledText>
                <StyledText className="text-gray-400">
                  at {log.weight} kg
                </StyledText>
              </StyledView>
            </StyledView>
          ))}
        </StyledView>
      ))}
    </StyledScrollView>
  )
}

export default HistoryView
