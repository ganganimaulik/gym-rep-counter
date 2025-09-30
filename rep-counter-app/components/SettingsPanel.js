import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';


const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledSwitch = styled(Switch);
const StyledTouchableOpacity = styled(TouchableOpacity);

const SettingsPanel = ({ settings, onSave, visible, availableVoices }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, visible]);


  const handleSave = () => {
    onSave(localSettings);
  };

  const handleValueChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!visible) {
    return null;
  }

  return (
    <StyledView className="space-y-4 pt-4 border-t border-gray-700">
      <StyledText className="text-xl font-semibold text-center text-white">Configuration</StyledText>
      <StyledView className="grid grid-cols-2 gap-4">
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Countdown (s)</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="number-pad"
            value={String(localSettings.countdownSeconds)}
            onChangeText={(text) => handleValueChange('countdownSeconds', Number(text))}
          />
        </StyledView>
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Rest (s)</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="number-pad"
            value={String(localSettings.restSeconds)}
            onChangeText={(text) => handleValueChange('restSeconds', Number(text))}
          />
        </StyledView>
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Max Reps</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="number-pad"
            value={String(localSettings.maxReps)}
            onChangeText={(text) => handleValueChange('maxReps', Number(text))}
          />
        </StyledView>
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Max Sets</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="number-pad"
            value={String(localSettings.maxSets)}
            onChangeText={(text) => handleValueChange('maxSets', Number(text))}
          />
        </StyledView>
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Concentric (s)</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="decimal-pad"
            value={String(localSettings.concentricSeconds)}
            onChangeText={(text) => handleValueChange('concentricSeconds', Number(text))}
          />
        </StyledView>
        <StyledView>
          <StyledText className="text-sm font-medium text-gray-300">Eccentric (s)</StyledText>
          <StyledTextInput
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
            keyboardType="decimal-pad"
            value={String(localSettings.eccentricSeconds)}
            onChangeText={(text) => handleValueChange('eccentricSeconds', Number(text))}
          />
        </StyledView>
        <StyledView className="col-span-2 flex items-center justify-center pt-2 flex-row">
          <StyledText className="mr-3 text-sm font-medium text-gray-300">Eccentric Countdown</StyledText>
          <StyledSwitch
            value={localSettings.eccentricCountdownEnabled}
            onValueChange={(value) => handleValueChange('eccentricCountdownEnabled', value)}
          />
        </StyledView>
        <StyledView className="col-span-2 pt-2">
          <StyledText className="text-sm font-medium text-gray-300 mb-1">Volume</StyledText>
          <StyledView className="flex flex-row items-center space-x-3">
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={localSettings.volume}
              onValueChange={(value) => handleValueChange('volume', value)}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#4b5563"
              thumbTintColor="#3b82f6"
            />
            <StyledText className="text-sm font-medium w-12 text-right text-gray-300">
              {`${Math.round(localSettings.volume * 100)}%`}
            </StyledText>
          </StyledView>
        </StyledView>
        <StyledView className="col-span-2 pt-2">
          <StyledText className="text-sm font-medium text-gray-300 mb-1">Voice</StyledText>
          <StyledView className="w-full bg-gray-700 border border-gray-600 rounded-md">
            <Picker
              selectedValue={localSettings.voiceIdentifier}
              onValueChange={(itemValue) => handleValueChange('voiceIdentifier', itemValue)}
              style={{ color: 'white' }}
              dropdownIconColor="white"
            >
              <Picker.Item label="Default" value={null} />
              {availableVoices && availableVoices.map((voice) => (
                <Picker.Item key={voice.identifier} label={`${voice.name} (${voice.language})`} value={voice.identifier} />
              ))}
            </Picker>
          </StyledView>
        </StyledView>
      </StyledView>
      <StyledView className="text-center items-center">
        <StyledTouchableOpacity
          onPress={handleSave}
          className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <StyledText className="font-semibold text-white">Save</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
};

export default SettingsPanel;