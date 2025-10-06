import React, { useMemo } from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { styled } from 'nativewind'
import { RepHistoryLog, Workout } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)

interface HistoryViewProps {
  history: RepHistoryLog[]
  workouts: Workout[]
  loadMoreHistory: () => void
  isLoading: boolean
  hasMore: boolean
}

type ListItem = { type: 'date'; date: string } | { type: 'log'; log: RepHistoryLog }

const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  workouts,
  loadMoreHistory,
  isLoading,
  hasMore,
}) => {
  const getExerciseName = (exerciseId: string): string => {
    for (const workout of workouts) {
      const exercise = workout.exercises.find((ex) => ex.id === exerciseId)
      if (exercise) {
        return exercise.name
      }
    }
    return 'Unknown Exercise'
  }

  const sections = useMemo(() => {
    const grouped: { [key: string]: RepHistoryLog[] } = {}
    history.forEach((log) => {
      const dateStr = log.date.toDate().toISOString().split('T')[0]
      if (!grouped[dateStr]) {
        grouped[dateStr] = []
      }
      grouped[dateStr].push(log)
    })

    const flatListItems: ListItem[] = []
    Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .forEach((date) => {
        flatListItems.push({ type: 'date', date })
        grouped[date]
          .sort((a, b) => b.setNumber - a.setNumber)
          .forEach((log) => {
            flatListItems.push({ type: 'log', log })
          })
      })
    return flatListItems
  }, [history])

  if (history.length === 0 && !isLoading) {
    return (
      <StyledView className="flex-1 justify-center items-center p-4">
        <StyledText className="text-gray-400 text-lg">
          No workout history yet.
        </StyledText>
      </StyledView>
    )
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'date') {
      return (
        <StyledView className="mt-6 mb-3">
          <StyledText className="text-white text-xl font-bold border-b border-gray-600 pb-2">
            {new Date(item.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC', // Ensure date is not shifted by local timezone
            })}
          </StyledText>
        </StyledView>
      )
    }

    const { log } = item
    return (
      <StyledView className="bg-gray-800 rounded-lg p-3 mb-2 flex-row justify-between items-center">
        <StyledView className="flex-1">
          <StyledText className="text-white font-semibold text-base">
            {getExerciseName(log.exerciseId)}
          </StyledText>
          <StyledText className="text-gray-300">Set {log.setNumber}</StyledText>
        </StyledView>
        <StyledView className="items-end">
          <StyledText className="text-white text-base">{log.reps} reps</StyledText>
          <StyledText className="text-gray-400">at {log.weight} kg</StyledText>
        </StyledView>
      </StyledView>
    )
  }

  const renderFooter = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" color="#fff" className="my-4" />
    }
    if (!hasMore && history.length > 0) {
      return (
        <StyledText className="text-center text-gray-500 py-4">
          No more history
        </StyledText>
      )
    }
    return null
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(item, index) =>
        item.type === 'date' ? item.date : item.log.id || index.toString()
      }
      renderItem={renderItem}
      onEndReached={loadMoreHistory}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  )
}

export default HistoryView