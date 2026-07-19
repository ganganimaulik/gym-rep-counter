import React, { useEffect, useState, useMemo } from 'react'
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
  Alert,
} from 'react-native'
import { styled } from 'nativewind'
import { Flame, Trophy, TrendingUp, Trash2 } from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'

import type { User as FirebaseUser } from 'firebase/auth'
import type {
  ExerciseTrendSeries,
  WeightLog,
  CalorieLog,
  MeasurementLog,
} from '../declarations'
import { useAnalytics } from '../hooks/useAnalytics'
import { DataHook } from '../hooks/useData'
import TDEEScreen, { HealthLogGroup } from './TDEEScreen'
import { globalStyles } from '../utils/globalStyles'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)

interface ProgressScreenProps {
  visible: boolean
  onClose: () => void
  user: FirebaseUser | null
  dataHook: DataHook
}

const screenWidth = Dimensions.get('window').width - 32

const chartConfig = {
  backgroundGradientFrom: '#18181b',
  backgroundGradientTo: '#18181b',
  backgroundGradientFromOpacity: 0,
  backgroundGradientToOpacity: 0,
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
  dataHook,
}) => {
  // Analytics hook is initialized here so computations only run when this tab is active
  const analyticsHook = useAnalytics(dataHook)
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

  const {
    weightLogs,
    addWeightLog,
    updateWeightLog,
    deleteWeightLog,
    calorieLogs,
    addCalorieLog,
    updateCalorieLog,
    deleteCalorieLog,
    measurementLogs,
    addMeasurementLog,
    updateMeasurementLog,
    deleteMeasurementLog,
    tdeeConfig,
  } = dataHook

  const [activeSubTab, setActiveSubTab] = useState<'workouts' | 'health'>(
    'health',
  )

  const [healthLogsByDate, setHealthLogsByDate] = useState<HealthLogGroup[]>([])

  // State for logs logging/editing modal
  const [healthModalVisible, setHealthModalVisible] = useState(false)
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(
    null,
  )
  const [editingCalorieLog, setEditingCalorieLog] = useState<CalorieLog | null>(
    null,
  )
  const [editingMeasurementLog, setEditingMeasurementLog] =
    useState<MeasurementLog | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [calorieInput, setCalorieInput] = useState('')
  const [waistInput, setWaistInput] = useState('')
  const [neckInput, setNeckInput] = useState('')
  const [hipInput, setHipInput] = useState('')
  const [dateValue, setDateValue] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseTrends, setExerciseTrends] = useState<ExerciseTrendSeries[]>(
    [],
  )

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

  useEffect(() => {
    const map = new Map<string, HealthLogGroup>()
    const getDateStr = (d: Date) => d.toLocaleDateString()

    weightLogs.forEach((log) => {
      const d = log.date.toDate()
      const str = getDateStr(d)
      if (!map.has(str)) map.set(str, { dateStr: str, date: d })
      map.get(str)!.weightLog = log
    })

    calorieLogs.forEach((log) => {
      const d = log.date.toDate()
      const str = getDateStr(d)
      if (!map.has(str)) map.set(str, { dateStr: str, date: d })
      map.get(str)!.calorieLog = log
    })

    measurementLogs.forEach((log) => {
      const d = log.date.toDate()
      const str = getDateStr(d)
      if (!map.has(str)) map.set(str, { dateStr: str, date: d })
      map.get(str)!.measurementLog = log
    })

    setHealthLogsByDate(
      Array.from(map.values()).sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      ),
    )
  }, [weightLogs, calorieLogs, measurementLogs])

  const handleOpenAddHealth = () => {
    setEditingWeightLog(null)
    setEditingCalorieLog(null)
    setEditingMeasurementLog(null)
    setWeightInput('')
    setCalorieInput('')
    setWaistInput('')
    setNeckInput('')
    setHipInput('')
    setDateValue(new Date())
    setShowDatePicker(false)
    setHealthModalVisible(true)
  }

  const handleOpenEditHealth = (group: HealthLogGroup) => {
    setEditingWeightLog(group.weightLog || null)
    setEditingCalorieLog(group.calorieLog || null)
    setEditingMeasurementLog(group.measurementLog || null)
    setWeightInput(group.weightLog ? group.weightLog.weight.toString() : '')
    setCalorieInput(
      group.calorieLog ? group.calorieLog.calories.toString() : '',
    )
    setWaistInput(
      group.measurementLog ? group.measurementLog.waist.toString() : '',
    )
    setNeckInput(
      group.measurementLog ? group.measurementLog.neck.toString() : '',
    )
    setHipInput(
      group.measurementLog?.hip !== undefined
        ? group.measurementLog.hip.toString()
        : '',
    )
    setDateValue(group.date)
    setShowDatePicker(false)
    setHealthModalVisible(true)
  }

  const handleSaveHealth = async () => {
    const weightNum = parseFloat(weightInput)
    const calorieNum = parseInt(calorieInput, 10)
    const waistNum = parseFloat(waistInput)
    const neckNum = parseFloat(neckInput)
    const hipNum = parseFloat(hipInput)

    // A measurement entry needs both waist and neck (the BF% formula requires
    // both); hip is optional and only used for the female formula
    const hasMeasurement =
      !isNaN(waistNum) && waistNum > 0 && !isNaN(neckNum) && neckNum > 0
    if ((waistInput.trim() || neckInput.trim()) && !hasMeasurement) {
      Alert.alert(
        'Incomplete Measurements',
        'Please enter both waist and neck to log body measurements.',
      )
      return
    }
    const measurements = hasMeasurement
      ? {
          waist: waistNum,
          neck: neckNum,
          ...(!isNaN(hipNum) && hipNum > 0 ? { hip: hipNum } : {}),
        }
      : null

    const targetDateStr = dateValue.toLocaleDateString()
    const existingGroup = healthLogsByDate.find(
      (g) => g.dateStr === targetDateStr,
    )

    const movingWeightToExisting =
      editingWeightLog &&
      existingGroup?.weightLog &&
      editingWeightLog.id !== existingGroup.weightLog.id &&
      !isNaN(weightNum) &&
      weightNum > 0
    const movingCalorieToExisting =
      editingCalorieLog &&
      existingGroup?.calorieLog &&
      editingCalorieLog.id !== existingGroup.calorieLog.id &&
      !isNaN(calorieNum) &&
      calorieNum > 0
    const movingMeasurementToExisting =
      editingMeasurementLog &&
      existingGroup?.measurementLog &&
      editingMeasurementLog.id !== existingGroup.measurementLog.id &&
      measurements !== null

    if (
      movingWeightToExisting ||
      movingCalorieToExisting ||
      movingMeasurementToExisting
    ) {
      Alert.alert(
        'Duplicate Entry',
        'An entry for this date already exists. Please edit the existing entry instead.',
      )
      return
    }

    const promises = []

    if (!isNaN(weightNum) && weightNum > 0) {
      if (editingWeightLog) {
        promises.push(
          updateWeightLog(editingWeightLog.id, weightNum, dateValue, user),
        )
      } else if (existingGroup?.weightLog) {
        promises.push(
          updateWeightLog(
            existingGroup.weightLog.id,
            weightNum,
            dateValue,
            user,
          ),
        )
      } else {
        promises.push(addWeightLog(weightNum, dateValue, user))
      }
    }

    if (!isNaN(calorieNum) && calorieNum > 0) {
      if (editingCalorieLog) {
        promises.push(
          updateCalorieLog(editingCalorieLog.id, calorieNum, dateValue, user),
        )
      } else if (existingGroup?.calorieLog) {
        promises.push(
          updateCalorieLog(
            existingGroup.calorieLog.id,
            calorieNum,
            dateValue,
            user,
          ),
        )
      } else {
        promises.push(addCalorieLog(calorieNum, dateValue, user))
      }
    }

    if (measurements) {
      if (editingMeasurementLog) {
        promises.push(
          updateMeasurementLog(
            editingMeasurementLog.id,
            measurements,
            dateValue,
            user,
          ),
        )
      } else if (existingGroup?.measurementLog) {
        promises.push(
          updateMeasurementLog(
            existingGroup.measurementLog.id,
            measurements,
            dateValue,
            user,
          ),
        )
      } else {
        promises.push(addMeasurementLog(measurements, dateValue, user))
      }
    } else if (editingMeasurementLog) {
      // Cleared measurement fields while editing — remove the log
      promises.push(deleteMeasurementLog(editingMeasurementLog.id, user))
    }

    await Promise.all(promises)

    setHealthModalVisible(false)
    setEditingWeightLog(null)
    setEditingCalorieLog(null)
    setEditingMeasurementLog(null)
    setWeightInput('')
    setCalorieInput('')
    setWaistInput('')
    setNeckInput('')
    setHipInput('')
  }

  const handleDeleteHealth = async () => {
    const promises = []
    if (editingWeightLog) {
      promises.push(deleteWeightLog(editingWeightLog.id, user))
    }
    if (editingCalorieLog) {
      promises.push(deleteCalorieLog(editingCalorieLog.id, user))
    }
    if (editingMeasurementLog) {
      promises.push(deleteMeasurementLog(editingMeasurementLog.id, user))
    }
    await Promise.all(promises)

    setHealthModalVisible(false)
    setEditingWeightLog(null)
    setEditingCalorieLog(null)
    setEditingMeasurementLog(null)
    setWeightInput('')
    setCalorieInput('')
    setWaistInput('')
    setNeckInput('')
    setHipInput('')
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  // Kg and plates are separate measurement systems — each gets its own chart
  const hasKgVolume = useMemo(
    () => weeklyVolume.some((v) => (v.kgVolume || 0) > 0),
    [weeklyVolume],
  )
  const hasPlatesVolume = useMemo(
    () => weeklyVolume.some((v) => (v.platesVolume || 0) > 0),
    [weeklyVolume],
  )

  const kgVolumeChartData = useMemo(
    () => ({
      labels: weeklyVolume.map((v) => v.label),
      datasets: [
        {
          data:
            weeklyVolume.length > 0
              ? weeklyVolume.map((v) => v.kgVolume || 0)
              : [0],
        },
      ],
    }),
    [weeklyVolume],
  )

  const platesVolumeChartData = useMemo(
    () => ({
      labels: weeklyVolume.map((v) => v.label),
      datasets: [
        {
          data:
            weeklyVolume.length > 0
              ? weeklyVolume.map((v) => v.platesVolume || 0)
              : [0],
        },
      ],
    }),
    [weeklyVolume],
  )

  const trendChartSeries = useMemo(
    () =>
      exerciseTrends
        .filter((series) => series.data.length > 1)
        .map((series) => ({
          weightUnit: series.weightUnit,
          chartData: {
            labels: series.data.slice(-10).map((t) => formatDate(t.date)),
            datasets: [
              {
                data: series.data.slice(-10).map((t) => t.avgWeight || 0),
                color: (opacity = 1) =>
                  series.weightUnit === 'plates'
                    ? `rgba(245, 158, 11, ${opacity})`
                    : `rgba(99, 102, 241, ${opacity})`,
                strokeWidth: 2.5,
              },
            ],
          },
        })),
    [exerciseTrends],
  )

  const kgPrs = prs.filter((pr) => (pr.weightUnit ?? 'kg') === 'kg')
  const platePrs = prs.filter((pr) => pr.weightUnit === 'plates')

  if (!visible) return null

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
          onPress={() => setActiveSubTab('health')}
          activeOpacity={0.8}
          className={`flex-1 py-2 rounded-lg items-center ${
            activeSubTab === 'health' ? 'bg-emerald-600 shadow-sm' : ''
          }`}>
          <StyledText
            className={`text-xs font-black uppercase tracking-wider ${
              activeSubTab === 'health' ? 'text-white' : 'text-zinc-400'
            }`}>
            Health & TDEE
          </StyledText>
        </StyledTouchableOpacity>
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
                  <StyledText
                    testID="streak-current-count"
                    className="text-orange-400 text-3xl font-black">
                    {streak.currentStreak}
                  </StyledText>
                  <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                    Current
                  </StyledText>
                </StyledView>
                <StyledView className="items-center flex-1 border-x border-zinc-800/80">
                  <StyledText
                    testID="streak-longest-count"
                    className="text-indigo-400 text-3xl font-black">
                    {streak.longestStreak}
                  </StyledText>
                  <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                    Longest
                  </StyledText>
                </StyledView>
                <StyledView className="items-center flex-1">
                  <StyledText
                    testID="streak-weekly-count"
                    className="text-emerald-400 text-3xl font-black">
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

            {/* Weekly Volume Charts — one per weight unit in the history */}
            {(hasKgVolume || hasPlatesVolume) && (
              <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
                <StyledView className="flex-row items-center mb-1">
                  <TrendingUp color="#3b82f6" size={18} />
                  <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                    Weekly Volume
                  </StyledText>
                </StyledView>
                {hasKgVolume && (
                  <>
                    <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                      Total weight × reps per week (kg)
                    </StyledText>
                    <LineChart
                      data={kgVolumeChartData}
                      width={screenWidth - 20}
                      height={170}
                      chartConfig={chartConfig}
                      bezier
                      style={{
                        borderRadius: 12,
                        marginLeft: -40,
                        marginRight: -30,
                      }}
                    />
                  </>
                )}
                {hasPlatesVolume && (
                  <>
                    <StyledText
                      className={`text-zinc-500 text-[10px] font-semibold mb-3 ${
                        hasKgVolume ? 'mt-4' : ''
                      }`}>
                      Total plates × reps per week (plates)
                    </StyledText>
                    <LineChart
                      data={platesVolumeChartData}
                      width={screenWidth - 20}
                      height={170}
                      chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) =>
                          `rgba(245, 158, 11, ${opacity})`,
                        propsForDots: {
                          ...chartConfig.propsForDots,
                          stroke: '#f59e0b',
                        },
                      }}
                      bezier
                      style={{
                        borderRadius: 12,
                        marginLeft: -40,
                        marginRight: -30,
                      }}
                    />
                  </>
                )}
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
                // Kg and plates PRs aren't comparable, so they get their own
                // groups (labeled only when both units are present)
                [
                  { unit: 'kg', records: kgPrs },
                  { unit: 'plates', records: platePrs },
                ]
                  .filter((group) => group.records.length > 0)
                  .map((group, _, groups) => (
                    <StyledView key={group.unit}>
                      {groups.length > 1 && (
                        <StyledText className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mt-2">
                          {group.unit}
                        </StyledText>
                      )}
                      {group.records.slice(0, 5).map((pr, index) => (
                        <StyledView
                          key={`${pr.exerciseId}-${pr.weightUnit ?? 'kg'}`}
                          className={`flex-row justify-between items-center py-3 ${
                            index < group.records.slice(0, 5).length - 1
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
                              {pr.maxWeight} {pr.weightUnit ?? 'kg'}
                            </StyledText>
                            <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              × {pr.repsAtMax} reps
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      ))}
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
                    testID="trends-exercise-picker"
                    selectedValue={selectedExercise}
                    onValueChange={setSelectedExercise}
                    style={globalStyles.picker}
                    itemStyle={globalStyles.pickerItem}
                    dropdownIconColor="white">
                    {exercises.map((ex) => (
                      <Picker.Item key={ex.id} label={ex.name} value={ex.id} />
                    ))}
                  </Picker>
                </StyledView>
                {trendChartSeries.length > 0 ? (
                  trendChartSeries.map((series) => (
                    <StyledView key={series.weightUnit}>
                      <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                        Average weight trend (last 10 sessions,{' '}
                        {series.weightUnit})
                      </StyledText>
                      <LineChart
                        data={series.chartData}
                        width={screenWidth - 20}
                        height={170}
                        chartConfig={{
                          ...chartConfig,
                          color: (opacity = 1) =>
                            series.weightUnit === 'plates'
                              ? `rgba(245, 158, 11, ${opacity})`
                              : `rgba(16, 185, 129, ${opacity})`,
                        }}
                        bezier
                        style={{
                          borderRadius: 12,
                          marginLeft: -40,
                          marginRight: -30,
                        }}
                      />
                    </StyledView>
                  ))
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
        <TDEEScreen
          user={user}
          dataHook={dataHook}
          onLogPress={handleOpenAddHealth}
          onEditLogPress={handleOpenEditHealth}
        />
      )}

      {/* Log/Edit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={healthModalVisible}
        onRequestClose={() => setHealthModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <StyledView className="flex-1 justify-center items-center px-4 bg-black/60">
            <StyledView className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
              <StyledText className="text-white text-xl font-black mb-1 text-center">
                {editingWeightLog || editingCalorieLog || editingMeasurementLog
                  ? 'Edit Daily Stats'
                  : 'Log Daily Stats'}
              </StyledText>
              <StyledText className="text-zinc-500 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                Track your health progress
              </StyledText>

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Weight (kg)
              </StyledText>
              <StyledTextInput
                testID="health-weight-input"
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="e.g. 75.5"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Calories (kcal)
              </StyledText>
              <StyledTextInput
                testID="health-calories-input"
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="numeric"
                value={calorieInput}
                onChangeText={setCalorieInput}
                placeholder="e.g. 2500"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Measurements (
                {tdeeConfig?.measurementUnit === 'cm' ? 'cm' : 'in'}, optional)
              </StyledText>
              <StyledView className="flex-row gap-3 mb-4">
                <StyledView className="flex-1">
                  <StyledTextInput
                    testID="health-waist-input"
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                    keyboardType="numeric"
                    value={waistInput}
                    onChangeText={setWaistInput}
                    placeholder="Waist"
                    placeholderTextColor="#52525b"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </StyledView>
                <StyledView className="flex-1">
                  <StyledTextInput
                    testID="health-neck-input"
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                    keyboardType="numeric"
                    value={neckInput}
                    onChangeText={setNeckInput}
                    placeholder="Neck"
                    placeholderTextColor="#52525b"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </StyledView>
                {tdeeConfig?.gender === 'female' && (
                  <StyledView className="flex-1">
                    <StyledTextInput
                      testID="health-hip-input"
                      className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                      keyboardType="numeric"
                      value={hipInput}
                      onChangeText={setHipInput}
                      placeholder="Hips"
                      placeholderTextColor="#52525b"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </StyledView>
                )}
              </StyledView>

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
                  onPress={() => setHealthModalVisible(false)}
                  activeOpacity={0.7}
                  className="flex-1 bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center">
                  <StyledText className="text-zinc-300 font-bold text-sm">
                    Cancel
                  </StyledText>
                </StyledTouchableOpacity>
                <StyledTouchableOpacity
                  testID="save-health-button"
                  onPress={handleSaveHealth}
                  activeOpacity={0.7}
                  className="flex-1 bg-indigo-600 py-3 rounded-xl items-center shadow-lg shadow-indigo-600/15">
                  <StyledText className="text-white font-bold text-sm">
                    Save
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>

              {(editingWeightLog ||
                editingCalorieLog ||
                editingMeasurementLog) && (
                <StyledTouchableOpacity
                  testID="delete-health-button"
                  onPress={handleDeleteHealth}
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
export default ProgressScreen
