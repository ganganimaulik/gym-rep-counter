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
} from 'react-native'
import { styled } from 'nativewind'
import { Pencil, Trash2, Plus } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import DateTimePicker from '@react-native-community/datetimepicker'

import type { User as FirebaseUser } from 'firebase/auth'
import type { JournalEntry } from '../declarations'
import { DataHook } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledBlurView = styled(BlurView)

interface JournalScreenProps {
  visible: boolean
  user: FirebaseUser | null
  dataHook: DataHook
}

interface EditModalState {
  visible: boolean
  item: JournalEntry | null
}

const JournalScreen: React.FC<JournalScreenProps> = ({
  visible,
  user,
  dataHook,
}) => {
  const { fetchJournalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, journalEntries } = dataHook
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [editModal, setEditModal] = useState<EditModalState>({
    visible: false,
    item: null,
  })
  const [editNote, setEditNote] = useState('')
  const [dateValue, setDateValue] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)


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
  }

  const handleItemPress = (item: JournalEntry) => {
    setEditNote(item.note)
    setDateValue(item.date.toDate())
    setEditModal({ visible: true, item })
    setShowDatePicker(false)
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
      )
    } else {
        await addJournalEntry(
            editNote,
            dateValue,
            user,
        )
    }

    setEditModal({ visible: false, item: null })
    setEditNote('')
  }

  const handleEditClose = () => {
    setEditModal({ visible: false, item: null })
    setEditNote('')
  }

  const handleDelete = async () => {
    if (!editModal.item) return

    await deleteJournalEntry(editModal.item.id, user)
    setEditModal({ visible: false, item: null })
    setEditNote('')
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
            onPress={handleOpenAddEntry}
            activeOpacity={0.7}
            className="bg-sky-600/20 p-2 rounded-full border border-sky-500/30">
            <Plus color="#0ea5e9" size={20} />
        </StyledTouchableOpacity>
      </StyledView>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => {
          const parts = title.split('-')
          const year = parseInt(parts[0], 10)
          const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
          const day = parseInt(parts[2], 10)
          const date = new Date(year, month, day)

          return (
            <StyledText className="text-zinc-500 text-xs font-black tracking-[0.2em] mt-4 mb-3 uppercase">
              {date.toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </StyledText>
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
            <StyledView className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
              <StyledText className="text-white text-xl font-black mb-1 text-center">
                 {editModal.item ? 'Edit Note' : 'New Note'}
              </StyledText>

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
                  className="flex-1 bg-sky-600 py-3 rounded-xl items-center shadow-lg shadow-sky-600/15">
                  <StyledText className="text-white font-bold text-sm">
                    Save
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>
              {editModal.item && (
                <StyledTouchableOpacity
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    className="mt-4 bg-red-950/20 border border-red-900/30 py-2.5 rounded-xl items-center flex-row justify-center">
                    <Trash2 color="#ef4444" size={16} />
                    <StyledText className="text-red-500 font-bold text-xs ml-2 uppercase tracking-wider">
                    Delete Note
                    </StyledText>
                </StyledTouchableOpacity>
              )}
            </StyledView>
          </StyledBlurView>
        </KeyboardAvoidingView>
      </Modal>
    </StyledView>
  )
}

export default JournalScreen
