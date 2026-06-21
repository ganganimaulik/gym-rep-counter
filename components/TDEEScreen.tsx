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
  Activity,
  Pencil,
  Plus,
} from 'lucide-react-native'
import { LineChart } from 'react-native-chart-kit'
import { Picker } from '@react-native-picker/picker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { TDEEConfig, WeightLog, CalorieLog } from '../declarations'
import { useTDEE } from '../hooks/useTDEE'
import { DataHook } from '../hooks/useData'
import { globalStyles } from '../utils/globalStyles'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)

export interface HealthLogGroup {
  dateStr: string
  date: Date
  weightLog?: WeightLog
  calorieLog?: CalorieLog
}

interface TDEEScreenProps {
  user: FirebaseUser | null
  dataHook: DataHook
  onLogPress: () => void
  onEditLogPress: (group: HealthLogGroup) => void
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

const TDEEScreen: React.FC<TDEEScreenProps> = ({
  user,
  dataHook,
  onLogPress,
  onEditLogPress,
}) => {
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

  // ── Unit settings state ──
  const [unitExpanded, setUnitExpanded] = useState(false)
  const [goalWeightInput, setGoalWeightInput] = useState('')
  const [goalRateInput, setGoalRateInput] = useState('')

  // ── Body Fat settings state ──
  const [setupGender, setSetupGender] = useState<'male' | 'female'>('male')
  const [setupMeasurementUnit, setSetupMeasurementUnit] = useState<'inch' | 'cm'>('inch')
  const [setupHeight, setSetupHeight] = useState('')
  const [setupWaist, setSetupWaist] = useState('')
  const [setupNeck, setSetupNeck] = useState('')
  const [setupHip, setSetupHip] = useState('')

  // ── Tab state for interactive components ──
  const [activeChartTab, setActiveChartTab] = useState<
    'tdee' | 'weight' | 'calories'
  >('tdee')
  const [activeHistoryTab, setActiveHistoryTab] = useState<'weekly' | 'daily'>(
    'daily',
  )

  // ── Date Formatting Helpers ──
  const formatChartDate = useCallback((date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
    })
  }, [])

  // ── Memos for charts & history ──
  const healthLogsByDate = useMemo(() => {
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

    return Array.from(map.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    )
  }, [weightLogs, calorieLogs])

  const weightChartData = useMemo(() => {
    const reversed = [...weightLogs].reverse().slice(-7)
    return {
      labels: reversed.map((log) => formatChartDate(log.date.toDate())),
      datasets: [
        {
          data: reversed.map((log) => log.weight),
        },
      ],
    }
  }, [weightLogs, formatChartDate])

  const calorieChartData = useMemo(() => {
    const reversed = [...calorieLogs].reverse().slice(-7)
    return {
      labels: reversed.map((log) => formatChartDate(log.date.toDate())),
      datasets: [
        {
          data: reversed.map((log) => log.calories),
        },
      ],
    }
  }, [calorieLogs, formatChartDate])

  // Sync goal inputs when config loads
  useEffect(() => {
    if (tdeeConfig) {
      setGoalWeightInput(tdeeConfig.goalWeight?.toString() ?? '')
      setGoalRateInput(tdeeConfig.goalWeeklyRate?.toString() ?? '')
      setSetupWeightUnit(tdeeConfig.weightUnit ?? 'kg')
      setSetupEnergyUnit(tdeeConfig.energyUnit ?? 'cal')
      
      if (tdeeConfig.gender) setSetupGender(tdeeConfig.gender)
      if (tdeeConfig.measurementUnit) setSetupMeasurementUnit(tdeeConfig.measurementUnit)
      setSetupHeight(tdeeConfig.heightValue?.toString() ?? '')
      setSetupWaist(tdeeConfig.waistValue?.toString() ?? '')
      setSetupNeck(tdeeConfig.neckValue?.toString() ?? '')
      setSetupHip(tdeeConfig.hipValue?.toString() ?? '')
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
      gender: setupGender,
      measurementUnit: setupMeasurementUnit,
    }

    const h = setupHeight.trim() ? parseFloat(setupHeight) : undefined
    if (h !== undefined) config.heightValue = h

    const w = setupWaist.trim() ? parseFloat(setupWaist) : undefined
    if (w !== undefined) config.waistValue = w

    const n = setupNeck.trim() ? parseFloat(setupNeck) : undefined
    if (n !== undefined) config.neckValue = n

    const hp = setupGender === 'female' && setupHip.trim() ? parseFloat(setupHip) : undefined
    if (hp !== undefined) config.hipValue = hp

    await saveTDEEConfig(config, user)
  }, [
    setupWeightUnit,
    setupEnergyUnit,
    setupGender,
    setupMeasurementUnit,
    setupHeight,
    setupWaist,
    setupNeck,
    setupHip,
    saveTDEEConfig,
    user,
  ])

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
      gender: setupGender,
      measurementUnit: setupMeasurementUnit,
    }

    if (gw !== undefined) updatedConfig.goalWeight = gw
    else delete updatedConfig.goalWeight

    if (rate !== undefined) updatedConfig.goalWeeklyRate = rate
    else delete updatedConfig.goalWeeklyRate

    const h = setupHeight.trim() ? parseFloat(setupHeight) : undefined
    if (h !== undefined) updatedConfig.heightValue = h
    else delete updatedConfig.heightValue

    const w = setupWaist.trim() ? parseFloat(setupWaist) : undefined
    if (w !== undefined) updatedConfig.waistValue = w
    else delete updatedConfig.waistValue

    const n = setupNeck.trim() ? parseFloat(setupNeck) : undefined
    if (n !== undefined) updatedConfig.neckValue = n
    else delete updatedConfig.neckValue

    const hp = setupGender === 'female' && setupHip.trim() ? parseFloat(setupHip) : undefined
    if (hp !== undefined) updatedConfig.hipValue = hp
    else delete updatedConfig.hipValue

    await saveTDEEConfig(updatedConfig, user)
    Alert.alert('Saved', 'Settings updated successfully.')
  }, [
    tdeeConfig,
    goalWeightInput,
    goalRateInput,
    setupWeightUnit,
    setupEnergyUnit,
    setupGender,
    setupMeasurementUnit,
    setupHeight,
    setupWaist,
    setupNeck,
    setupHip,
    saveTDEEConfig,
    user,
  ])

  const handleQuickLog = useCallback(async () => {
    const weightNum = parseFloat(logWeight)
    const calorieNum = parseInt(logCalories, 10)

    if (
      (isNaN(weightNum) || weightNum <= 0) &&
      (isNaN(calorieNum) || calorieNum <= 0)
    ) {
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

  const isDeficit =
    tdeeConfig?.goalWeight !== undefined &&
    tdeeData.currentWeight !== null &&
    tdeeConfig.goalWeight < tdeeData.currentWeight

  const isSurplus =
    tdeeConfig?.goalWeight !== undefined &&
    tdeeData.currentWeight !== null &&
    tdeeConfig.goalWeight > tdeeData.currentWeight

  // ── Render ──

  return (
    <StyledScrollView
      className="flex-1 bg-zinc-950"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: 80,
        paddingHorizontal: 16,
        paddingTop: 8,
      }}
      keyboardShouldPersistTaps="handled">
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
            Select your preferred units to get started. Your TDEE will be
            calculated adaptively from your daily weight and calorie logs.
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
              dropdownIconColor="white">
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
              dropdownIconColor="white">
              <Picker.Item label="Calories (cal)" value="cal" />
              <Picker.Item label="Kilojoules (kJ)" value="kj" />
            </Picker>
          </StyledView>

          <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide border-t border-zinc-800 pt-4 mt-2">
            Measurement Unit
          </StyledText>
          <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
            <Picker
              selectedValue={setupMeasurementUnit}
              onValueChange={setSetupMeasurementUnit}
              style={globalStyles.picker}
              itemStyle={globalStyles.pickerItem}
              dropdownIconColor="white">
              <Picker.Item label="Inches (in)" value="inch" />
              <Picker.Item label="Centimeters (cm)" value="cm" />
            </Picker>
          </StyledView>

          <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
            Gender
          </StyledText>
          <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
            <Picker
              selectedValue={setupGender}
              onValueChange={setSetupGender}
              style={globalStyles.picker}
              itemStyle={globalStyles.pickerItem}
              dropdownIconColor="white">
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
            </Picker>
          </StyledView>

          <StyledView className="flex-row gap-3 mb-4">
            <StyledView className="flex-1">
              <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                Height ({setupMeasurementUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={setupHeight}
                onChangeText={setSetupHeight}
                placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '70' : '178'}`}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>
            <StyledView className="flex-1">
              <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                Waist ({setupMeasurementUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={setupWaist}
                onChangeText={setSetupWaist}
                placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '32' : '81'}`}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>
          </StyledView>

          <StyledView className="flex-row gap-3 mb-6">
            <StyledView className="flex-1">
              <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                Neck ({setupMeasurementUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={setupNeck}
                onChangeText={setSetupNeck}
                placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '15' : '38'}`}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>
            {setupGender === 'female' && (
              <StyledView className="flex-1">
                <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  Hips ({setupMeasurementUnit})
                </StyledText>
                <StyledTextInput
                  className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                  keyboardType="numeric"
                  value={setupHip}
                  onChangeText={setSetupHip}
                  placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '38' : '96'}`}
                  placeholderTextColor="#52525b"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </StyledView>
            )}
            {setupGender !== 'female' && (
              <StyledView className="flex-1" />
            )}
          </StyledView>

          <StyledTouchableOpacity
            onPress={handleStartTracking}
            activeOpacity={0.85}
            className="bg-emerald-600 py-3 rounded-xl items-center shadow-lg">
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
              {tdeeData.displayTDEE !== null
                ? tdeeData.displayTDEE.toLocaleString()
                : '—'}
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
                }`}>
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

          {/* Log Daily Stats Action Button */}
          <StyledTouchableOpacity
            onPress={onLogPress}
            activeOpacity={0.85}
            className="mt-4 flex-row items-center justify-center bg-emerald-600/10 border border-emerald-500/20 py-3 rounded-xl shadow-sm">
            <Activity color="#10b981" size={16} />
            <StyledText className="text-emerald-400 text-xs font-black uppercase tracking-wider ml-2.5">
              Log Weight / Calories
            </StyledText>
          </StyledTouchableOpacity>

          {/* Not enough data info */}
          {!tdeeData.hasEnoughData && (
            <StyledView className="flex-row items-start mt-3 bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3">
              <Info color="#a1a1aa" size={14} style={{ marginTop: 1 }} />
              <StyledText className="text-zinc-400 text-[11px] font-bold ml-2 flex-1 leading-4">
                Log weight & calories daily. Need at least 2 weeks of data for
                accurate TDEE.
              </StyledText>
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── Goal & Projections Card ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center mb-3">
            <Target color="#fb923c" size={18} />
            <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
              Weight Management Goal
            </StyledText>
          </StyledView>

          {/* Inputs Row */}
          <StyledView className="flex-row gap-3 mb-4">
            <StyledView className="flex-1">
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                Goal Weight ({weightUnit})
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={goalWeightInput}
                onChangeText={setGoalWeightInput}
                placeholder={`e.g. ${weightUnit === 'kg' ? '75' : '165'}`}
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>

            <StyledView className="flex-1">
              <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                Weekly Rate ({weightUnit}/wk)
              </StyledText>
              <StyledTextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                keyboardType="numeric"
                value={goalRateInput}
                onChangeText={setGoalRateInput}
                placeholder="e.g. 0.5"
                placeholderTextColor="#52525b"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </StyledView>
          </StyledView>

          <StyledTouchableOpacity
            onPress={handleSaveGoals}
            activeOpacity={0.85}
            className="bg-orange-500 py-3 rounded-xl items-center shadow-lg mb-4">
            <StyledText className="text-white text-sm font-black uppercase tracking-wider">
              Update Goal
            </StyledText>
          </StyledTouchableOpacity>

          {/* Projections Section */}
          {tdeeData.goalCalories !== null ? (
            <StyledView className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3">
              <StyledText className="text-zinc-400 text-xs font-black uppercase tracking-wider mb-3 text-center border-b border-zinc-850 pb-2">
                Calculated Targets & Projections
              </StyledText>

              <StyledView className="space-y-2.5">
                <StyledView className="flex-row justify-between items-center">
                  <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    Goal Calories
                  </StyledText>
                  <StyledText className="text-white font-black text-sm">
                    {Math.round(tdeeData.goalCalories).toLocaleString()}{' '}
                    {energyLabel}/Day
                  </StyledText>
                </StyledView>

                <StyledView className="flex-row justify-between items-center border-t border-zinc-900/60 pt-2.5">
                  <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    Daily Deficit/Surplus
                  </StyledText>
                  <StyledText
                    className={`font-black text-sm ${
                      tdeeData.dailyDeficit !== null
                        ? isDeficit
                          ? 'text-emerald-400'
                          : isSurplus
                          ? 'text-red-400'
                          : 'text-white'
                        : 'text-zinc-400'
                    }`}>
                    {tdeeData.dailyDeficit !== null
                      ? `${isDeficit ? '-' : isSurplus ? '+' : ''}${Math.round(tdeeData.dailyDeficit).toLocaleString()} ${energyLabel}`
                      : '—'}
                  </StyledText>
                </StyledView>

                {tdeeData.weeksToGoal !== null && (
                  <StyledView className="flex-row justify-between items-center border-t border-zinc-900/60 pt-2.5">
                    <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                      Weeks to Goal
                    </StyledText>
                    <StyledText className="text-white font-black text-sm">
                      {Math.ceil(tdeeData.weeksToGoal)} Weeks
                    </StyledText>
                  </StyledView>
                )}

                {tdeeData.goalDate !== null && (
                  <StyledView className="flex-row justify-between items-center border-t border-zinc-900/60 pt-2.5">
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
            </StyledView>
          ) : (
            <StyledView className="bg-zinc-950/30 border border-dashed border-zinc-800 rounded-xl p-4 items-center">
              <Info color="#52525b" size={20} />
              <StyledText className="text-zinc-500 text-[11px] font-bold text-center mt-2 leading-4">
                Provide a Goal Weight and Weekly Rate to calculate your daily
                calorie target and projections.
              </StyledText>
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── Interactive Trends Card ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center justify-between mb-3">
            <StyledView className="flex-row items-center">
              <TrendingUp color="#10b981" size={18} />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Progress Trends
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Chart Tab Selector */}
          <StyledView className="flex-row bg-zinc-950 border border-zinc-800/80 p-1 rounded-xl mb-4">
            <StyledTouchableOpacity
              onPress={() => setActiveChartTab('tdee')}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeChartTab === 'tdee' ? 'bg-zinc-800 shadow-sm' : ''
              }`}>
              <StyledText
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeChartTab === 'tdee' ? 'text-white' : 'text-zinc-500'
                }`}>
                TDEE
              </StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={() => setActiveChartTab('weight')}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeChartTab === 'weight' ? 'bg-zinc-800 shadow-sm' : ''
              }`}>
              <StyledText
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeChartTab === 'weight' ? 'text-white' : 'text-zinc-500'
                }`}>
                Weight
              </StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={() => setActiveChartTab('calories')}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeChartTab === 'calories' ? 'bg-zinc-800 shadow-sm' : ''
              }`}>
              <StyledText
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeChartTab === 'calories' ? 'text-white' : 'text-zinc-500'
                }`}>
                Calories
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>

          {/* Chart Body */}
          {activeChartTab === 'tdee' && (
            <StyledView>
              <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                Smoothed TDEE over time ({energyLabel}/day)
              </StyledText>
              {tdeeData.weeksWithData >= 2 ? (
                <LineChart
                  data={tdeeChartData}
                  width={screenWidth}
                  height={170}
                  chartConfig={tdeeChartConfig}
                  bezier
                  style={{ borderRadius: 12, marginLeft: -12 }}
                />
              ) : (
                <StyledView className="h-[170] justify-center items-center border border-dashed border-zinc-800 rounded-xl py-6">
                  <TrendingUp color="#3f3f46" size={36} />
                  <StyledText className="text-zinc-500 text-xs italic text-center mt-3 px-4">
                    Need at least 2 weeks of calculation data to display TDEE
                    trend chart.
                  </StyledText>
                </StyledView>
              )}
            </StyledView>
          )}

          {activeChartTab === 'weight' && (
            <StyledView>
              <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                Body weight over time ({weightUnit})
              </StyledText>
              {weightLogs.length >= 2 ? (
                <LineChart
                  data={weightChartData}
                  width={screenWidth}
                  height={170}
                  chartConfig={{
                    backgroundGradientFrom: '#18181b',
                    backgroundGradientTo: '#18181b',
                    backgroundGradientFromOpacity: 0,
                    backgroundGradientToOpacity: 0,
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                    labelColor: (opacity = 1) =>
                      `rgba(161, 161, 170, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
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
          )}

          {activeChartTab === 'calories' && (
            <StyledView>
              <StyledText className="text-zinc-500 text-[10px] font-semibold mb-3">
                Daily caloric intake ({energyLabel})
              </StyledText>
              {calorieLogs.length >= 2 ? (
                <LineChart
                  data={calorieChartData}
                  width={screenWidth}
                  height={170}
                  chartConfig={{
                    backgroundGradientFrom: '#18181b',
                    backgroundGradientTo: '#18181b',
                    backgroundGradientFromOpacity: 0,
                    backgroundGradientToOpacity: 0,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(244, 63, 94, ${opacity})`,
                    labelColor: (opacity = 1) =>
                      `rgba(161, 161, 170, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#f43f5e',
                    },
                  }}
                  bezier
                  style={{ borderRadius: 12, marginLeft: -12 }}
                />
              ) : (
                <StyledView className="h-[170] justify-center items-center border border-dashed border-zinc-800 rounded-xl py-6">
                  <Activity color="#3f3f46" size={36} />
                  <StyledText className="text-zinc-500 text-xs italic text-center mt-3 px-4">
                    Log at least 2 entries to display calorie progress chart.
                  </StyledText>
                </StyledView>
              )}
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── History & Breakdown Card ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 shadow-xl">
          <StyledView className="flex-row items-center justify-between mb-3">
            <StyledView className="flex-row items-center">
              <Calculator color="#6366f1" size={18} />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                History & Breakdown
              </StyledText>
            </StyledView>
          </StyledView>

          {/* History Tab Selector */}
          <StyledView className="flex-row bg-zinc-950 border border-zinc-800/80 p-1 rounded-xl mb-4">
            <StyledTouchableOpacity
              onPress={() => setActiveHistoryTab('daily')}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeHistoryTab === 'daily' ? 'bg-zinc-800 shadow-sm' : ''
              }`}>
              <StyledText
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeHistoryTab === 'daily' ? 'text-white' : 'text-zinc-500'
                }`}>
                Daily Logs
              </StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={() => setActiveHistoryTab('weekly')}
              activeOpacity={0.8}
              className={`flex-1 py-2 rounded-lg items-center ${
                activeHistoryTab === 'weekly' ? 'bg-zinc-800 shadow-sm' : ''
              }`}>
              <StyledText
                className={`text-[10px] font-black uppercase tracking-wider ${
                  activeHistoryTab === 'weekly' ? 'text-white' : 'text-zinc-500'
                }`}>
                Weekly Average
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>

          {/* Weekly Average Breakdown Tab */}
          {activeHistoryTab === 'weekly' && (
            <StyledView>
              {weeklyBreakdown.length > 0 ? (
                <StyledView>
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
                          index < weeklyBreakdown.length - 1
                            ? 'border-b border-zinc-800/60'
                            : ''
                        }`}>
                        <StyledText className="flex-[2] text-zinc-400 text-[10px] font-bold">
                          {formatWeekRange(week.weekStart, week.weekEnd)}
                        </StyledText>
                        <StyledText className="flex-1 text-white text-xs font-black text-right">
                          {week.avgWeight !== null
                            ? week.avgWeight.toFixed(1)
                            : '—'}
                        </StyledText>
                        <StyledText className="flex-1 text-white text-xs font-black text-right">
                          {week.avgCalories !== null
                            ? Math.round(week.avgCalories).toLocaleString()
                            : '—'}
                        </StyledText>
                        <StyledText
                          className={`flex-1 text-xs font-black text-right ${weightDeltaColor}`}>
                          {week.weightDelta !== null
                            ? `${week.weightDelta > 0 ? '+' : ''}${week.weightDelta.toFixed(1)}`
                            : '—'}
                        </StyledText>
                        <StyledText className="flex-1 text-emerald-400 text-xs font-black text-right">
                          {week.displayTDEE !== null
                            ? week.displayTDEE.toLocaleString()
                            : '—'}
                        </StyledText>
                      </StyledView>
                    )
                  })}
                </StyledView>
              ) : (
                <StyledText className="text-zinc-500 text-xs italic text-center py-6">
                  No weekly average data calculated yet. Log daily entries to
                  populate averages.
                </StyledText>
              )}
            </StyledView>
          )}

          {/* Daily History Tab */}
          {activeHistoryTab === 'daily' && (
            <StyledView>
              {healthLogsByDate.length > 0 ? (
                healthLogsByDate.slice(0, 15).map((group, index) => (
                  <StyledTouchableOpacity
                    key={group.dateStr}
                    onPress={() => onEditLogPress(group)}
                    activeOpacity={0.7}
                    className={`flex-row justify-between items-center py-3.5 ${
                      index < Math.min(healthLogsByDate.length, 15) - 1
                        ? 'border-b border-zinc-800/60'
                        : ''
                    }`}>
                    <StyledView className="flex-row items-center">
                      <Activity color="#10b981" size={16} />
                      <StyledView className="ml-3">
                        {group.weightLog && (
                          <StyledText className="text-white font-extrabold text-sm">
                            {group.weightLog.weight} {weightUnit}
                          </StyledText>
                        )}
                        {group.calorieLog && (
                          <StyledText className="text-zinc-400 font-bold text-xs">
                            {group.calorieLog.calories} {energyLabel}
                          </StyledText>
                        )}
                      </StyledView>
                    </StyledView>
                    <StyledView className="flex-row items-center">
                      <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mr-3">
                        {group.date.toLocaleDateString(undefined, {
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
              ) : (
                <StyledText className="text-zinc-500 text-xs italic text-center py-6">
                  No daily stats logged yet. Tap &apos;Log Weight /
                  Calories&apos; to get started!
                </StyledText>
              )}
            </StyledView>
          )}
        </StyledView>
      )}

      {/* ─── Preferences & Body Fat Card (Collapsible) ─── */}
      {isConfigured && (
        <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 shadow-xl overflow-hidden">
          <StyledTouchableOpacity
            onPress={() => setUnitExpanded(!unitExpanded)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between p-4">
            <StyledView className="flex-row items-center">
              <Settings2 color="#a1a1aa" size={18} />
              <StyledText className="text-sm font-black text-zinc-400 ml-2 tracking-wider uppercase">
                Preferences & Body Fat
              </StyledText>
            </StyledView>
            {unitExpanded ? (
              <ChevronUp color="#71717a" size={18} />
            ) : (
              <ChevronDown color="#71717a" size={18} />
            )}
          </StyledTouchableOpacity>

          {unitExpanded && (
            <StyledView className="px-4 pb-4">
              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Weight Unit
              </StyledText>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <Picker
                  selectedValue={setupWeightUnit}
                  onValueChange={setSetupWeightUnit}
                  style={globalStyles.picker}
                  itemStyle={globalStyles.pickerItem}
                  dropdownIconColor="white">
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
                  dropdownIconColor="white">
                  <Picker.Item label="Calories (cal)" value="cal" />
                  <Picker.Item label="Kilojoules (kj)" value="kj" />
                </Picker>
              </StyledView>

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide border-t border-zinc-800 pt-4 mt-2">
                Measurement Unit
              </StyledText>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <Picker
                  selectedValue={setupMeasurementUnit}
                  onValueChange={setSetupMeasurementUnit}
                  style={globalStyles.picker}
                  itemStyle={globalStyles.pickerItem}
                  dropdownIconColor="white">
                  <Picker.Item label="Inches (in)" value="inch" />
                  <Picker.Item label="Centimeters (cm)" value="cm" />
                </Picker>
              </StyledView>

              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Gender
              </StyledText>
              <StyledView className="bg-zinc-950 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <Picker
                  selectedValue={setupGender}
                  onValueChange={setSetupGender}
                  style={globalStyles.picker}
                  itemStyle={globalStyles.pickerItem}
                  dropdownIconColor="white">
                  <Picker.Item label="Male" value="male" />
                  <Picker.Item label="Female" value="female" />
                </Picker>
              </StyledView>

              <StyledView className="flex-row gap-3 mb-4">
                <StyledView className="flex-1">
                  <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Height ({setupMeasurementUnit})
                  </StyledText>
                  <StyledTextInput
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                    keyboardType="numeric"
                    value={setupHeight}
                    onChangeText={setSetupHeight}
                    placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '70' : '178'}`}
                    placeholderTextColor="#52525b"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </StyledView>
                <StyledView className="flex-1">
                  <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Waist ({setupMeasurementUnit})
                  </StyledText>
                  <StyledTextInput
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                    keyboardType="numeric"
                    value={setupWaist}
                    onChangeText={setSetupWaist}
                    placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '32' : '81'}`}
                    placeholderTextColor="#52525b"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </StyledView>
              </StyledView>

              <StyledView className="flex-row gap-3 mb-6">
                <StyledView className="flex-1">
                  <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Neck ({setupMeasurementUnit})
                  </StyledText>
                  <StyledTextInput
                    className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                    keyboardType="numeric"
                    value={setupNeck}
                    onChangeText={setSetupNeck}
                    placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '15' : '38'}`}
                    placeholderTextColor="#52525b"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </StyledView>
                {setupGender === 'female' && (
                  <StyledView className="flex-1">
                    <StyledText className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      Hips ({setupMeasurementUnit})
                    </StyledText>
                    <StyledTextInput
                      className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-bold text-sm"
                      keyboardType="numeric"
                      value={setupHip}
                      onChangeText={setSetupHip}
                      placeholder={`e.g. ${setupMeasurementUnit === 'inch' ? '38' : '96'}`}
                      placeholderTextColor="#52525b"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </StyledView>
                )}
                {setupGender !== 'female' && (
                  <StyledView className="flex-1" />
                )}
              </StyledView>

              <StyledTouchableOpacity
                onPress={handleSaveGoals}
                activeOpacity={0.85}
                className="bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center shadow-lg">
                <StyledText className="text-white text-sm font-black uppercase tracking-wider">
                  Save Preferences
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          )}
        </StyledView>
      )}
    </StyledScrollView>
  )
}

export default TDEEScreen
