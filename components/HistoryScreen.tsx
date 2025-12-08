import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  SectionList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from 'react-native';
import { styled } from 'nativewind';
import { X, Pencil, Trash2 } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import type { User as FirebaseUser } from 'firebase/auth';
import type { WorkoutSet } from '../declarations';
import { DataHook } from '../hooks/useData';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledBlurView = styled(BlurView);

interface HistoryScreenProps {
  visible: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  dataHook: DataHook;
}

interface EditModalState {
  visible: boolean;
  item: WorkoutSet | null;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  visible,
  onClose,
  user,
  dataHook,
}) => {
  const { fetchHistory, updateHistoryEntry, deleteHistoryEntry } = dataHook;
  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<WorkoutSet | undefined>(
    undefined,
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editModal, setEditModal] = useState<EditModalState>({
    visible: false,
    item: null,
  });
  const [editReps, setEditReps] = useState('');
  const [editWeight, setEditWeight] = useState('');

  const loadHistory = useCallback(async () => {
    // The user check is removed as fetchHistory now supports guest users
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    const newHistory = await fetchHistory(user, lastVisible);

    if (newHistory.length > 0) {
      setLastVisible(newHistory[newHistory.length - 1]);
      setHistory(isInitialLoad ? newHistory : prev => [...prev, ...newHistory]);
    } else {
      setHasMore(false);
    }
    setIsInitialLoad(false);
    setIsLoading(false);
  }, [user, isLoading, hasMore, lastVisible, fetchHistory, isInitialLoad]);

  // Effect to reset state when the modal opens
  useEffect(() => {
    if (visible) {
      setHistory([]);
      setLastVisible(undefined);
      setHasMore(true);
      setIsInitialLoad(true);
    }
  }, [visible]);

  // Effect to trigger the initial data load after state has been reset
  useEffect(() => {
    if (visible && isInitialLoad) {
      loadHistory();
    }
  }, [visible, isInitialLoad, loadHistory]);

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleItemPress = (item: WorkoutSet) => {
    setEditReps(item.reps.toString());
    setEditWeight(item.weight.toString());
    setEditModal({ visible: true, item });
  };

  const handleEditSave = async () => {
    if (!editModal.item) return;

    const repsNum = parseInt(editReps, 10);
    const weightNum = parseInt(editWeight, 10) || 0;

    if (!isNaN(repsNum)) {
      await updateHistoryEntry(
        editModal.item.id,
        { reps: repsNum, weight: weightNum },
        user,
      );

      // Update local history state
      setHistory(prev =>
        prev.map(h =>
          h.id === editModal.item!.id
            ? { ...h, reps: repsNum, weight: weightNum }
            : h,
        ),
      );
    }

    setEditModal({ visible: false, item: null });
  };

  const handleEditClose = () => {
    setEditModal({ visible: false, item: null });
  };

  const handleDelete = async () => {
    if (!editModal.item) return;

    await deleteHistoryEntry(editModal.item.id, user);

    // Remove from local history state
    setHistory(prev => prev.filter(h => h.id !== editModal.item!.id));
    setEditModal({ visible: false, item: null });
  };

  const renderItem = ({ item, index, section }: { item: WorkoutSet; index: number; section: { data: WorkoutSet[] } }) => {
    // Calculate rest time from previous set in the same day section
    // Only show rest time if startTime is available for accurate calculation
    // Note: section.data is in reverse chronological order (newest first)
    // So the "previous" set (completed before this one) is at index + 1
    let restTimeText: string | null = null;
    if (item.startTime && index < section.data.length - 1) {
      const previousSet = section.data[index + 1];
      const currentStartTime = item.startTime.toDate().getTime();
      const previousEndTime = previousSet.date.toDate().getTime();
      const restMs = currentStartTime - previousEndTime;
      if (restMs > 0) {
        restTimeText = formatDuration(restMs) + ' rest';
      }
    }

    return (
      <StyledTouchableOpacity
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
        className="bg-gray-800 p-4 rounded-lg mb-3"
      >
        <StyledView className="flex-row justify-between items-start">
          <StyledView className="flex-1">
            <StyledText className="text-white font-bold text-lg">
              {item.exerciseName}
            </StyledText>
            <StyledText className="text-gray-300">
              {item.reps} reps at {item.weight} kg
            </StyledText>
          </StyledView>
          <StyledView className="flex-row items-center">
            {restTimeText && (
              <StyledView className="bg-blue-600/30 px-2 py-1 rounded mr-2">
                <StyledText className="text-blue-300 text-xs font-medium">
                  {restTimeText}
                </StyledText>
              </StyledView>
            )}
            <Pencil color="#9ca3af" size={16} />
          </StyledView>
        </StyledView>
        <StyledText className="text-gray-500 text-xs mt-1">
          {item.date.toDate().toLocaleTimeString()}
        </StyledText>
      </StyledTouchableOpacity>
    );
  };

  const groupedHistory = history.reduce(
    (acc, item) => {
      const d = item.date.toDate();
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(item);
      return acc;
    },
    {} as Record<string, WorkoutSet[]>,
  );

  const sections = Object.keys(groupedHistory)
    .sort((a, b) => b.localeCompare(a)) // Sorts YYYY-MM-DD strings descending
    .map(date => ({
      title: date,
      data: groupedHistory[date],
    }));

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <StyledSafeAreaView className="flex-1 bg-gray-900">
        <StyledView className="flex-row justify-between items-center p-4 border-b border-gray-700">
          <StyledText className="text-white text-2xl font-bold">
            Workout History
          </StyledText>
          <X color="white" size={30} onPress={onClose} />
        </StyledView>

        <SectionList
          sections={sections}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section: { title } }) => {
            // Manually parse the date to avoid timezone issues.
            // new Date('YYYY-MM-DD') can be interpreted as UTC, rolling back the date.
            const parts = title.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);

            return (
              <StyledText className="text-white text-xl font-bold mt-4 mb-2">
                {date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </StyledText>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onEndReached={() => {
            if (!isInitialLoad) {
              loadHistory();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading ? (
              <ActivityIndicator size="large" color="#fff" className="mt-4" />
            ) : null
          }
          ListEmptyComponent={
            !isLoading && history.length === 0 ? (
              <StyledText className="text-gray-400 text-center mt-10">
                No history yet. Complete a set to get started!
              </StyledText>
            ) : null
          }
        />
      </StyledSafeAreaView>

      {/* Edit History Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModal.visible}
        onRequestClose={handleEditClose}
      >
        <StyledBlurView intensity={20} tint="dark" className="flex-1 justify-center items-center">
          <StyledView className="bg-gray-800 p-6 rounded-lg w-11/12">
            <StyledText className="text-white text-2xl font-bold mb-2 text-center">
              Edit Set
            </StyledText>
            {editModal.item && (
              <StyledText className="text-gray-400 text-center mb-4">
                {editModal.item.exerciseName}
              </StyledText>
            )}
            <StyledText className="text-gray-300 mb-2">Reps</StyledText>
            <StyledTextInput
              className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
              keyboardType="number-pad"
              value={editReps}
              onChangeText={setEditReps}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <StyledText className="text-gray-300 mb-2">Weight (kg)</StyledText>
            <StyledTextInput
              className="bg-gray-700 text-white p-3 rounded-lg mb-4 text-lg"
              keyboardType="number-pad"
              value={editWeight}
              onChangeText={setEditWeight}
              returnKeyType="done"
              onSubmitEditing={handleEditSave}
              autoFocus={true}
            />
            <StyledView className="flex-row gap-3">
              <StyledTouchableOpacity
                onPress={handleEditClose}
                className="flex-1 bg-gray-600 p-3 rounded-lg items-center"
              >
                <StyledText className="text-white font-semibold">Cancel</StyledText>
              </StyledTouchableOpacity>
              <StyledTouchableOpacity
                onPress={handleEditSave}
                className="flex-1 bg-indigo-600 p-3 rounded-lg items-center"
              >
                <StyledText className="text-white font-semibold">Save</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
            <StyledTouchableOpacity
              onPress={handleDelete}
              className="mt-3 bg-red-600/20 p-3 rounded-lg items-center flex-row justify-center"
            >
              <Trash2 color="#ef4444" size={18} />
              <StyledText className="text-red-500 font-semibold ml-2">Delete</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledBlurView>
      </Modal>
    </Modal>
  );
};

export default HistoryScreen;