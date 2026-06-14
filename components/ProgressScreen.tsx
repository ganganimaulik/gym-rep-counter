import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { styled } from 'nativewind'
import {
  Flame,
  Trophy,
  TrendingUp,
  Scale,
  Trash2,
  Pencil,
} from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { TrendData, WeightLog } from '../declarations'
import { AnalyticsHook } from '../hooks/useAnalytics'
import { DataHook } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)

interface ProgressScreenProps {
  visible: boolean
  onClose: () => void
  user: FirebaseUser | null
  analyticsHook: AnalyticsHook
  dataHook: DataHook
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
  dataHook,
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

  const { weightLogs, addWeightLog, updateWeightLog, deleteWeightLog } =
    dataHook

  const [activeSubTab, setActiveSubTab] = useState<'workouts' | 'weight'>(
    'workouts',
  )

  // State for weight logs logging/editing modal
  const [weightModalVisible, setWeightModalVisible] = useState(false)
  const [editingLog, setEditingLog] = useState<WeightLog | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [dateValue, setDateValue] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

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

  const handleOpenAddWeight = () => {
    setEditingLog(null)
    setWeightInput('')
    setDateValue(new Date())
    setShowDatePicker(false)
    setWeightModalVisible(true)
  }

  const handleOpenEditWeight = (log: WeightLog) => {
    setEditingLog(log)
    setWeightInput(log.weight.toString())
    setDateValue(log.date.toDate())
    setShowDatePicker(false)
    setWeightModalVisible(true)
  }

  const handleSaveWeight = async () => {
    const weightNum = parseFloat(weightInput)
    if (isNaN(weightNum) || weightNum <= 0) return

    if (editingLog) {
      await updateWeightLog(editingLog.id, weightNum, dateValue, user)
    } else {
      await addWeightLog(weightNum, dateValue, user)
    }

    setWeightModalVisible(false)
    setEditingLog(null)
    setWeightInput('')
  }

  const handleDeleteWeight = async () => {
    if (!editingLog) return
    await deleteWeightLog(editingLog.id, user)
    setWeightModalVisible(false)
    setEditingLog(null)
    setWeightInput('')
  }

  const formatChartDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
    })
  }

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
        data:
          weeklyVolume.length > 0
            ? weeklyVolume.map((v) => v.totalVolume || 0)
            : [0],
      },
    ],
  }

  const trendsChartData = {
    labels: exerciseTrends.slice(-10).map((t) => formatDate(t.date)),
    datasets: [
      {
        data:
          exerciseTrends.length > 0
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

      {/* Tab Switcher */}
      <StyledView className="flex-row bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl mb-4">
        <StyledTouchableOpacity
          onPress={() => setActiveSubTab('workouts')}
          activeOpacity={0.8}
          className={`flex-1 py-2 rounded-lg items-center ${
            activeSubTab === 'workouts' ? 'bg-indigo-600 shadow-sm' : ''
          }`}>
          <StyledText
            className={`text-xs font-black uppercase tracking-wider ${
              activeSubTab === 'workouts' ? 'text-white' : 'text-zinc-400'
            }`}>
            Workout Trends
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => setActiveSubTab('weight')}
          activeOpacity={0.8}
          className={`flex-1 py-2 rounded-lg items-center ${
            activeSubTab === 'weight' ? 'bg-indigo-600 shadow-sm' : ''
          }`}>
          <StyledText
            className={`text-xs font-black uppercase tracking-wider ${
              activeSubTab === 'weight' ? 'text-white' : 'text-zinc-400'
            }`}>
            Body Weight
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>

      {activeSubTab === 'workouts' ? (
        isLoading ? (
          <StyledView className="flex-1 justify-center items-center mt-16">
            <ActivityIndicator size="large" color="#3b82f6" />
            <StyledText className="text-zinc-500 text-sm font-bold mt-4 uppercase tracking-wider">
              Analyzing training logs...
            </StyledText>
          </StyledView>
        ) : error ? (
          <StyledView className="flex-1 justify-center items-center p-4 mt-16">
            <StyledText className="text-red-400 text-center font-bold">
              {error}
            </StyledText>
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
                    }`}>
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
                    style={styles.picker}
                    dropdownIconColor="white">
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
                        color: (opacity = 1) =>
                          `rgba(16, 185, 129, ${opacity})`,
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
        )
      ) : (
        <StyledScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Log weight action button */}
          <StyledTouchableOpacity
            onPress={handleOpenAddWeight}
            activeOpacity={0.85}
            className="flex-row items-center justify-center bg-indigo-600 py-3.5 px-4 rounded-2xl mb-4 shadow-lg shadow-indigo-600/15">
            <Scale color="white" size={18} />
            <StyledText className="text-white text-sm font-black uppercase tracking-wider ml-2.5">
              Log Body Weight
            </StyledText>
          </StyledTouchableOpacity>

          {/* Body Weight Chart */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
            <StyledView className="flex-row items-center mb-1">
              <TrendingUp color="#6366f1" size={18} />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Weight Trend
              </StyledText>
            </StyledView>
            <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
              Body weight over time (kg)
            </StyledText>
            {weightLogs.length > 1 ? (
              <LineChart
                data={{
                  labels: [...weightLogs]
                    .reverse()
                    .slice(-7)
                    .map((log) => formatChartDate(log.date.toDate())),
                  datasets: [
                    {
                      data: [...weightLogs]
                        .reverse()
                        .slice(-7)
                        .map((log) => log.weight),
                    },
                  ],
                }}
                width={screenWidth}
                height={170}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: '#6366f1',
                  },
                }}
                bezier
                style={{ borderRadius: 12, marginLeft: -12 }}
              />
            ) : (
              <StyledView className="h-[170] justify-center items-center border border-dashed border-zinc-800 rounded-xl py-6">
                <Scale color="#3f3f46" size={36} />
                <StyledText className="text-zinc-500 text-xs italic text-center mt-3 px-4">
                  Log at least 2 entries to display weight progress chart.
                </StyledText>
              </StyledView>
            )}
          </StyledView>

          {/* Weight Logs List */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <StyledText className="text-sm font-black text-zinc-400 mb-3 tracking-wider uppercase">
              Weight Logs History
            </StyledText>
            {weightLogs.length === 0 ? (
              <StyledText className="text-zinc-500 text-xs italic text-center py-8">
                No weight logs yet. Log your first weight entry to get started!
              </StyledText>
            ) : (
              weightLogs.slice(0, 15).map((log, index) => (
                <StyledTouchableOpacity
                  key={log.id}
                  onPress={() => handleOpenEditWeight(log)}
                  activeOpacity={0.7}
                  className={`flex-row justify-between items-center py-3.5 ${
                    index < Math.min(weightLogs.length, 15) - 1
                      ? 'border-b border-zinc-800/60'
                      : ''
                  }`}>
                  <StyledView className="flex-row items-center">
                    <Scale color="#a1a1aa" size={16} />
                    <StyledText className="text-white font-extrabold text-base ml-3">
                      {log.weight} kg
                    </StyledText>
                  </StyledView>
                  <StyledView className="flex-row items-center">
                    <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mr-3">
                      {log.date.toDate().toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </StyledText>
                    <Pencil color="#71717a" size={12} />
                  </StyledView>
                </StyledTouchableOpacity>
              ))
            )}
          </StyledView>
        </StyledScrollView>
      )}

      {/* Log/Edit Weight Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={weightModalVisible}
        onRequestClose={() => setWeightModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <StyledView className="flex-1 justify-center items-center px-4 bg-black/60">
            <StyledView className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
              <StyledText className="text-white text-xl font-black mb-1 text-center">
                {editingLog ? 'Edit Weight Log' : 'Log Body Weight'}
              </StyledText>
              <StyledText className="text-zinc-500 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                Track your body weight progress
              </StyledText>

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Weight (kg)
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="e.g. 75.5"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                autoFocus={true}
              />

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Date
              </StyledText>
              {Platform.OS === 'ios' ? (
                <StyledView className="flex-row justify-between items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl mb-4">
                  <StyledText className="text-zinc-500 text-sm font-bold">
                    Select Date
                  </StyledText>
                  <DateTimePicker
                    value={dateValue}
                    mode="date"
                    display="compact"
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setDateValue(selectedDate)
                    }}
                    themeVariant="dark"
                  />
                </StyledView>
              ) : (
                <StyledTouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                  className="flex-row justify-between items-center bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl mb-4">
                  <StyledText className="text-white font-bold text-sm">
                    {dateValue.toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </StyledText>
                  <StyledText className="text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                    Change
                  </StyledText>
                </StyledTouchableOpacity>
              )}

              {Platform.OS !== 'ios' && showDatePicker && (
                <DateTimePicker
                  value={dateValue}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false)
                    if (selectedDate) {
                      setDateValue(selectedDate)
                    }
                  }}
                />
              )}

              <StyledView className="flex-row gap-3 mt-2">
                <StyledTouchableOpacity
                  onPress={() => setWeightModalVisible(false)}
                  activeOpacity={0.7}
                  className="flex-1 bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center">
                  <StyledText className="text-zinc-300 font-bold text-sm">
                    Cancel
                  </StyledText>
                </StyledTouchableOpacity>
                <StyledTouchableOpacity
                  onPress={handleSaveWeight}
                  activeOpacity={0.7}
                  className="flex-1 bg-indigo-600 py-3 rounded-xl items-center shadow-lg shadow-indigo-600/15">
                  <StyledText className="text-white font-bold text-sm">
                    Save
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>

              {editingLog && (
                <StyledTouchableOpacity
                  onPress={handleDeleteWeight}
                  activeOpacity={0.7}
                  className="mt-4 bg-red-950/20 border border-red-900/30 py-2.5 rounded-xl items-center flex-row justify-center">
                  <Trash2 color="#ef4444" size={16} />
                  <StyledText className="text-red-500 font-bold text-xs ml-2 uppercase tracking-wider">
                    Delete Log
                  </StyledText>
                </StyledTouchableOpacity>
              )}
            </StyledView>
          </StyledView>
        </KeyboardAvoidingView>
      </Modal>
    </StyledView>
  )
}

const styles = StyleSheet.create({
  // eslint-disable-next-line react-native/no-color-literals
  picker: {
    color: 'white',
  },
})

export default ProgressScreen
