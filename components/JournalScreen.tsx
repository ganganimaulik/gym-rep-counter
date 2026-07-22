import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { styled } from 'nativewind'
import {
  Pencil,
  Trash2,
  Plus,
  X,
  Scale,
  Flame,
  Check,
  AlertTriangle,
  Calendar,
  Download,
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import DateTimePicker from '@react-native-community/datetimepicker'
import ExportDataModal from './ExportDataModal'

import type { User as FirebaseUser } from 'firebase/auth'
import type { JournalEntry, SupplementLog } from '../declarations'
import { DataHook } from '../hooks/useData'
import {
  SupplementSuggestion,
  SupplementScheduleType,
  getSupplementsDueToday,
  getUntakenSupplements,
  hasJournalEntryForDate,
  isSupplementDueOnDate,
  getSupplementsTakenOnDate,
} from '../utils/supplementSchedule'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledBlurView = styled(BlurView)
const StyledScrollView = styled(ScrollView)

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const SCHEDULE_OPTIONS: { value: SupplementScheduleType; label: string }[] = [
  { value: 'none', label: 'Not Scheduled' },
  { value: 'daily', label: 'Daily' },
  { value: 'specific_days', label: 'Specific Days' },
  { value: 'every_other_day', label: 'Every Other Day' },
]

interface JournalScreenProps {
  visible: boolean
  user: FirebaseUser | null
  dataHook: DataHook
}

interface EditModalState {
  visible: boolean
  item: JournalEntry | null
}

const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

const JournalScreen: React.FC<JournalScreenProps> = ({
  visible,
  user,
  dataHook,
}) => {
  const {
    fetchJournalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    journalEntries,
    weightLogs,
    calorieLogs,
  } = dataHook
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [editModal, setEditModal] = useState<EditModalState>({
    visible: false,
    item: null,
  })
  const [editNote, setEditNote] = useState('')
  const [dateValue, setDateValue] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [supplementsList, setSupplementsList] = useState<SupplementLog[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dosageQuery, setDosageQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [scheduleModalSupp, setScheduleModalSupp] =
    useState<SupplementSuggestion | null>(null)
  const [manageModalVisible, setManageModalVisible] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const suggestions = dataHook.settings.supplementSuggestions || []

  // Migrate existing scheduled supplements that don't have a scheduleActivatedDate
  useEffect(() => {
    const needsMigration = suggestions.some(
      (s) => s.schedule && s.schedule !== 'none' && !s.scheduleActivatedDate,
    )
    if (needsMigration) {
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
      const migrated = suggestions.map((s) => {
        if (s.schedule && s.schedule !== 'none' && !s.scheduleActivatedDate) {
          return { ...s, scheduleActivatedDate: todayStr }
        }
        return s
      })
      dataHook.saveSettings(
        { ...dataHook.settings, supplementSuggestions: migrated },
        user,
      )
    }
  }, [])

  // Today's supplement status
  const today = useMemo(() => new Date(), [])
  const supplementsDueToday = useMemo(
    () => getSupplementsDueToday(suggestions, today, journalEntries),
    [suggestions, today, journalEntries],
  )
  const untakenSupplementsToday = useMemo(
    () => getUntakenSupplements(supplementsDueToday, journalEntries, today),
    [supplementsDueToday, journalEntries, today],
  )
  const hasJournalToday = useMemo(
    () => hasJournalEntryForDate(journalEntries, today),
    [journalEntries, today],
  )

  const sortedSuggestions = useMemo(() => {
    const takenOnDate = getSupplementsTakenOnDate(journalEntries, dateValue)
    const isTaken = (name: string) =>
      supplementsList.some(
        (s) => s.name.toLowerCase() === name.toLowerCase(),
      ) || takenOnDate.includes(name.toLowerCase())

    const isForgot = (supp: SupplementSuggestion) =>
      isSupplementDueOnDate(supp, dateValue, journalEntries) &&
      !isTaken(supp.name)

    const forgotList: SupplementSuggestion[] = []
    const otherList: SupplementSuggestion[] = []

    for (const supp of suggestions) {
      if (isForgot(supp)) {
        forgotList.push(supp)
      } else {
        otherList.push(supp)
      }
    }

    return [...forgotList, ...otherList]
  }, [suggestions, dateValue, journalEntries, supplementsList])

  const handleToggleSupplementToday = useCallback(
    async (suppName: string, defaultDosage?: string) => {
      const todayDate = new Date()
      const dateKey = getLocalDateKey(todayDate)

      // Find if there is an existing journal entry for today
      const existingEntry = journalEntries.find((entry) => {
        if (!entry.date || typeof entry.date.toDate !== 'function') return false
        return getLocalDateKey(entry.date.toDate()) === dateKey
      })

      const nameLower = suppName.toLowerCase()

      if (existingEntry) {
        const isAlreadyTaken = (existingEntry.supplements || []).some(
          (s) => s.name.toLowerCase() === nameLower,
        )

        let updatedSupplements: SupplementLog[]
        if (isAlreadyTaken) {
          // Remove it (toggle off)
          updatedSupplements = (existingEntry.supplements || []).filter(
            (s) => s.name.toLowerCase() !== nameLower,
          )
        } else {
          // Add it
          updatedSupplements = [
            ...(existingEntry.supplements || []),
            { name: suppName, dosage: defaultDosage || '' },
          ]
        }

        await updateJournalEntry(
          existingEntry.id,
          existingEntry.note,
          existingEntry.date.toDate(),
          user,
          updatedSupplements,
        )
      } else {
        // Create new entry
        await addJournalEntry('Logged supplements', todayDate, user, [
          { name: suppName, dosage: defaultDosage || '' },
        ])
      }
    },
    [journalEntries, user, addJournalEntry, updateJournalEntry],
  )

  const handleUpdateSchedule = useCallback(
    async (
      suppName: string,
      schedule: SupplementScheduleType,
      scheduleDays?: number[],
    ) => {
      const currentSuggestions = dataHook.settings.supplementSuggestions || []
      const updatedSuggestions = currentSuggestions.map((s) => {
        if (s.name.toLowerCase() === suppName.toLowerCase()) {
          const updated: SupplementSuggestion = { ...s, schedule }
          if (schedule === 'specific_days') {
            updated.scheduleDays = scheduleDays || []
          } else {
            delete updated.scheduleDays
          }
          if (schedule === 'every_other_day' && !s.scheduleStartDate) {
            const now = new Date()
            updated.scheduleStartDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
          } else if (schedule !== 'every_other_day') {
            delete updated.scheduleStartDate
          }
          // Track when the schedule was activated (only set if not already present)
          if (schedule !== 'none' && !s.scheduleActivatedDate) {
            const now = new Date()
            updated.scheduleActivatedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
          } else if (schedule === 'none') {
            delete updated.scheduleActivatedDate
          }
          return updated
        }
        return s
      })
      await dataHook.saveSettings(
        { ...dataHook.settings, supplementSuggestions: updatedSuggestions },
        user,
      )
      // Keep the accordion open with updated data
      const updatedSupp = updatedSuggestions.find(
        (s) => s.name.toLowerCase() === suppName.toLowerCase(),
      )
      if (updatedSupp) {
        setScheduleModalSupp(updatedSupp)
      }
    },
    [dataHook, user],
  )

  const weightLookup = useMemo(() => {
    const lookup: Record<string, number> = {}
    weightLogs.forEach((log) => {
      if (log.date && typeof log.date.toDate === 'function') {
        const d = log.date.toDate()
        const key = getLocalDateKey(d)
        if (lookup[key] === undefined) {
          lookup[key] = log.weight
        }
      }
    })
    return lookup
  }, [weightLogs])

  const calorieLookup = useMemo(() => {
    const lookup: Record<string, number> = {}
    calorieLogs.forEach((log) => {
      if (log.date && typeof log.date.toDate === 'function') {
        const d = log.date.toDate()
        const key = getLocalDateKey(d)
        if (lookup[key] === undefined) {
          lookup[key] = log.calories
        }
      }
    })
    return lookup
  }, [calorieLogs])

  const updatePopularSupplements = useCallback(
    async (supplementsToSync: SupplementLog[]) => {
      if (!supplementsToSync || supplementsToSync.length === 0) return

      const currentSuggestions = dataHook.settings.supplementSuggestions || []
      const updatedSuggestions = [...currentSuggestions]
      let hasChanges = false

      supplementsToSync.forEach((supp) => {
        const name = supp.name.trim()
        if (!name) return
        const dosage = supp.dosage ? supp.dosage.trim() : ''

        const existingIndex = updatedSuggestions.findIndex(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        )

        if (existingIndex === -1) {
          updatedSuggestions.push({ name, defaultDosage: dosage })
          hasChanges = true
        } else if (updatedSuggestions[existingIndex].defaultDosage !== dosage) {
          updatedSuggestions[existingIndex] = {
            ...updatedSuggestions[existingIndex],
            defaultDosage: dosage,
          }
          hasChanges = true
        }
      })

      if (hasChanges) {
        await dataHook.saveSettings(
          {
            ...dataHook.settings,
            supplementSuggestions: updatedSuggestions,
          },
          user,
        )
      }
    },
    [dataHook.settings, dataHook.saveSettings, user],
  )

  const handleRemoveSuggestion = (nameToRemove: string) => {
    const performDelete = async () => {
      const currentSuggestions = dataHook.settings.supplementSuggestions || []
      const updatedSuggestions = currentSuggestions.filter(
        (s) => s.name.toLowerCase() !== nameToRemove.toLowerCase(),
      )
      await dataHook.saveSettings(
        {
          ...dataHook.settings,
          supplementSuggestions: updatedSuggestions,
        },
        user,
      )
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (
          window.confirm(
            `Are you sure you want to delete "${nameToRemove}" from popular supplements?`,
          )
        ) {
          performDelete()
        }
      } else {
        performDelete()
      }
    } else {
      Alert.alert(
        'Delete Supplement',
        `Are you sure you want to delete "${nameToRemove}" from popular supplements?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              performDelete()
            },
          },
        ],
      )
    }
  }

  const loadEntries = useCallback(async () => {
    if (isLoading) return

    setIsLoading(true)
    await fetchJournalEntries(user)

    setIsInitialLoad(false)
    setIsLoading(false)
  }, [user, isLoading, fetchJournalEntries])

  useEffect(() => {
    if (visible && isInitialLoad) {
      loadEntries()
    }
  }, [visible, isInitialLoad, loadEntries])

  const handleOpenAddEntry = () => {
    setEditModal({ visible: true, item: null })
    setEditNote('')
    setDateValue(new Date())
    setShowDatePicker(false)
    setSupplementsList([])
    setSearchQuery('')
    setDosageQuery('')
    setIsSearchFocused(false)
  }

  const handleItemPress = (item: JournalEntry) => {
    setEditNote(item.note)
    setDateValue(item.date.toDate())
    setEditModal({ visible: true, item })
    setShowDatePicker(false)
    setSupplementsList(item.supplements || [])
    setSearchQuery('')
    setDosageQuery('')
    setIsSearchFocused(false)
  }

  const handleEditSave = async () => {
    if (!editNote.trim()) {
      return
    }

    await updatePopularSupplements(supplementsList)

    if (editModal.item) {
      await updateJournalEntry(
        editModal.item.id,
        editNote,
        dateValue,
        user,
        supplementsList,
      )
    } else {
      await addJournalEntry(editNote, dateValue, user, supplementsList)
    }

    setEditModal({ visible: false, item: null })
    setEditNote('')
    setSupplementsList([])
    setSearchQuery('')
    setDosageQuery('')
    setIsSearchFocused(false)
  }

  const handleEditClose = () => {
    setEditModal({ visible: false, item: null })
    setEditNote('')
    setSupplementsList([])
    setSearchQuery('')
    setDosageQuery('')
    setIsSearchFocused(false)
  }

  const handleDelete = async () => {
    if (!editModal.item) return

    await deleteJournalEntry(editModal.item.id, user)
    setEditModal({ visible: false, item: null })
    setEditNote('')
    setSupplementsList([])
    setSearchQuery('')
    setDosageQuery('')
    setIsSearchFocused(false)
  }

  const renderItem = ({ item }: { item: JournalEntry }) => {
    if (!item.date || typeof item.date.toDate !== 'function') {
      return null
    }

    return (
      <StyledTouchableOpacity
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
        className="bg-zinc-900 border border-zinc-800/85 p-4 rounded-2xl mb-3 shadow-xl">
        <StyledView className="flex-row justify-between items-start">
          <StyledView className="flex-1">
            <StyledText className="text-white font-medium text-sm leading-5">
              {item.note}
            </StyledText>
          </StyledView>
          <StyledView className="flex-row items-center ml-2">
            <Pencil color="#71717a" size={14} />
          </StyledView>
        </StyledView>
        {item.supplements && item.supplements.length > 0 && (
          <StyledView className="flex-row flex-wrap gap-1.5 mt-3">
            {item.supplements.map((supp, index) => (
              <StyledView
                key={index}
                className="bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-lg flex-row items-center">
                <StyledText className="text-violet-400 font-semibold text-[10px] tracking-wide">
                  {supp.name}
                </StyledText>
                {supp.dosage ? (
                  <StyledText className="text-violet-300 text-[9px] font-medium ml-1">
                    {supp.dosage}
                  </StyledText>
                ) : null}
              </StyledView>
            ))}
          </StyledView>
        )}
        <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-3">
          {item.date.toDate().toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </StyledText>
      </StyledTouchableOpacity>
    )
  }

  // Compute missed supplements for a given date key (YYYY-MM-DD)
  const getMissedSupplementsForDate = useCallback(
    (dateKey: string): SupplementSuggestion[] => {
      const parts = dateKey.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const date = new Date(year, month, day)

      // Only show missed for past days. Today is handled by the
      // clickable "Today's Supplements" panel at the top of the screen.
      const now = new Date()
      const todayKey = getLocalDateKey(now)
      if (dateKey >= todayKey) return []

      const dueSupplements = getSupplementsDueToday(
        suggestions,
        date,
        journalEntries,
      )
      if (dueSupplements.length === 0) return []

      return getUntakenSupplements(dueSupplements, journalEntries, date)
    },
    [suggestions, journalEntries],
  )

  const sections = useMemo(() => {
    const grouped = journalEntries
      .filter((item) => item.date && typeof item.date.toDate === 'function')
      .reduce(
        (acc, item) => {
          const d = item.date.toDate()
          const year = d.getFullYear()
          const month = (d.getMonth() + 1).toString().padStart(2, '0')
          const day = d.getDate().toString().padStart(2, '0')
          const dateKey = `${year}-${month}-${day}`

          if (!acc[dateKey]) {
            acc[dateKey] = []
          }
          acc[dateKey].push(item)
          return acc
        },
        {} as Record<string, JournalEntry[]>,
      )

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a)) // Sorts YYYY-MM-DD strings descending
      .map((date) => ({
        title: date,
        data: grouped[date],
      }))
  }, [journalEntries])

  if (!visible) return null

  return (
    <StyledView className="flex-1 bg-zinc-950 p-4">
      {/* Header */}
      <StyledView className="flex-row justify-between items-center pb-3 border-b border-zinc-900 mb-4">
        <StyledText className="text-2xl font-black text-white">
          JOURNAL
        </StyledText>
        <StyledView className="flex-row items-center gap-2">
          <StyledTouchableOpacity
            testID="export-journal-button"
            onPress={() => setExportModalVisible(true)}
            activeOpacity={0.7}
            className="bg-zinc-900 p-2 rounded-full border border-zinc-800">
            <Download color="#0ea5e9" size={20} />
          </StyledTouchableOpacity>
          <StyledTouchableOpacity
            testID="add-journal-note-button"
            onPress={handleOpenAddEntry}
            activeOpacity={0.7}
            className="bg-sky-600/20 p-2 rounded-full border border-sky-500/30">
            <Plus color="#0ea5e9" size={20} />
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        extraData={{ weightLookup, calorieLookup }}
        stickySectionHeadersEnabled={false}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          /* Today's Supplements Status Panel — untaken only, tap to log.
             Rendered as the list header so it scrolls away with content. */
          untakenSupplementsToday.length > 0 ? (
            <StyledView
              testID="supplement-status-panel"
              className="bg-zinc-900 border border-zinc-800/85 rounded-2xl p-4 mb-4">
              <StyledView className="flex-row justify-between items-center mb-3">
                <StyledText className="text-zinc-400 text-[10px] font-black tracking-[0.15em] uppercase">
                  {"Today's Supplements"}
                </StyledText>
                {!hasJournalToday && (
                  <StyledView
                    testID="journal-reminder-badge"
                    className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg flex-row items-center gap-1">
                    <StyledText className="text-amber-400 text-[9px] font-bold">
                      📓 No journal entry
                    </StyledText>
                  </StyledView>
                )}
              </StyledView>
              <StyledView className="flex-row flex-wrap gap-2">
                {untakenSupplementsToday.map((supp) => (
                  <StyledTouchableOpacity
                    key={supp.name}
                    testID={`supplement-status-${supp.name.replace(/\s+/g, '-').toLowerCase()}`}
                    onPress={() =>
                      handleToggleSupplementToday(supp.name, supp.defaultDosage)
                    }
                    activeOpacity={0.7}
                    className="px-2.5 py-1.5 rounded-xl flex-row items-center gap-1.5 border bg-amber-500/10 border-amber-500/30">
                    <AlertTriangle color="#f59e0b" size={10} />
                    <StyledText className="text-[10px] font-semibold tracking-wide text-amber-400">
                      {supp.name}
                    </StyledText>
                    {supp.defaultDosage ? (
                      <StyledText className="text-[9px] font-medium text-amber-300">
                        {supp.defaultDosage}
                      </StyledText>
                    ) : null}
                  </StyledTouchableOpacity>
                ))}
              </StyledView>
            </StyledView>
          ) : null
        }
        renderSectionHeader={({ section: { title } }) => {
          const parts = title.split('-')
          const year = parseInt(parts[0], 10)
          const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
          const day = parseInt(parts[2], 10)
          const date = new Date(year, month, day)

          const weight = weightLookup[title]
          const calories = calorieLookup[title]
          const weightUnit = dataHook.tdeeConfig?.weightUnit ?? 'kg'

          return (
            <StyledView className="flex-row justify-between items-center mt-5 mb-3">
              <StyledText className="text-zinc-500 text-xs font-black tracking-[0.2em] uppercase">
                {date.toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </StyledText>
              {(weight !== undefined || calories !== undefined) && (
                <StyledView className="flex-row items-center gap-2">
                  {weight !== undefined && (
                    <StyledView className="flex-row items-center bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-xl gap-1">
                      <Scale color="#10b981" size={10} />
                      <StyledText className="text-zinc-300 font-extrabold text-[10px]">
                        {weight} {weightUnit}
                      </StyledText>
                    </StyledView>
                  )}
                  {calories !== undefined && (
                    <StyledView className="flex-row items-center bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-xl gap-1">
                      <Flame color="#ef4444" size={10} />
                      <StyledText className="text-zinc-300 font-extrabold text-[10px]">
                        {calories} kcal
                      </StyledText>
                    </StyledView>
                  )}
                </StyledView>
              )}
            </StyledView>
          )
        }}
        renderSectionFooter={({ section: { title } }) => {
          const missed = getMissedSupplementsForDate(title)
          if (missed.length === 0) return null

          return (
            <StyledView
              testID={`missed-supplements-${title}`}
              className="bg-red-950/15 border border-red-900/20 rounded-2xl p-3 mb-3 mt-1">
              <StyledView className="flex-row items-center gap-1.5 mb-2">
                <AlertTriangle color="#ef4444" size={10} />
                <StyledText className="text-red-400 text-[10px] font-black tracking-[0.15em] uppercase">
                  Missed Supplements
                </StyledText>
              </StyledView>
              <StyledView className="flex-row flex-wrap gap-1.5">
                {missed.map((supp) => (
                  <StyledView
                    key={supp.name}
                    className="bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-lg flex-row items-center">
                    <StyledText className="text-red-400 font-semibold text-[10px] tracking-wide">
                      {supp.name}
                    </StyledText>
                    {supp.defaultDosage ? (
                      <StyledText className="text-red-300 text-[9px] font-medium ml-1">
                        {supp.defaultDosage}
                      </StyledText>
                    ) : null}
                  </StyledView>
                ))}
              </StyledView>
            </StyledView>
          )
        }}
        contentContainerStyle={{ paddingBottom: 60 }}
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color="#ffffff"
              style={{ marginTop: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && journalEntries.length === 0 ? (
            <StyledText className="text-zinc-500 text-center font-semibold mt-16 text-sm">
              No journal entries yet. Tap the + icon to add your first note!
            </StyledText>
          ) : null
        }
      />

      {/* Edit/Add Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModal.visible}
        onRequestClose={handleEditClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <StyledBlurView
            intensity={25}
            tint="dark"
            className="flex-1 justify-center items-center px-4 bg-black/60">
            <StyledView className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl max-h-[85%] overflow-hidden">
              <StyledText className="text-white text-xl font-black pt-6 px-6 pb-2 text-center">
                {editModal.item ? 'Edit Note' : 'New Note'}
              </StyledText>

              <StyledScrollView
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingBottom: 24,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}>
                <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 mt-4 uppercase tracking-wide">
                  Note
                </StyledText>
                <StyledTextInput
                  className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-medium text-sm min-h-[100]"
                  multiline
                  textAlignVertical="top"
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="How did you feel today?"
                  placeholderTextColor="#52525b"
                  autoFocus={true}
                />

                <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                  Supplements Taken
                </StyledText>

                {/* Added Supplements List */}
                {supplementsList.length > 0 && (
                  <StyledView className="flex-row flex-wrap gap-1.5 mb-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                    {supplementsList.map((item, index) => (
                      <StyledView
                        key={index}
                        className="bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-lg flex-row items-center">
                        <StyledText className="text-violet-300 font-semibold text-[10px] tracking-wide">
                          {item.name}
                        </StyledText>
                        {item.dosage ? (
                          <StyledText className="text-violet-300 text-[9px] font-medium ml-1">
                            ({item.dosage})
                          </StyledText>
                        ) : null}
                        <StyledTouchableOpacity
                          onPress={() => {
                            setSupplementsList((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }}
                          className="ml-1.5 bg-violet-500/20 p-0.5 rounded-full"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X color="#a78bfa" size={8} />
                        </StyledTouchableOpacity>
                      </StyledView>
                    ))}
                  </StyledView>
                )}

                {/* Add Supplement Inputs */}
                <StyledView className="flex-row gap-2 items-center mb-3">
                  <StyledView className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                    <StyledTextInput
                      className="text-white px-3 py-2 font-medium text-xs"
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text)
                        setIsSearchFocused(true)
                      }}
                      onFocus={() => setIsSearchFocused(true)}
                      placeholder="Search/Add Supp..."
                      placeholderTextColor="#52525b"
                    />
                  </StyledView>
                  <StyledView className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl">
                    <StyledTextInput
                      className="text-white px-2 py-2 font-medium text-xs text-center"
                      value={dosageQuery}
                      onChangeText={setDosageQuery}
                      placeholder="Dosage"
                      placeholderTextColor="#52525b"
                    />
                  </StyledView>
                  <StyledTouchableOpacity
                    onPress={async () => {
                      const name = searchQuery.trim()
                      if (name) {
                        const dosage = dosageQuery.trim() || undefined
                        const newSupp = { name, dosage }
                        setSupplementsList((prev) => [...prev, newSupp])
                        await updatePopularSupplements([newSupp])

                        setSearchQuery('')
                        setDosageQuery('')
                        setIsSearchFocused(false)
                      }
                    }}
                    activeOpacity={0.7}
                    testID="add-supplement-button"
                    className="bg-violet-600/20 border border-violet-500/30 p-2 rounded-xl">
                    <Plus color="#a78bfa" size={14} />
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Suggestions Box */}
                {isSearchFocused && (
                  <StyledView className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl mb-3">
                    <StyledView className="flex-row justify-between items-center mb-1.5 px-1 border-b border-zinc-900 pb-1">
                      <StyledText className="text-zinc-500 text-[9px] font-black tracking-wider uppercase">
                        {searchQuery.trim() === ''
                          ? 'Popular Supplements'
                          : 'Suggestions'}
                      </StyledText>
                      <StyledView className="flex-row items-center gap-3">
                        <StyledTouchableOpacity
                          testID="manage-supplements-button"
                          onPress={() => {
                            setIsSearchFocused(false)
                            setManageModalVisible(true)
                          }}>
                          <StyledText className="text-indigo-400 text-[9px] font-bold">
                            Manage
                          </StyledText>
                        </StyledTouchableOpacity>
                        <StyledTouchableOpacity
                          onPress={() => setIsSearchFocused(false)}>
                          <StyledText className="text-zinc-500 text-[9px] font-bold">
                            Close
                          </StyledText>
                        </StyledTouchableOpacity>
                      </StyledView>
                    </StyledView>
                    <StyledScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                      keyboardShouldPersistTaps="handled">
                      {(() => {
                        const query = searchQuery.trim().toLowerCase()
                        const filtered = query
                          ? sortedSuggestions.filter((s) =>
                              s.name.toLowerCase().includes(query),
                            )
                          : sortedSuggestions

                        if (filtered.length === 0) {
                          return (
                            <StyledText className="text-zinc-555 text-[10px] italic px-1">
                              No match. Tap &quot;+&quot; to add custom.
                            </StyledText>
                          )
                        }

                        return filtered.map((supp, idx) => (
                          <StyledView
                            key={idx}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg flex-row items-center pl-2.5 pr-1.5 py-1">
                            <StyledTouchableOpacity
                              onPress={() => {
                                setSearchQuery(supp.name)
                                setDosageQuery(supp.defaultDosage)
                                setIsSearchFocused(false)
                              }}
                              className="mr-2">
                              <StyledText className="text-zinc-300 text-[10px] font-semibold">
                                {supp.name}{' '}
                                {supp.defaultDosage ? (
                                  <StyledText className="text-zinc-500 font-normal">
                                    ({supp.defaultDosage})
                                  </StyledText>
                                ) : null}
                              </StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                              testID={`remove-suggestion-${supp.name}`}
                              onPress={() => handleRemoveSuggestion(supp.name)}
                              className="bg-zinc-800 hover:bg-zinc-700 p-0.5 rounded"
                              hitSlop={{
                                top: 8,
                                bottom: 8,
                                left: 8,
                                right: 8,
                              }}>
                              <X color="#71717a" size={8} />
                            </StyledTouchableOpacity>
                          </StyledView>
                        ))
                      })()}
                    </StyledScrollView>
                  </StyledView>
                )}

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
                    <StyledText className="text-sky-400 font-extrabold text-xs uppercase tracking-wider">
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

                {/* Daily Stats for the selected date */}
                {(() => {
                  const dateKey = getLocalDateKey(dateValue)
                  const weight = weightLookup[dateKey]
                  const calories = calorieLookup[dateKey]
                  const weightUnit = dataHook.tdeeConfig?.weightUnit ?? 'kg'
                  if (weight === undefined && calories === undefined)
                    return null

                  return (
                    <StyledView className="mb-4 bg-zinc-950 border border-zinc-850 p-3 rounded-xl flex-row justify-around items-center">
                      {weight !== undefined ? (
                        <StyledView className="flex-row items-center gap-1.5">
                          <Scale color="#10b981" size={12} />
                          <StyledText className="text-zinc-300 font-extrabold text-xs">
                            {weight} {weightUnit}
                          </StyledText>
                        </StyledView>
                      ) : (
                        <StyledText className="text-zinc-650 text-xs italic font-bold">
                          No weight logged
                        </StyledText>
                      )}
                      <StyledView className="w-[1px] h-4 bg-zinc-800" />
                      {calories !== undefined ? (
                        <StyledView className="flex-row items-center gap-1.5">
                          <Flame color="#ef4444" size={12} />
                          <StyledText className="text-zinc-300 font-extrabold text-xs">
                            {calories} kcal
                          </StyledText>
                        </StyledView>
                      ) : (
                        <StyledText className="text-zinc-650 text-xs italic font-bold">
                          No calories logged
                        </StyledText>
                      )}
                    </StyledView>
                  )
                })()}

                <StyledView className="flex-row gap-3 mt-2">
                  <StyledTouchableOpacity
                    onPress={handleEditClose}
                    activeOpacity={0.7}
                    className="flex-1 bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center">
                    <StyledText className="text-zinc-300 font-bold text-sm">
                      Cancel
                    </StyledText>
                  </StyledTouchableOpacity>
                  <StyledTouchableOpacity
                    onPress={handleEditSave}
                    activeOpacity={0.7}
                    testID="journal-note-save-button"
                    className="flex-1 bg-sky-600 py-3 rounded-xl items-center shadow-lg shadow-sky-600/15">
                    <StyledText className="text-white font-bold text-sm">
                      Save
                    </StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
                {editModal.item && (
                  <StyledTouchableOpacity
                    testID="journal-note-delete-button"
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    className="mt-4 bg-red-950/20 border border-red-900/30 py-2.5 rounded-xl items-center flex-row justify-center">
                    <Trash2 color="#ef4444" size={16} />
                    <StyledText className="text-red-500 font-bold text-xs ml-2 uppercase tracking-wider">
                      Delete Note
                    </StyledText>
                  </StyledTouchableOpacity>
                )}
              </StyledScrollView>
            </StyledView>
          </StyledBlurView>
        </KeyboardAvoidingView>

        {/* Manage Supplements Modal — nested inside edit modal for iOS */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={manageModalVisible}
          onRequestClose={() => setManageModalVisible(false)}>
          <StyledBlurView
            intensity={25}
            tint="dark"
            className="flex-1 justify-end bg-black/60">
            <StyledView className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl shadow-2xl max-h-[85%]">
              <StyledView className="flex-row justify-between items-center px-6 pt-6 pb-3">
                <StyledText className="text-white text-lg font-black">
                  Manage Supplements
                </StyledText>
                <StyledTouchableOpacity
                  testID="close-manage-modal"
                  onPress={() => setManageModalVisible(false)}
                  className="bg-zinc-800 p-1.5 rounded-full">
                  <X color="#a1a1aa" size={16} />
                </StyledTouchableOpacity>
              </StyledView>
              <StyledText className="text-zinc-500 text-[10px] font-semibold px-6 mb-4">
                Set a schedule to track daily intake. Tap a supplement to
                configure.
              </StyledText>
              <StyledScrollView
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingBottom: 32,
                }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled">
                {suggestions.map((supp, idx) => {
                  const isExpanded = scheduleModalSupp?.name === supp.name
                  const scheduleLabel =
                    !supp.schedule || supp.schedule === 'none'
                      ? 'Not scheduled'
                      : supp.schedule === 'daily'
                        ? 'Daily'
                        : supp.schedule === 'specific_days'
                          ? (supp.scheduleDays || [])
                              .map((d) => DAY_LABELS[d])
                              .join(', ')
                          : 'Every other day'

                  return (
                    <StyledView key={idx} className="mb-2">
                      <StyledTouchableOpacity
                        testID={`manage-supplement-${supp.name}`}
                        onPress={() =>
                          setScheduleModalSupp(isExpanded ? null : supp)
                        }
                        activeOpacity={0.7}
                        className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                          isExpanded
                            ? 'bg-indigo-500/10 border-indigo-500/25'
                            : 'bg-zinc-950 border-zinc-800'
                        }`}>
                        <StyledView className="flex-1">
                          <StyledText className="text-white text-sm font-bold">
                            {supp.name}
                          </StyledText>
                          <StyledView className="flex-row items-center gap-2 mt-0.5">
                            {supp.defaultDosage ? (
                              <StyledText className="text-zinc-500 text-[10px] font-medium">
                                {supp.defaultDosage}
                              </StyledText>
                            ) : null}
                            <StyledView
                              className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${
                                supp.schedule && supp.schedule !== 'none'
                                  ? 'bg-indigo-500/15'
                                  : 'bg-zinc-800'
                              }`}>
                              <Calendar
                                color={
                                  supp.schedule && supp.schedule !== 'none'
                                    ? '#818cf8'
                                    : '#52525b'
                                }
                                size={8}
                              />
                              <StyledText
                                className={`text-[9px] font-bold ${
                                  supp.schedule && supp.schedule !== 'none'
                                    ? 'text-indigo-400'
                                    : 'text-zinc-600'
                                }`}>
                                {scheduleLabel}
                              </StyledText>
                            </StyledView>
                          </StyledView>
                        </StyledView>
                        <StyledTouchableOpacity
                          testID={`remove-manage-${supp.name}`}
                          onPress={() => {
                            handleRemoveSuggestion(supp.name)
                          }}
                          className="ml-3"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 color="#52525b" size={14} />
                        </StyledTouchableOpacity>
                      </StyledTouchableOpacity>

                      {/* Expanded schedule config */}
                      {isExpanded && (
                        <StyledView className="bg-zinc-950 border border-zinc-800 border-t-0 rounded-b-2xl -mt-1 pt-3 px-3.5 pb-3">
                          <StyledView className="gap-1.5 mb-3">
                            {SCHEDULE_OPTIONS.map((opt) => {
                              const isActive =
                                (supp.schedule ?? 'none') === opt.value
                              return (
                                <StyledTouchableOpacity
                                  key={opt.value}
                                  testID={`schedule-option-${opt.value}`}
                                  onPress={() =>
                                    handleUpdateSchedule(
                                      supp.name,
                                      opt.value,
                                      opt.value === 'specific_days'
                                        ? supp.scheduleDays || []
                                        : undefined,
                                    )
                                  }
                                  activeOpacity={0.7}
                                  className={`flex-row items-center justify-between py-2.5 px-3 rounded-xl border ${
                                    isActive
                                      ? 'bg-indigo-500/15 border-indigo-500/30'
                                      : 'bg-zinc-900 border-zinc-800/50'
                                  }`}>
                                  <StyledText
                                    className={`text-xs font-bold ${
                                      isActive
                                        ? 'text-indigo-400'
                                        : 'text-zinc-400'
                                    }`}>
                                    {opt.label}
                                  </StyledText>
                                  {isActive && (
                                    <Check color="#818cf8" size={14} />
                                  )}
                                </StyledTouchableOpacity>
                              )
                            })}
                          </StyledView>

                          {/* Day picker for specific_days */}
                          {(supp.schedule ?? 'none') === 'specific_days' && (
                            <StyledView>
                              <StyledText className="text-zinc-500 text-[9px] font-black tracking-wider uppercase mb-2">
                                Select Days
                              </StyledText>
                              <StyledView className="flex-row justify-between gap-1.5">
                                {DAY_LABELS.map((label, dayIndex) => {
                                  const isSelected = (
                                    supp.scheduleDays || []
                                  ).includes(dayIndex)
                                  return (
                                    <StyledTouchableOpacity
                                      key={dayIndex}
                                      testID={`schedule-day-${dayIndex}`}
                                      onPress={() => {
                                        const currentDays =
                                          supp.scheduleDays || []
                                        const newDays = isSelected
                                          ? currentDays.filter(
                                              (d) => d !== dayIndex,
                                            )
                                          : [...currentDays, dayIndex].sort()
                                        setScheduleModalSupp({
                                          ...supp,
                                          scheduleDays: newDays,
                                        })
                                        handleUpdateSchedule(
                                          supp.name,
                                          'specific_days',
                                          newDays,
                                        )
                                      }}
                                      activeOpacity={0.7}
                                      className={`flex-1 items-center py-2 rounded-lg border ${
                                        isSelected
                                          ? 'bg-indigo-500/20 border-indigo-500/30'
                                          : 'bg-zinc-900 border-zinc-800'
                                      }`}>
                                      <StyledText
                                        className={`text-xs font-black ${
                                          isSelected
                                            ? 'text-indigo-400'
                                            : 'text-zinc-500'
                                        }`}>
                                        {label}
                                      </StyledText>
                                    </StyledTouchableOpacity>
                                  )
                                })}
                              </StyledView>
                            </StyledView>
                          )}
                        </StyledView>
                      )}
                    </StyledView>
                  )
                })}
              </StyledScrollView>
            </StyledView>
          </StyledBlurView>
        </Modal>
      </Modal>

      <ExportDataModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />
    </StyledView>
  )
}

export default JournalScreen
