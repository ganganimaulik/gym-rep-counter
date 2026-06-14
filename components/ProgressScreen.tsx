import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { styled } from 'nativewind'
import { Flame, Trophy, TrendingUp } from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { TrendData } from '../declarations'
import { AnalyticsHook } from '../hooks/useAnalytics'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)

interface ProgressScreenProps {
  visible: boolean
  onClose: () => void
  user: FirebaseUser | null
  analyticsHook: AnalyticsHook
}

const screenWidth = Dimensions.get('window').width - 32

const chartConfig = {
  backgroundGradientFrom: '#18181b',
  backgroundGradientTo: '#18181b',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(161, 161, 170, ${opacity})`,
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

  if (!visible) return null

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
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 2.5,
      },
    ],
  }

  return (
    <StyledView className="flex-1 bg-zinc-950 p-4">
      {/* Header */}
      <StyledView className="flex-row justify-between items-center pb-3 border-b border-zinc-900 mb-4">
        <StyledText className="text-2xl font-black text-white">
          ANALYTICS
        </StyledText>
      </StyledView>

      {isLoading ? (
        <StyledView className="flex-1 justify-center items-center mt-16">
          <ActivityIndicator size="large" color="#3b82f6" />
          <StyledText className="text-zinc-500 text-sm font-bold mt-4 uppercase tracking-wider">
            Analyzing training logs...
          </StyledText>
        </StyledView>
      ) : error ? (
        <StyledView className="flex-1 justify-center items-center p-4 mt-16">
          <StyledText className="text-red-400 text-center font-bold">{error}</StyledText>
        </StyledView>
      ) : (
        <StyledScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Streak Section */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
            <StyledView className="flex-row items-center mb-3">
              <Flame color="#fb923c" size={18} fill="#fb923c" />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Activity Streak
              </StyledText>
            </StyledView>
            <StyledView className="flex-row justify-between items-center py-2">
              <StyledView className="items-center flex-1">
                <StyledText className="text-orange-400 text-3xl font-black">
                  {streak.currentStreak}
                </StyledText>
                <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                  Current
                </StyledText>
              </StyledView>
              <StyledView className="items-center flex-1 border-x border-zinc-800/80">
                <StyledText className="text-indigo-400 text-3xl font-black">
                  {streak.longestStreak}
                </StyledText>
                <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                  Longest
                </StyledText>
              </StyledView>
              <StyledView className="items-center flex-1">
                <StyledText className="text-emerald-400 text-3xl font-black">
                  {streak.currentWeekWorkouts}
                </StyledText>
                <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                  This Week
                </StyledText>
              </StyledView>
            </StyledView>
            <StyledText className="text-zinc-500 text-[9px] font-bold text-center mt-3 uppercase tracking-wider">
              Workout 5+ days per week to maintain streak
            </StyledText>
          </StyledView>

          {/* Weekly Volume Chart */}
          {weeklyVolume.length > 0 && (
            <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
              <StyledView className="flex-row items-center mb-1">
                <TrendingUp color="#3b82f6" size={18} />
                <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                  Weekly Volume
                </StyledText>
              </StyledView>
              <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                Total weight × reps per week (kg)
              </StyledText>
              <LineChart
                data={volumeChartData}
                width={screenWidth}
                height={170}
                chartConfig={chartConfig}
                bezier
                style={{ borderRadius: 12, marginLeft: -12 }}
              />
            </StyledView>
          )}

          {/* Personal Records */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
            <StyledView className="flex-row items-center mb-3">
              <Trophy color="#fbbf24" size={18} fill="#fbbf24" />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Personal Records
              </StyledText>
            </StyledView>
            {prs.length === 0 ? (
              <StyledText className="text-zinc-500 text-xs italic text-center py-4">
                Complete sets to establish your PRs!
              </StyledText>
            ) : (
              prs.slice(0, 5).map((pr, index) => (
                <StyledView
                  key={pr.exerciseId}
                  className={`flex-row justify-between items-center py-3 ${
                    index < prs.slice(0, 5).length - 1
                      ? 'border-b border-zinc-800/60'
                      : ''
                  }`}
                >
                  <StyledView className="flex-1 mr-2">
                    <StyledText className="text-white font-bold text-sm">
                      {pr.exerciseName}
                    </StyledText>
                    <StyledText className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
                      {formatDate(pr.date.toDate())}
                    </StyledText>
                  </StyledView>
                  <StyledView className="items-end">
                    <StyledText className="text-yellow-400 font-black text-base">
                      {pr.maxWeight} kg
                    </StyledText>
                    <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                      × {pr.repsAtMax} reps
                    </StyledText>
                  </StyledView>
                </StyledView>
              ))
            )}
          </StyledView>

          {/* Exercise Trends */}
          {exercises.length > 0 && (
            <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
              <StyledView className="flex-row items-center mb-3">
                <TrendingUp color="#10b981" size={18} />
                <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                  Exercise Trends
                </StyledText>
              </StyledView>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-3 overflow-hidden">
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
                  <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                    Average weight trend (last 10 sessions)
                  </StyledText>
                  <LineChart
                    data={trendsChartData}
                    width={screenWidth}
                    height={170}
                    chartConfig={{
                      ...chartConfig,
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                    }}
                    bezier
                    style={{ borderRadius: 12, marginLeft: -12 }}
                  />
                </>
              ) : (
                <StyledText className="text-zinc-500 text-xs italic text-center py-4">
                  Need more data to show trends for this exercise.
                </StyledText>
              )}
            </StyledView>
          )}
        </StyledScrollView>
      )}
    </StyledView>
  )
}

export default ProgressScreen
