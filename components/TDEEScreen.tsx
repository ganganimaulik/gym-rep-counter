import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Keyboard,
  StyleSheet,
  Alert,
} from 'react-native'
import { styled } from 'nativewind'
import {
  Zap,
  Target,
  TrendingUp,
  Scale,
  Settings2,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { TDEEConfig } from '../declarations'
import { useTDEE } from '../hooks/useTDEE'
import { DataHook } from '../hooks/useData'
import { globalStyles } from '../utils/globalStyles'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)

interface TDEEScreenProps {
  user: FirebaseUser | null
  dataHook: DataHook
}

const screenWidth = Dimensions.get('window').width - 32

const tdeeChartConfig = {
  backgroundGradientFrom: '#18181b',
  backgroundGradientTo: '#18181b',
  backgroundGradientFromOpacity: 0,
  backgroundGradientToOpacity: 0,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(161, 161, 170, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#10b981',
  },
}

const formatWeekDate = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const formatWeekRange = (start: Date, end: Date): string =>
  `${formatWeekDate(start)} – ${formatWeekDate(end)}`

const TDEEScreen: React.FC<TDEEScreenProps> = ({ user, dataHook }) => {
  const {
    weightLogs,
    calorieLogs,
    tdeeConfig,
    saveTDEEConfig,
    loadTDEEConfig,
    addWeightLog,
    addCalorieLog,
    deleteTDEEConfig,
  } = dataHook

  // Compute TDEE from logs + config
  const tdeeData = useTDEE(weightLogs, calorieLogs, tdeeConfig)

  // Load config on mount
  useEffect(() => {
    loadTDEEConfig()
  }, [loadTDEEConfig])

  // ── Setup state ──
  const [setupWeightUnit, setSetupWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [setupEnergyUnit, setSetupEnergyUnit] = useState<'cal' | 'kj'>('cal')

  // ── Goal settings state ──
  const [goalExpanded, setGoalExpanded] = useState(false)
  const [goalWeightInput, setGoalWeightInput] = useState('')
  const [goalRateInput, setGoalRateInput] = useState('')

  // Sync goal inputs when config loads
  useEffect(() => {
    if (tdeeConfig) {
      setGoalWeightInput(tdeeConfig.goalWeight?.toString() ?? '')
      setGoalRateInput(tdeeConfig.goalWeeklyRate?.toString() ?? '')
      setSetupWeightUnit(tdeeConfig.weightUnit ?? 'kg')
      setSetupEnergyUnit(tdeeConfig.energyUnit ?? 'cal')
    }
  }, [tdeeConfig])

  // ── Quick log state ──
  const [logWeight, setLogWeight] = useState('')
  const [logCalories, setLogCalories] = useState('')

  // ── Handlers ──

  const handleStartTracking = useCallback(async () => {
    const config: TDEEConfig = {
      weightUnit: setupWeightUnit,
      energyUnit: setupEnergyUnit,
      smoothingWindowWeeks: 12,
    }
    await saveTDEEConfig(config, user)
  }, [setupWeightUnit, setupEnergyUnit, saveTDEEConfig, user])

  const handleSaveGoals = useCallback(async () => {
    if (!tdeeConfig) return

    let gw: number | undefined
    let rate: number | undefined

    if (goalWeightInput.trim()) {
      gw = parseFloat(goalWeightInput)
      if (isNaN(gw) || gw <= 0) {
        Alert.alert('Invalid Goal Weight', 'Please enter a valid goal weight.')
        return
      }
    }

    if (goalRateInput.trim()) {
      rate = parseFloat(goalRateInput)
      if (isNaN(rate) || rate <= 0) {
        Alert.alert('Invalid Rate', 'Please enter a valid weekly rate.')
        return
      }
    }

    const updatedConfig: TDEEConfig = {
      ...tdeeConfig,
      weightUnit: setupWeightUnit,
      energyUnit: setupEnergyUnit,
      goalWeight: gw,
      goalWeeklyRate: rate,
    }

    await saveTDEEConfig(updatedConfig, user)
    Alert.alert('Saved', 'Settings updated successfully.')
  }, [tdeeConfig, goalWeightInput, goalRateInput, setupWeightUnit, setupEnergyUnit, saveTDEEConfig, user])

  const handleQuickLog = useCallback(async () => {
    const weightNum = parseFloat(logWeight)
    const calorieNum = parseInt(logCalories, 10)

    if ((isNaN(weightNum) || weightNum <= 0) && (isNaN(calorieNum) || calorieNum <= 0)) {
      Alert.alert('Missing Data', 'Enter at least a weight or calorie value.')
      return
    }

    const promises: Promise<void>[] = []
    if (!isNaN(weightNum) && weightNum > 0) {
      promises.push(addWeightLog(weightNum, new Date(), user))
    }
    if (!isNaN(calorieNum) && calorieNum > 0) {
      promises.push(addCalorieLog(calorieNum, new Date(), user))
    }

    await Promise.all(promises)

    setLogWeight('')
    setLogCalories('')
    Keyboard.dismiss()
    Alert.alert('Logged', 'Daily stats saved successfully.')
  }, [logWeight, logCalories, addWeightLog, addCalorieLog, user])

  // ── Chart data ──

  const tdeeChartData = useMemo(() => {
    const weeksWithTDEE = tdeeData.weeks.filter((w) => w.displayTDEE !== null)
    if (weeksWithTDEE.length === 0) {
      return { labels: [''], datasets: [{ data: [0] }] }
    }

    // Take last 12 weeks max
    const sliced = weeksWithTDEE.slice(-12)
    return {
      labels: sliced.map((w) => formatWeekDate(w.weekStart)),
      datasets: [
        {
          data: sliced.map((w) => w.displayTDEE!),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2.5,
        },
      ],
    }
  }, [tdeeData.weeks])

  // ── Weekly breakdown ──

  const weeklyBreakdown = useMemo(() => {
    return [...tdeeData.weeks]
      .filter((w) => w.avgWeight !== null || w.avgCalories !== null)
      .reverse()
      .slice(0, 8)
  }, [tdeeData.weeks])

  // ── Derived display values ──

  const weightUnit = tdeeConfig?.weightUnit ?? 'kg'
  const energyUnit = tdeeConfig?.energyUnit ?? 'cal'
  const energyLabel = energyUnit === 'cal' ? 'Cal' : 'kJ'
  const isConfigured = tdeeConfig !== null

  // ── Render ──

  return (
    <StyledScrollView
      className="flex-1 bg-zinc-950"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16, paddingTop: 8 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── Setup Card ─── */}
      {!isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-3">
            <Settings2 color="#10b981" size={18} />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              Setup TDEE Tracker
            </StyledText>
          </StyledView>

          <StyledText className="text-zinc-500 text-xs font-bold mb-4">
            Select your preferred units to get started. Your TDEE will be calculated adaptively from
            your daily weight and calorie logs.
          </StyledText>

          <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
            Weight Unit
          </StyledText>
          <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
            <Picker
              selectedValue={setupWeightUnit}
              onValueChange={setSetupWeightUnit}
              style={globalStyles.picker}
              itemStyle={globalStyles.pickerItem}
              dropdownIconColor="white"
            >
              <Picker.Item label="Kilograms (kg)" value="kg" />
              <Picker.Item label="Pounds (lb)" value="lb" />
            </Picker>
          </StyledView>

          <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
            Energy Unit
          </StyledText>
          <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
            <Picker
              selectedValue={setupEnergyUnit}
              onValueChange={setSetupEnergyUnit}
              style={globalStyles.picker}
              itemStyle={globalStyles.pickerItem}
              dropdownIconColor="white"
            >
              <Picker.Item label="Calories (cal)" value="cal" />
              <Picker.Item label="Kilojoules (kJ)" value="kj" />
            </Picker>
          </StyledView>

          <StyledView className="mb-4" />

          <StyledTouchableOpacity
            onPress={handleStartTracking}
            activeOpacity={0.85}
            className="bg-emerald-600 py-3 rounded-xl items-center shadow-lg"
          >
            <StyledText className="text-white text-sm font-black uppercase tracking-wider">
              Start Tracking
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      )}

      {/* ─── TDEE Dashboard Card ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-3">
            <Zap color="#10b981" size={18} fill="#10b981" />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              Your TDEE
            </StyledText>
          </StyledView>

          {/* Big TDEE number */}
          <StyledView className="items-center py-2">
            <StyledText className="text-emerald-400 text-5xl font-black">
              {tdeeData.displayTDEE !== null ? tdeeData.displayTDEE.toLocaleString() : '—'}
            </StyledText>
            <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
              {energyLabel}/Day
            </StyledText>
          </StyledView>

          {/* Mini stats row */}
          <StyledView className="flex-row justify-between items-center pt-3 mt-2 border-t border-zinc-800/80">
            <StyledView className="items-center flex-1">
              <StyledText className="text-white text-lg font-black">
                {tdeeData.currentWeight !== null
                  ? `${tdeeData.currentWeight.toFixed(1)}`
                  : '—'}
              </StyledText>
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                Current ({weightUnit})
              </StyledText>
            </StyledView>

            <StyledView className="items-center flex-1 border-x border-zinc-800/80">
              <StyledText
                className={`text-lg font-black ${
                  tdeeData.totalWeightChange !== null
                    ? tdeeData.totalWeightChange < 0
                      ? 'text-emerald-400'
                      : tdeeData.totalWeightChange > 0
                        ? 'text-red-400'
                        : 'text-white'
                    : 'text-white'
                }`}
              >
                {tdeeData.totalWeightChange !== null
                  ? `${tdeeData.totalWeightChange > 0 ? '+' : ''}${tdeeData.totalWeightChange.toFixed(1)}`
                  : '—'}
              </StyledText>
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                Δ Weight ({weightUnit})
              </StyledText>
            </StyledView>

            <StyledView className="items-center flex-1">
              <StyledText className="text-indigo-400 text-lg font-black">
                {tdeeData.weeksWithData}
              </StyledText>
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                Weeks
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Not enough data info */}
          {!tdeeData.hasEnoughData && (
            <StyledView className="flex-row items-start mt-3 bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3">
              <Info color="#a1a1aa" size={14} style={{ marginTop: 1 }} />
              <StyledText className="text-zinc-400 text-[11px] font-bold ml-2 flex-1 leading-4">
                Log weight & calories daily. Need at least 2 weeks of data for accurate TDEE.
              </StyledText>
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── TDEE Trend Chart ─── */}
      {isConfigured && tdeeData.weeksWithData >= 2 && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-1">
            <TrendingUp color="#10b981" size={18} />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              TDEE Trend
            </StyledText>
          </StyledView>
          <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
            Smoothed TDEE over time ({energyLabel}/day)
          </StyledText>
          <LineChart
            data={tdeeChartData}
            width={screenWidth}
            height={170}
            chartConfig={tdeeChartConfig}
            bezier
            style={{ borderRadius: 12, marginLeft: -12 }}
          />
        </StyledView>
      )}

      {/* ─── Settings Card (Collapsible) ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 shadow-xl overflow-hidden">
          <StyledTouchableOpacity
            onPress={() => setGoalExpanded(!goalExpanded)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between p-4"
          >
            <StyledView className="flex-row items-center">
              <Settings2 color="#f59e0b" size={18} />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Settings
              </StyledText>
            </StyledView>
            {goalExpanded ? (
              <ChevronUp color="#71717a" size={18} />
            ) : (
              <ChevronDown color="#71717a" size={18} />
            )}
          </StyledTouchableOpacity>

          {goalExpanded && (
            <StyledView className="px-4 pb-4">
              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Goal Weight ({weightUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="numeric"
                value={goalWeightInput}
                onChangeText={setGoalWeightInput}
                placeholder={`e.g. ${weightUnit === 'kg' ? '75' : '165'}`}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Weekly Rate ({weightUnit}/week)
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="numeric"
                value={goalRateInput}
                onChangeText={setGoalRateInput}
                placeholder="e.g. 0.5"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {/* Computed goal projections */}
              {tdeeData.goalCalories !== null && (
                <StyledView className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3 mb-4">
                  <StyledView className="flex-row justify-between mb-2">
                    <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                      Goal Calories
                    </StyledText>
                    <StyledText className="text-white font-black text-sm">
                      {Math.round(tdeeData.goalCalories).toLocaleString()} {energyLabel}
                    </StyledText>
                  </StyledView>
                  <StyledView className="flex-row justify-between mb-2">
                    <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                      Daily Deficit/Surplus
                    </StyledText>
                    <StyledText
                      className={`font-black text-sm ${
                        tdeeData.dailyDeficit !== null && tdeeData.dailyDeficit < 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {tdeeData.dailyDeficit !== null
                        ? `${tdeeData.dailyDeficit > 0 ? '+' : ''}${Math.round(tdeeData.dailyDeficit).toLocaleString()} ${energyLabel}`
                        : '—'}
                    </StyledText>
                  </StyledView>
                  {tdeeData.weeksToGoal !== null && (
                    <StyledView className="flex-row justify-between mb-2">
                      <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        Weeks to Goal
                      </StyledText>
                      <StyledText className="text-white font-black text-sm">
                        {Math.ceil(tdeeData.weeksToGoal)}
                      </StyledText>
                    </StyledView>
                  )}
                  {tdeeData.goalDate !== null && (
                    <StyledView className="flex-row justify-between">
                      <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        Estimated Date
                      </StyledText>
                      <StyledText className="text-white font-black text-sm">
                        {tdeeData.goalDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </StyledText>
                    </StyledView>
                  )}
                </StyledView>
              )}

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Weight Unit
              </StyledText>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <Picker
                  selectedValue={setupWeightUnit}
                  onValueChange={setSetupWeightUnit}
                  style={globalStyles.picker}
                  itemStyle={globalStyles.pickerItem}
                  dropdownIconColor="white"
                >
                  <Picker.Item label="Kilograms (kg)" value="kg" />
                  <Picker.Item label="Pounds (lb)" value="lb" />
                </Picker>
              </StyledView>

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Energy Unit
              </StyledText>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-6 overflow-hidden">
                <Picker
                  selectedValue={setupEnergyUnit}
                  onValueChange={setSetupEnergyUnit}
                  style={globalStyles.picker}
                  itemStyle={globalStyles.pickerItem}
                  dropdownIconColor="white"
                >
                  <Picker.Item label="Calories (cal)" value="cal" />
                  <Picker.Item label="Kilojoules (kj)" value="kj" />
                </Picker>
              </StyledView>

              <StyledTouchableOpacity
                onPress={handleSaveGoals}
                activeOpacity={0.85}
                className="bg-emerald-600 py-3 rounded-xl items-center shadow-lg"
              >
                <StyledText className="text-white text-sm font-black uppercase tracking-wider">
                  Save Settings
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── Weekly Breakdown ─── */}
      {isConfigured && weeklyBreakdown.length > 0 && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-3">
            <Calculator color="#6366f1" size={18} />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              Weekly Breakdown
            </StyledText>
          </StyledView>

          {/* Header row */}
          <StyledView className="flex-row py-2 border-b border-zinc-800">
            <StyledText className="flex-[2] text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
              Week
            </StyledText>
            <StyledText className="flex-1 text-zinc-500 text-[9px] font-bold uppercase tracking-wider text-right">
              Avg Wt
            </StyledText>
            <StyledText className="flex-1 text-zinc-500 text-[9px] font-bold uppercase tracking-wider text-right">
              Avg Cal
            </StyledText>
            <StyledText className="flex-1 text-zinc-500 text-[9px] font-bold uppercase tracking-wider text-right">
              Δ Wt
            </StyledText>
            <StyledText className="flex-1 text-zinc-500 text-[9px] font-bold uppercase tracking-wider text-right">
              TDEE
            </StyledText>
          </StyledView>

          {weeklyBreakdown.map((week, index) => {
            const weightDeltaColor =
              week.weightDelta !== null
                ? week.weightDelta < 0
                  ? 'text-emerald-400'
                  : week.weightDelta > 0
                    ? 'text-red-400'
                    : 'text-zinc-400'
                : 'text-zinc-600'

            return (
              <StyledView
                key={week.weekStart.toISOString()}
                className={`flex-row py-2.5 items-center ${
                  index < weeklyBreakdown.length - 1 ? 'border-b border-zinc-800/60' : ''
                }`}
              >
                <StyledText className="flex-[2] text-zinc-400 text-[10px] font-bold">
                  {formatWeekRange(week.weekStart, week.weekEnd)}
                </StyledText>
                <StyledText className="flex-1 text-white text-xs font-black text-right">
                  {week.avgWeight !== null ? week.avgWeight.toFixed(1) : '—'}
                </StyledText>
                <StyledText className="flex-1 text-white text-xs font-black text-right">
                  {week.avgCalories !== null ? Math.round(week.avgCalories).toLocaleString() : '—'}
                </StyledText>
                <StyledText className={`flex-1 text-xs font-black text-right ${weightDeltaColor}`}>
                  {week.weightDelta !== null
                    ? `${week.weightDelta > 0 ? '+' : ''}${week.weightDelta.toFixed(1)}`
                    : '—'}
                </StyledText>
                <StyledText className="flex-1 text-emerald-400 text-xs font-black text-right">
                  {week.displayTDEE !== null ? week.displayTDEE.toLocaleString() : '—'}
                </StyledText>
              </StyledView>
            )
          })}
        </StyledView>
      )}

      {/* ─── Quick Log Card ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-3">
            <Scale color="#6366f1" size={18} />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              Log Today&apos;s Stats
            </StyledText>
          </StyledView>

          <StyledView className="flex-row gap-3 mb-3">
            <StyledView className="flex-1">
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                Weight ({weightUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={logWeight}
                onChangeText={setLogWeight}
                placeholder={weightUnit === 'kg' ? '80.5' : '177.5'}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>

            <StyledView className="flex-1">
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                Calories ({energyLabel})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={logCalories}
                onChangeText={setLogCalories}
                placeholder="2500"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>
          </StyledView>

          <StyledTouchableOpacity
            onPress={handleQuickLog}
            activeOpacity={0.85}
            className="bg-emerald-600 py-3 rounded-xl items-center shadow-lg"
          >
            <StyledText className="text-white text-sm font-black uppercase tracking-wider">
              Save Entry
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      )}
    </StyledScrollView>
  )
}

export default TDEEScreen
