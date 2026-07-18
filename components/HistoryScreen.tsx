import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { styled } from 'nativewind'
import { Pencil, Trash2 } from 'lucide-react-native'
import { BlurView } from 'expo-blur'

import type { User as FirebaseUser } from 'firebase/auth'
import type { WorkoutSet, WeightUnit } from '../declarations'
import { DataHook } from '../hooks/useData'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledBlurView = styled(BlurView)

interface HistoryScreenProps {
  visible: boolean
  user: FirebaseUser | null
  dataHook: DataHook
}

interface EditModalState {
  visible: boolean
  item: WorkoutSet | null
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  visible,
  user,
  dataHook,
}) => {
  const {
    fetchHistory,
    updateHistoryEntry,
    deleteHistoryEntry,
    historyVersion,
    workouts,
  } = dataHook
  const [history, setHistory] = useState<WorkoutSet[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastVisible, setLastVisible] = useState<WorkoutSet | undefined>(
    undefined,
  )
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [editModal, setEditModal] = useState<EditModalState>({
    visible: false,
    item: null,
  })
  const [editReps, setEditReps] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editWeightUnit, setEditWeightUnit] = useState<WeightUnit>('kg')
  const [editVariant, setEditVariant] = useState<string | undefined>(undefined)

  // Track the historyVersion we last loaded for, so we know when to refresh
  const lastLoadedVersionRef = useRef(-1)

  const loadHistory = useCallback(async () => {
    // The user check is removed as fetchHistory now supports guest users
    if (isLoading || !hasMore) return

    setIsLoading(true)
    const newHistory = await fetchHistory(user as FirebaseUser, lastVisible)

    if (newHistory.length > 0) {
      setLastVisible(newHistory[newHistory.length - 1])
      setHistory(
        isInitialLoad ? newHistory : (prev) => [...prev, ...newHistory],
      )
    } else {
      setHasMore(false)
    }
    setIsInitialLoad(false)
    setIsLoading(false)
  }, [user, isLoading, hasMore, lastVisible, fetchHistory, isInitialLoad])

  // Force-refresh: bypasses the isLoading/hasMore guards entirely.
  // This is used when switching to the History tab or when new data is available.
  const forceRefresh = useCallback(async () => {
    setIsLoading(true)
    setHistory([])
    setLastVisible(undefined)
    setHasMore(true)
    setIsInitialLoad(true)
    lastLoadedVersionRef.current = historyVersion

    try {
      const newHistory = await fetchHistory(user as FirebaseUser, undefined)
      if (newHistory.length > 0) {
        setLastVisible(newHistory[newHistory.length - 1])
        setHistory(newHistory)
      } else {
        setHasMore(false)
      }
    } catch (e) {
      console.error('[HistoryScreen] forceRefresh failed:', e)
    }
    setIsInitialLoad(false)
    setIsLoading(false)
  }, [fetchHistory, user, historyVersion])

  // Refresh when the tab becomes visible AND data has changed since our last load
  useEffect(() => {
    if (visible && historyVersion !== lastLoadedVersionRef.current) {
      forceRefresh()
    }
  }, [visible, historyVersion, forceRefresh])

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const handleItemPress = (item: WorkoutSet) => {
    setEditReps(item.reps.toString())
    setEditWeight(item.weight.toString())
    setEditWeightUnit(item.weightUnit ?? 'kg')
    setEditVariant(item.variant)
    setEditModal({ visible: true, item })
  }

  // Variant choices for the entry being edited: the exercise's configured
  // variants plus the entry's own (in case the routine config changed).
  const editVariantOptions = useMemo(() => {
    if (!editModal.item) return []
    const exercise = workouts
      .flatMap((w) => w.exercises)
      .find((ex) => ex.id === editModal.item!.exerciseId)
    const options = [...(exercise?.variants ?? [])]
    if (editModal.item.variant && !options.includes(editModal.item.variant)) {
      options.unshift(editModal.item.variant)
    }
    return options
  }, [editModal.item, workouts])

  const handleEditSave = async () => {
    if (!editModal.item) return

    const repsNum = parseInt(editReps, 10)
    const weightNum = parseFloat(editWeight) || 0

    if (!isNaN(repsNum)) {
      await updateHistoryEntry(
        editModal.item.id,
        {
          reps: repsNum,
          weight: weightNum,
          weightUnit: editWeightUnit,
          // null removes a previously logged variant
          variant: editVariant ?? null,
        },
        user,
      )

      // Update local history state
      setHistory((prev) =>
        prev.map((h) => {
          if (h.id !== editModal.item!.id) return h
          const updated: WorkoutSet = {
            ...h,
            reps: repsNum,
            weight: weightNum,
            weightUnit: editWeightUnit,
          }
          if (editVariant) {
            updated.variant = editVariant
          } else {
            delete updated.variant
          }
          return updated
        }),
      )
    }

    setEditModal({ visible: false, item: null })
  }

  const handleEditClose = () => {
    setEditModal({ visible: false, item: null })
  }

  const handleDelete = async () => {
    if (!editModal.item) return

    await deleteHistoryEntry(editModal.item.id, user)

    // Remove from local history state
    setHistory((prev) => prev.filter((h) => h.id !== editModal.item!.id))
    setEditModal({ visible: false, item: null })
  }

  const renderItem = ({
    item,
    index,
    section,
  }: {
    item: WorkoutSet
    index: number
    section: { data: WorkoutSet[] }
  }) => {
    // Skip rendering if item has no valid date
    if (!item.date || typeof item.date.toDate !== 'function') {
      return null
    }

    // Calculate rest time from previous set in the same day section
    // Only show rest time if startTime is available for accurate calculation
    // Note: section.data is in reverse chronological order (newest first)
    // So the "previous" set (completed before this one) is at index + 1
    let restTimeText: string | null = null
    if (
      item.startTime &&
      typeof item.startTime.toDate === 'function' &&
      index < section.data.length - 1
    ) {
      const previousSet = section.data[index + 1]
      if (previousSet.date && typeof previousSet.date.toDate === 'function') {
        const currentStartTime = item.startTime.toDate().getTime()
        const previousEndTime = previousSet.date.toDate().getTime()
        const restMs = currentStartTime - previousEndTime
        if (restMs > 0) {
          restTimeText = formatDuration(restMs) + ' rest'
        }
      }
    }

    return (
      <StyledTouchableOpacity
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
        className="bg-zinc-900 border border-zinc-800/85 p-4 rounded-2xl mb-3 shadow-xl">
        <StyledView className="flex-row justify-between items-start">
          <StyledView className="flex-1">
            <StyledText className="text-white font-black text-base">
              {item.exerciseName}
              {item.variant ? (
                <StyledText className="text-indigo-400 font-bold text-sm">
                  {'  '}
                  {item.variant}
                </StyledText>
              ) : null}
            </StyledText>
            <StyledText className="text-zinc-400 text-sm font-semibold mt-0.5">
              {item.reps} reps @ {item.weight} {item.weightUnit ?? 'kg'}
            </StyledText>
          </StyledView>
          <StyledView className="flex-row items-center">
            {restTimeText && (
              <StyledView className="bg-zinc-850 border border-zinc-800 px-2.5 py-1 rounded-xl mr-2.5">
                <StyledText className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-wider">
                  {restTimeText}
                </StyledText>
              </StyledView>
            )}
            <Pencil color="#71717a" size={14} />
          </StyledView>
        </StyledView>
        <StyledText className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-2">
          {item.date.toDate().toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </StyledText>
      </StyledTouchableOpacity>
    )
  }

  const sections = useMemo(() => {
    const grouped = history
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
        {} as Record<string, WorkoutSet[]>,
      )

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a)) // Sorts YYYY-MM-DD strings descending
      .map((date) => ({
        title: date,
        data: grouped[date],
      }))
  }, [history])

  if (!visible) return null

  return (
    <StyledView className="flex-1 bg-zinc-950 p-4">
      {/* Header */}
      <StyledView className="flex-row justify-between items-center pb-3 border-b border-zinc-900 mb-4">
        <StyledText className="text-2xl font-black text-white">
          HISTORY
        </StyledText>
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
            <StyledText className="text-zinc-500 text-xs font-black tracking-[0.2em] mt-6 mb-3 uppercase">
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
        onEndReached={() => {
          if (!isInitialLoad) {
            loadHistory()
          }
        }}
        onEndReachedThreshold={0.5}
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
          !isLoading && history.length === 0 ? (
            <StyledText className="text-zinc-500 text-center font-semibold mt-16 text-sm">
              No workout history yet. Complete a set to get started!
            </StyledText>
          ) : null
        }
      />

      {/* Edit History Modal */}
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
            className="flex-1 justify-center items-center px-4 bg-black/40">
            <StyledView className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <StyledText className="text-white text-xl font-black mb-1 text-center">
                Edit Set Log
              </StyledText>
              {editModal.item && (
                <StyledText className="text-zinc-500 text-xs font-bold text-center mb-4 uppercase tracking-wider">
                  {editModal.item.exerciseName}
                </StyledText>
              )}
              {editVariantOptions.length > 0 && (
                <>
                  <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                    Variant
                  </StyledText>
                  <StyledView className="flex-row flex-wrap gap-2 mb-4">
                    {editVariantOptions.map((v) => (
                      <StyledTouchableOpacity
                        key={v}
                        testID={`edit-log-variant-${v}`}
                        onPress={() =>
                          setEditVariant((prev) =>
                            prev === v ? undefined : v,
                          )
                        }
                        activeOpacity={0.7}
                        className={`px-3 py-2 rounded-xl border ${
                          editVariant === v
                            ? 'bg-indigo-600 border-indigo-500'
                            : 'bg-zinc-950 border-zinc-800'
                        }`}>
                        <StyledText
                          className={`text-xs font-bold ${
                            editVariant === v ? 'text-white' : 'text-zinc-400'
                          }`}>
                          {v}
                        </StyledText>
                      </StyledTouchableOpacity>
                    ))}
                  </StyledView>
                </>
              )}
              <StyledText className="text-zinc-400 text-xs font-bold mb-1.5 uppercase tracking-wide">
                Reps
              </StyledText>
              <StyledTextInput
                testID="edit-log-reps"
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="number-pad"
                value={editReps}
                onChangeText={setEditReps}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <StyledView className="flex-row justify-between items-center mb-1.5">
                <StyledText className="text-zinc-400 text-xs font-bold uppercase tracking-wide">
                  Weight ({editWeightUnit})
                </StyledText>
                <StyledView className="flex-row bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                  {(['kg', 'plates'] as WeightUnit[]).map((unit) => (
                    <StyledTouchableOpacity
                      key={unit}
                      testID={`edit-log-unit-${unit}`}
                      onPress={() => setEditWeightUnit(unit)}
                      activeOpacity={0.7}
                      className={`px-3 py-1 ${
                        editWeightUnit === unit ? 'bg-indigo-600' : ''
                      }`}>
                      <StyledText
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          editWeightUnit === unit
                            ? 'text-white'
                            : 'text-zinc-500'
                        }`}>
                        {unit}
                      </StyledText>
                    </StyledTouchableOpacity>
                  ))}
                </StyledView>
              </StyledView>
              <StyledTextInput
                testID="edit-log-weight"
                className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-sm"
                keyboardType="decimal-pad"
                value={editWeight}
                onChangeText={setEditWeight}
                returnKeyType="done"
                onSubmitEditing={handleEditSave}
                autoFocus={true}
              />
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
                  testID="edit-log-save-button"
                  onPress={handleEditSave}
                  activeOpacity={0.7}
                  className="flex-1 bg-indigo-600 py-3 rounded-xl items-center shadow-lg shadow-indigo-600/15">
                  <StyledText className="text-white font-bold text-sm">
                    Save
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>
              <StyledTouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.7}
                className="mt-4 bg-red-950/20 border border-red-900/30 py-2.5 rounded-xl items-center flex-row justify-center">
                <Trash2 color="#ef4444" size={16} />
                <StyledText className="text-red-500 font-bold text-xs ml-2 uppercase tracking-wider">
                  Delete Entry
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledBlurView>
        </KeyboardAvoidingView>
      </Modal>
    </StyledView>
  )
}

export default HistoryScreen
