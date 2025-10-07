import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Button,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';

import type { User as FirebaseUser } from 'firebase/auth';
import type { WorkoutSet } from '../declarations';
import { DataHook } from '../hooks/useData';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledBlurView = styled(BlurView);
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
    if (!user || isLoading || !hasMore) return;

    setIsLoading(true);
    const newHistory = await fetchHistory(user, lastVisible);

    if (newHistory.length > 0) {
      setLastVisible(newHistory[newHistory.length - 1]);
      setHistory(isInitialLoad ? newHistory : (prev) => [...prev, ...newHistory]);
    } else {
      setHasMore(false);
    }
    setIsInitialLoad(false);
    setIsLoading(false);
  }, [user, isLoading, hasMore, lastVisible, fetchHistory, isInitialLoad]);

  // Effect to reset state when the modal opens
  useEffect(() => {
    if (visible && user) {
      setHistory([]);
      setLastVisible(undefined);
      setHasMore(true);
      setIsInitialLoad(true);
    }
  }, [visible, user]);

  // Effect to trigger the initial data load after state has been reset
  useEffect(() => {
    if (visible && user && isInitialLoad) {
      loadHistory();
    }
  }, [visible, user, isInitialLoad, loadHistory]);

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

  const groupedHistory = history.reduce((acc, item) => {
    const date = item.date.toDate().toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  const sections = Object.keys(groupedHistory).map((date) => ({
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

        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          onEndReached={() => {
            if (!isInitialLoad) {
              loadHistory();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading ? <ActivityIndicator size="large" color="#fff" /> : null
          }
          ListEmptyComponent={
            !isLoading ? (
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