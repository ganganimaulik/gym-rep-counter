import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView, StatusBar } from 'react-native';
import { styled } from 'nativewind';
import { ChevronDown } from 'lucide-react-native';
import { Workout } from '../hooks/useData';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);

interface WorkoutPickerProps {
  selectedValue: string | null;
  onValueChange: (value: string | null) => void;
  workouts: Workout[];
}

const WorkoutPicker: React.FC<WorkoutPickerProps> = ({ selectedValue, onValueChange, workouts }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedWorkout = workouts.find(w => w.id === selectedValue);

  const handleSelect = (value: string | null) => {
    onValueChange(value);
    setModalVisible(false);
  };

  return (
    <>
      <StyledTouchableOpacity
        onPress={() => setModalVisible(true)}
        className="w-full bg-gray-600 border border-gray-500 rounded-md p-3 flex-row justify-between items-center"
      >
        <StyledText className="text-white text-base">
          {selectedWorkout ? selectedWorkout.name : "Select a workout..."}
        </StyledText>
        <ChevronDown color="white" size={20} />
      </StyledTouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <StyledSafeAreaView className="flex-1 justify-end bg-black/50">
          <StatusBar barStyle="light-content" />
          <StyledView className="bg-gray-800 rounded-t-2xl p-4">
            <StyledText className="text-lg font-bold text-white text-center mb-4">Select a Workout</StyledText>
            <FlatList
              data={workouts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <StyledTouchableOpacity
                  onPress={() => handleSelect(item.id)}
                  className="p-4 border-b border-gray-700"
                >
                  <StyledText className="text-white text-lg">{item.name}</StyledText>
                </StyledTouchableOpacity>
              )}
              style={{ maxHeight: 300 }} // Limit height to prevent full-screen takeover
            />
            <StyledTouchableOpacity
              onPress={() => setModalVisible(false)}
              className="mt-4 bg-red-600 rounded-lg p-3 items-center"
            >
              <StyledText className="text-white font-bold">Cancel</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledSafeAreaView>
      </Modal>
    </>
  );
};

export default WorkoutPicker;