import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  SectionList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';

import type { User as FirebaseUser } from 'firebase/auth';
import type { WorkoutSet } from '../declarations';
import { DataHook } from '../hooks/useData';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledSafeAreaView = styled(SafeAreaView);

interface HistoryScreenProps {
  visible: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  dataHook: DataHook;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  visible,
  onClose,
  user,
  dataHook,
}) => {
  const { fetchHistory } = dataHook;
  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<WorkoutSet | undefined>(
    undefined,
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  const renderItem = ({ item }: { item: WorkoutSet }) => (
    <StyledView className="bg-gray-800 p-4 rounded-lg mb-3">
      <StyledText className="text-white font-bold text-lg">
        {item.exerciseName}
      </StyledText>
      <StyledText className="text-gray-300">
        {item.reps} reps at {item.weight} kg
      </StyledText>
      <StyledText className="text-gray-500 text-xs mt-1">
        {item.date.toDate().toLocaleTimeString()}
      </StyledText>
    </StyledView>
  );

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
    </Modal>
  );
};

export default HistoryScreen;