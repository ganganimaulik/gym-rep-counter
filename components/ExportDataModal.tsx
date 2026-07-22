import React, { useState, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native'
import { styled } from 'nativewind'
import { X, Copy, Calendar, Check, Download } from 'lucide-react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import Toast from 'react-native-toast-message'
import type { JournalEntry, WeightLog, CalorieLog } from '../declarations'
import {
  ExportDateRangeOption,
  getDateRangeBounds,
  filterLogsByDateRange,
  formatLogsForExport,
  copyLogsToClipboard,
} from '../utils/exportUtils'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledTextInput = styled(TextInput)

interface ExportDataModalProps {
  visible: boolean
  onClose: () => void
  journalEntries: JournalEntry[]
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
}

const formatDateToYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseYYYYMMDD = (str: string): Date | null => {
  const parts = str.split('-')
  if (parts.length !== 3) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return new Date(year, month, day)
}

const ExportDataModal: React.FC<ExportDataModalProps> = ({
  visible,
  onClose,
  journalEntries,
  weightLogs,
  calorieLogs,
}) => {
  const [rangeOption, setRangeOption] = useState<ExportDateRangeOption>('1m')
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d
  })
  const [customEndDate, setCustomEndDate] = useState<Date>(() => new Date())
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false)
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false)
  const [customStartText, setCustomStartText] = useState<string>(() =>
    formatDateToYYYYMMDD(customStartDate),
  )
  const [customEndText, setCustomEndText] = useState<string>(() =>
    formatDateToYYYYMMDD(customEndDate),
  )
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const bounds = useMemo(() => {
    return getDateRangeBounds(
      rangeOption,
      customStartDate,
      customEndDate,
      new Date(),
    )
  }, [rangeOption, customStartDate, customEndDate])

  const filteredData = useMemo(() => {
    return filterLogsByDateRange(
      journalEntries,
      weightLogs,
      calorieLogs,
      bounds,
    )
  }, [journalEntries, weightLogs, calorieLogs, bounds])

  const handleCopy = async () => {
    const formattedText = formatLogsForExport(filteredData, bounds)
    const success = await copyLogsToClipboard(formattedText)
    if (success) {
      setIsCopied(true)
      Toast.show({
        type: 'success',
        text1: 'Export Copied to Clipboard!',
        text2: `${filteredData.journalEntries.length} journal, ${filteredData.weightLogs.length} weight & ${filteredData.calorieLogs.length} calorie logs`,
      })
      setTimeout(() => setIsCopied(false), 2500)
    } else {
      Toast.show({
        type: 'error',
        text1: 'Copy Failed',
        text2: 'Could not copy export data to clipboard.',
      })
    }
  }

  const handleCustomStartChange = (event: unknown, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios')
    if (selectedDate) {
      setCustomStartDate(selectedDate)
      setCustomStartText(formatDateToYYYYMMDD(selectedDate))
    }
  }

  const handleCustomEndChange = (event: unknown, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios')
    if (selectedDate) {
      setCustomEndDate(selectedDate)
      setCustomEndText(formatDateToYYYYMMDD(selectedDate))
    }
  }

  const handleCustomStartTextChange = (text: string) => {
    setCustomStartText(text)
    const parsed = parseYYYYMMDD(text)
    if (parsed) {
      setCustomStartDate(parsed)
    }
  }

  const handleCustomEndTextChange = (text: string) => {
    setCustomEndText(text)
    const parsed = parseYYYYMMDD(text)
    if (parsed) {
      setCustomEndDate(parsed)
    }
  }

  if (!visible) return null

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <StyledView className="flex-1 justify-end bg-black/70">
        <StyledView className="bg-zinc-950 rounded-t-3xl border-t border-zinc-800 p-5 max-h-[85%]">
          {/* Header */}
          <StyledView className="flex-row justify-between items-center pb-4 border-b border-zinc-900 mb-4">
            <StyledView className="flex-row items-center gap-2">
              <Download color="#0ea5e9" size={22} />
              <StyledText className="text-xl font-black text-white tracking-wide">
                EXPORT DATA
              </StyledText>
            </StyledView>
            <StyledTouchableOpacity
              testID="close-export-modal-button"
              onPress={onClose}
              className="p-1 rounded-full bg-zinc-900 border border-zinc-800">
              <X color="#9ca3af" size={20} />
            </StyledTouchableOpacity>
          </StyledView>

          <StyledScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Description */}
            <StyledText className="text-zinc-400 text-xs mb-4">
              Select a date range to export your journal entries, supplements,
              weight, and calorie logs directly to your clipboard.
            </StyledText>

            {/* Range Options */}
            <StyledText className="text-zinc-300 font-bold text-xs uppercase tracking-wider mb-2">
              Select Time Range
            </StyledText>
            <StyledView className="space-y-2 mb-4">
              <StyledView className="flex-row space-x-2">
                {[
                  { id: '1m', label: '1 Month', testID: 'export-range-1m' },
                  { id: '3m', label: '3 Months', testID: 'export-range-3m' },
                ].map((opt) => {
                  const isActive = rangeOption === opt.id
                  return (
                    <StyledTouchableOpacity
                      key={opt.id}
                      testID={opt.testID}
                      onPress={() =>
                        setRangeOption(opt.id as ExportDateRangeOption)
                      }
                      className={`flex-1 py-3 px-3 rounded-xl border items-center justify-center ${
                        isActive
                          ? 'bg-sky-600/20 border-sky-500'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}>
                      <StyledText
                        className={`text-xs font-bold ${
                          isActive ? 'text-sky-400' : 'text-zinc-400'
                        }`}>
                        {opt.label}
                      </StyledText>
                    </StyledTouchableOpacity>
                  )
                })}
              </StyledView>

              <StyledView className="flex-row space-x-2">
                {[
                  { id: '6m', label: '6 Months', testID: 'export-range-6m' },
                  {
                    id: 'custom',
                    label: 'Custom Range',
                    testID: 'export-range-custom',
                  },
                ].map((opt) => {
                  const isActive = rangeOption === opt.id
                  return (
                    <StyledTouchableOpacity
                      key={opt.id}
                      testID={opt.testID}
                      onPress={() =>
                        setRangeOption(opt.id as ExportDateRangeOption)
                      }
                      className={`flex-1 py-3 px-3 rounded-xl border items-center justify-center ${
                        isActive
                          ? 'bg-sky-600/20 border-sky-500'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}>
                      <StyledText
                        className={`text-xs font-bold ${
                          isActive ? 'text-sky-400' : 'text-zinc-400'
                        }`}>
                        {opt.label}
                      </StyledText>
                    </StyledTouchableOpacity>
                  )
                })}
              </StyledView>
            </StyledView>

            {/* Custom Date Pickers */}
            {rangeOption === 'custom' && (
              <StyledView className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl mb-4 space-y-3">
                <StyledText className="text-zinc-300 text-xs font-bold uppercase tracking-wider mb-1">
                  Custom Date Range (YYYY-MM-DD)
                </StyledText>
                <StyledView className="flex-row items-center space-x-3">
                  <StyledView className="flex-1">
                    <StyledText className="text-zinc-500 text-[10px] uppercase font-bold mb-1">
                      Start Date
                    </StyledText>
                    <StyledTouchableOpacity
                      onPress={() => setShowStartPicker(true)}
                      className="flex-row items-center justify-between bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl mb-2">
                      <StyledTextInput
                        testID="export-start-date-input"
                        value={customStartText}
                        onChangeText={handleCustomStartTextChange}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#52525b"
                        className="text-white text-xs font-mono flex-1 p-0"
                      />
                      <Calendar color="#71717a" size={16} />
                    </StyledTouchableOpacity>
                    {showStartPicker && (
                      <DateTimePicker
                        testID="export-start-datepicker"
                        value={customStartDate}
                        mode="date"
                        display="default"
                        onChange={handleCustomStartChange}
                      />
                    )}
                  </StyledView>

                  <StyledView className="flex-1">
                    <StyledText className="text-zinc-500 text-[10px] uppercase font-bold mb-1">
                      End Date
                    </StyledText>
                    <StyledTouchableOpacity
                      onPress={() => setShowEndPicker(true)}
                      className="flex-row items-center justify-between bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl mb-2">
                      <StyledTextInput
                        testID="export-end-date-input"
                        value={customEndText}
                        onChangeText={handleCustomEndTextChange}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#52525b"
                        className="text-white text-xs font-mono flex-1 p-0"
                      />
                      <Calendar color="#71717a" size={16} />
                    </StyledTouchableOpacity>
                    {showEndPicker && (
                      <DateTimePicker
                        testID="export-end-datepicker"
                        value={customEndDate}
                        mode="date"
                        display="default"
                        onChange={handleCustomEndChange}
                      />
                    )}
                  </StyledView>
                </StyledView>
              </StyledView>
            )}

            {/* Summary Box */}
            <StyledView className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-2xl mb-5 space-y-2">
              <StyledText className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                Data Summary to Export
              </StyledText>

              <StyledView className="flex-row justify-between items-center py-1 border-b border-zinc-800/50">
                <StyledText className="text-zinc-300 text-xs font-medium">
                  Journal Entries & Notes
                </StyledText>
                <StyledText
                  className="text-sky-400 text-xs font-bold"
                  testID="summary-count-journal">
                  {filteredData.journalEntries.length} items
                </StyledText>
              </StyledView>

              <StyledView className="flex-row justify-between items-center py-1 border-b border-zinc-800/50">
                <StyledText className="text-zinc-300 text-xs font-medium">
                  Supplements Logged
                </StyledText>
                <StyledText
                  className="text-violet-400 text-xs font-bold"
                  testID="summary-count-supplements">
                  {filteredData.supplements.length} items
                </StyledText>
              </StyledView>

              <StyledView className="flex-row justify-between items-center py-1 border-b border-zinc-800/50">
                <StyledText className="text-zinc-300 text-xs font-medium">
                  Weight Log Entries
                </StyledText>
                <StyledText
                  className="text-amber-400 text-xs font-bold"
                  testID="summary-count-weight">
                  {filteredData.weightLogs.length} items
                </StyledText>
              </StyledView>

              <StyledView className="flex-row justify-between items-center py-1">
                <StyledText className="text-zinc-300 text-xs font-medium">
                  Calorie Log Entries
                </StyledText>
                <StyledText
                  className="text-emerald-400 text-xs font-bold"
                  testID="summary-count-calories">
                  {filteredData.calorieLogs.length} items
                </StyledText>
              </StyledView>
            </StyledView>

            {/* Action Button */}
            <StyledTouchableOpacity
              testID="copy-export-button"
              onPress={handleCopy}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center py-4 px-5 rounded-2xl border shadow-lg mt-3 mb-6 mx-1 ${
                isCopied
                  ? 'bg-emerald-500/20 border-emerald-500/50'
                  : 'bg-sky-500/20 border-sky-500/50'
              }`}>
              {isCopied ? (
                <StyledView className="flex-row items-center justify-center gap-2">
                  <Check color="#10b981" size={18} />
                  <StyledText className="text-emerald-400 font-black text-sm tracking-wider uppercase">
                    COPIED TO CLIPBOARD!
                  </StyledText>
                </StyledView>
              ) : (
                <StyledView className="flex-row items-center justify-center gap-2">
                  <Copy color="#38bdf8" size={18} />
                  <StyledText className="text-sky-400 font-black text-sm tracking-wider uppercase">
                    COPY DATA TO CLIPBOARD
                  </StyledText>
                </StyledView>
              )}
            </StyledTouchableOpacity>
          </StyledScrollView>
        </StyledView>
      </StyledView>
    </Modal>
  )
}

export default ExportDataModal
