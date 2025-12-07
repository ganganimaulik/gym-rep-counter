import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native'
import { styled } from 'nativewind'
import { X, Flame, Trophy, TrendingUp } from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { TrendData } from '../declarations'
import { AnalyticsHook } from '../hooks/useAnalytics'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledSafeAreaView = styled(SafeAreaView)
const StyledScrollView = styled(ScrollView)

interface ProgressScreenProps {
  visible: boolean
  onClose: () => void
  user: FirebaseUser | null
  analyticsHook: AnalyticsHook
}

const screenWidth = Dimensions.get('window').width - 64

const chartConfig = {
  backgroundGradientFrom: '#1f2937',
  backgroundGradientTo: '#1f2937',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#3b82f6',
  },
}

const ProgressScreen: React.FC<ProgressScreenProps> = ({
  visible,
  onClose,
  user,
  analyticsHook,
}) => {
  const {
    isLoading,
    error,
    prs,
    streak,
    weeklyVolume,
    exercises,
    getExerciseTrends,
    refreshAnalytics,
  } = analyticsHook

  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseTrends, setExerciseTrends] = useState<TrendData[]>([])

  useEffect(() => {
    if (visible) {
      refreshAnalytics(user)
    }
  }, [visible, user, refreshAnalytics])

  useEffect(() => {
    if (exercises.length > 0 && !selectedExercise) {
      setSelectedExercise(exercises[0].id)
    }
  }, [exercises, selectedExercise])

  useEffect(() => {
    if (selectedExercise) {
      setExerciseTrends(getExerciseTrends(selectedExercise))
    }
  }, [selectedExercise, getExerciseTrends])

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  const volumeChartData = {
    labels: weeklyVolume.map((v) => v.label),
    datasets: [
      {
        data: weeklyVolume.length > 0 
          ? weeklyVolume.map((v) => v.totalVolume || 0)
          : [0],
      },
    ],
  }

  const trendsChartData = {
    labels: exerciseTrends.slice(-10).map((t) => formatDate(t.date)),
    datasets: [
      {
        data: exerciseTrends.length > 0 
          ? exerciseTrends.slice(-10).map((t) => t.avgWeight || 0)
          : [0],
        color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <StyledSafeAreaView className="flex-1 bg-gray-900">
        <StyledView className="flex-row justify-between items-center p-4 border-b border-gray-700">
          <StyledText className="text-white text-2xl font-bold">
            Progress Analytics
          </StyledText>
          <X color="white" size={30} onPress={onClose} />
        </StyledView>

        {isLoading ? (
          <StyledView className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#60a5fa" />
            <StyledText className="text-gray-400 mt-4">
              Loading analytics...
            </StyledText>
          </StyledView>
        ) : error ? (
          <StyledView className="flex-1 justify-center items-center p-4">
            <StyledText className="text-red-400 text-center">{error}</StyledText>
          </StyledView>
        ) : (
          <StyledScrollView className="flex-1 p-4">
            {/* Streak Section */}
            <StyledView className="bg-gray-800 rounded-xl p-4 mb-4">
              <StyledView className="flex-row items-center mb-2">
                <Flame color="#f97316" size={24} />
                <StyledText className="text-white text-lg font-bold ml-2">
                  Workout Streak
                </StyledText>
              </StyledView>
              <StyledView className="flex-row justify-between items-center">
                <StyledView className="items-center flex-1">
                  <StyledText className="text-orange-400 text-4xl font-bold">
                    {streak.currentStreak}
                  </StyledText>
                  <StyledText className="text-gray-400 text-sm">
                    Week Streak
                  </StyledText>
                </StyledView>
                <StyledView className="items-center flex-1">
                  <StyledText className="text-blue-400 text-4xl font-bold">
                    {streak.longestStreak}
                  </StyledText>
                  <StyledText className="text-gray-400 text-sm">
                    Best Streak
                  </StyledText>
                </StyledView>
                <StyledView className="items-center flex-1">
                  <StyledText className="text-green-400 text-4xl font-bold">
                    {streak.currentWeekWorkouts}
                  </StyledText>
                  <StyledText className="text-gray-400 text-sm">
                    This Week
                  </StyledText>
                </StyledView>
              </StyledView>
              <StyledText className="text-gray-500 text-xs text-center mt-2">
                Workout 5+ days per week to maintain streak
              </StyledText>
            </StyledView>

            {/* Weekly Volume Chart */}
            {weeklyVolume.length > 0 && (
              <StyledView className="bg-gray-800 rounded-xl p-4 mb-4">
                <StyledView className="flex-row items-center mb-3">
                  <TrendingUp color="#60a5fa" size={24} />
                  <StyledText className="text-white text-lg font-bold ml-2">
                    Weekly Volume
                  </StyledText>
                </StyledView>
                <StyledText className="text-gray-400 text-sm mb-2">
                  Total weight × reps per week
                </StyledText>
                <LineChart
                  data={volumeChartData}
                  width={screenWidth}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={{ borderRadius: 8, marginLeft: -16 }}
                />
              </StyledView>
            )}

            {/* Personal Records */}
            <StyledView className="bg-gray-800 rounded-xl p-4 mb-4">
              <StyledView className="flex-row items-center mb-3">
                <Trophy color="#fbbf24" size={24} />
                <StyledText className="text-white text-lg font-bold ml-2">
                  Personal Records
                </StyledText>
              </StyledView>
              {prs.length === 0 ? (
                <StyledText className="text-gray-400 text-center py-4">
                  Complete some workouts to see your PRs!
                </StyledText>
              ) : (
                prs.slice(0, 5).map((pr, index) => (
                  <StyledView
                    key={pr.exerciseId}
                    className={`flex-row justify-between items-center py-3 ${
                      index < prs.slice(0, 5).length - 1
                        ? 'border-b border-gray-700'
                        : ''
                    }`}
                  >
                    <StyledView className="flex-1">
                      <StyledText className="text-white font-medium">
                        {pr.exerciseName}
                      </StyledText>
                      <StyledText className="text-gray-500 text-xs">
                        {formatDate(pr.date.toDate())}
                      </StyledText>
                    </StyledView>
                    <StyledView className="items-end">
                      <StyledText className="text-yellow-400 font-bold text-lg">
                        {pr.maxWeight} kg
                      </StyledText>
                      <StyledText className="text-gray-400 text-xs">
                        × {pr.repsAtMax} reps
                      </StyledText>
                    </StyledView>
                  </StyledView>
                ))
              )}
            </StyledView>

            {/* Exercise Trends */}
            {exercises.length > 0 && (
              <StyledView className="bg-gray-800 rounded-xl p-4 mb-8">
                <StyledView className="flex-row items-center mb-3">
                  <TrendingUp color="#10b981" size={24} />
                  <StyledText className="text-white text-lg font-bold ml-2">
                    Exercise Trends
                  </StyledText>
                </StyledView>
                <StyledView className="bg-gray-700 rounded-lg mb-3">
                  <Picker
                    selectedValue={selectedExercise}
                    onValueChange={setSelectedExercise}
                    style={{ color: 'white' }}
                    dropdownIconColor="white"
                  >
                    {exercises.map((ex) => (
                      <Picker.Item key={ex.id} label={ex.name} value={ex.id} />
                    ))}
                  </Picker>
                </StyledView>
                {exerciseTrends.length > 1 ? (
                  <>
                    <StyledText className="text-gray-400 text-sm mb-2">
                      Average weight trend (last 10 sessions)
                    </StyledText>
                    <LineChart
                      data={trendsChartData}
                      width={screenWidth}
                      height={180}
                      chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                      }}
                      bezier
                      style={{ borderRadius: 8, marginLeft: -16 }}
                    />
                  </>
                ) : (
                  <StyledText className="text-gray-400 text-center py-4">
                    Need more data to show trends for this exercise.
                  </StyledText>
                )}
              </StyledView>
            )}
          </StyledScrollView>
        )}
      </StyledSafeAreaView>
    </Modal>
  )
}

export default ProgressScreen
