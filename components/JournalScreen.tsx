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
} from 'react-native'
import { styled } from 'nativewind'
import { Pencil, Trash2, Plus, X, Scale, Flame } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import DateTimePicker from '@react-native-community/datetimepicker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { JournalEntry, SupplementLog } from '../declarations'
import { DataHook } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledBlurView = styled(BlurView)
const StyledScrollView = styled(ScrollView)


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
  const suggestions = dataHook.settings.supplementSuggestions || []

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

  const handleRemoveSuggestion = async (nameToRemove: string) => {
    const currentSuggestions = dataHook.settings.supplementSuggestions || []
    const updatedSuggestions = currentSuggestions.filter(s => s.name.toLowerCase() !== nameToRemove.toLowerCase())
    await dataHook.saveSettings({
      ...dataHook.settings,
      supplementSuggestions: updatedSuggestions,
    }, user)
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

    if (editModal.item) {
      await updateJournalEntry(
        editModal.item.id,
        editNote,
        dateValue,
        user,
        supplementsList,
      )
    } else {
        await addJournalEntry(
            editNote,
            dateValue,
            user,
            supplementsList,
        )
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

  const renderItem = ({
    item,
  }: {
    item: JournalEntry
  }) => {
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
                  <StyledText className="text-violet-500 text-[9px] font-medium ml-1">
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
        <StyledTouchableOpacity
            testID="add-journal-note-button"
            onPress={handleOpenAddEntry}
            activeOpacity={0.7}
            className="bg-sky-600/20 p-2 rounded-full border border-sky-500/30">
            <Plus color="#0ea5e9" size={20} />
        </StyledTouchableOpacity>
      </StyledView>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        extraData={{ weightLookup, calorieLookup }}
        stickySectionHeadersEnabled={false}
        keyExtractor={(item) => item.id}
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
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
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
                        <StyledText className="text-violet-500 text-[9px] font-medium ml-1">
                          ({item.dosage})
                        </StyledText>
                      ) : null}
                      <StyledTouchableOpacity
                        onPress={() => {
                          setSupplementsList((prev) => prev.filter((_, i) => i !== index))
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
                      setSupplementsList(prev => [...prev, { name, dosage }])

                      // Persist to suggestions if not already present
                      const alreadyExists = suggestions.some(s => s.name.toLowerCase() === name.toLowerCase())
                      if (!alreadyExists) {
                        const updatedSuggestions = [...suggestions, { name, defaultDosage: dosage || '' }]
                        await dataHook.saveSettings({
                          ...dataHook.settings,
                          supplementSuggestions: updatedSuggestions,
                        }, user)
                      }

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
                      {searchQuery.trim() === '' ? 'Popular Supplements' : 'Suggestions'}
                    </StyledText>
                    <StyledTouchableOpacity onPress={() => setIsSearchFocused(false)}>
                      <StyledText className="text-zinc-500 text-[9px] font-bold">
                        Close
                      </StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>
                  <StyledScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                    keyboardShouldPersistTaps="handled">
                    {(() => {
                      const query = searchQuery.trim().toLowerCase()
                      const filtered = query
                        ? suggestions.filter(s => s.name.toLowerCase().includes(query))
                        : suggestions

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
                              {supp.name} {supp.defaultDosage ? <StyledText className="text-zinc-500 font-normal">({supp.defaultDosage})</StyledText> : null}
                            </StyledText>
                          </StyledTouchableOpacity>
                          <StyledTouchableOpacity
                            onPress={() => handleRemoveSuggestion(supp.name)}
                            className="bg-zinc-800 hover:bg-zinc-700 p-0.5 rounded"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                if (weight === undefined && calories === undefined) return null

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
                      <StyledText className="text-zinc-650 text-xs italic font-bold">No weight logged</StyledText>
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
                      <StyledText className="text-zinc-650 text-xs italic font-bold">No calories logged</StyledText>
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
      </Modal>
    </StyledView>
  )
}

export default JournalScreen
