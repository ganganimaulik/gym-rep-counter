import React from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import Slider from '@react-native-community/slider';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledSwitch = styled(Switch);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface SettingsInputProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

const SettingsInput = ({ label, value, onChange }: SettingsInputProps) => (
  <StyledView>
    <StyledText className="text-sm font-medium text-gray-300">{label}</StyledText>
    <StyledTextInput
      className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
      value={String(value)}
      onChangeText={onChange}
      keyboardType="numeric"
    />
  </StyledView>
);

interface SettingsValues {
  countdownSeconds: number;
  restSeconds: number;
  concentricSeconds: number;
  eccentricSeconds: number;
  eccentricCountdownEnabled: boolean;
  volume: number;
}

interface SettingsSetters {
  setCountdownSeconds: (value: number) => void;
  setRestSeconds: (value: number) => void;
  setConcentricSeconds: (value: number) => void;
  setEccentricSeconds: (value: number) => void;
  setEccentricCountdownEnabled: (value: boolean) => void;
  setVolume: (value: number) => void;
}

interface SettingsPanelProps {
  settings: SettingsValues;
  setters: SettingsSetters;
  onSave: () => void;
}

const SettingsPanel = ({ settings, setters, onSave }: SettingsPanelProps) => {
  const {
    countdownSeconds,
    restSeconds,
    concentricSeconds,
    eccentricSeconds,
    eccentricCountdownEnabled,
    volume,
  } = settings;

  const {
    setCountdownSeconds,
    setRestSeconds,
    setConcentricSeconds,
    setEccentricSeconds,
    setEccentricCountdownEnabled,
    setVolume,
  } = setters;

  return (
    <StyledView className="space-y-6 pt-4 border-t border-gray-700">
      <StyledText className="text-xl font-semibold text-center text-white">
        Configuration
      </StyledText>
      <StyledView className="flex-row flex-wrap justify-between">
        <StyledView className="w-[48%] mb-4">
          <SettingsInput
            label="Countdown (s)"
            value={countdownSeconds}
            onChange={(val) => setCountdownSeconds(Number(val))}
          />
        </StyledView>
        <StyledView className="w-[48%] mb-4">
          <SettingsInput
            label="Rest (s)"
            value={restSeconds}
            onChange={(val) => setRestSeconds(Number(val))}
          />
        </StyledView>
        <StyledView className="w-[48%]">
          <SettingsInput
            label="Concentric (s)"
            value={concentricSeconds}
            onChange={(val) => setConcentricSeconds(Number(val))}
          />
        </StyledView>
        <StyledView className="w-[48%]">
          <SettingsInput
            label="Eccentric (s)"
            value={eccentricSeconds}
            onChange={(val) => setEccentricSeconds(Number(val))}
          />
        </StyledView>
      </StyledView>
      <StyledView className="flex-row items-center justify-center pt-2">
        <StyledText className="mr-3 text-sm font-medium text-gray-300">
          Eccentric Countdown
        </StyledText>
        <StyledSwitch
          value={eccentricCountdownEnabled}
          onValueChange={setEccentricCountdownEnabled}
        />
      </StyledView>
      <StyledView className="pt-2">
        <StyledText className="text-sm font-medium text-gray-300 mb-1">
          Volume
        </StyledText>
        <StyledView className="flex-row items-center space-x-3">
          <Slider
            style={{ flex: 1 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#4b5563"
            thumbTintColor="#3b82f6"
          />
          <StyledText className="text-sm font-medium w-12 text-right text-gray-300">
            {`${Math.round(volume * 100)}%`}
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledView className="items-center pt-4">
        <StyledTouchableOpacity
          className="py-2 px-6 bg-blue-600 rounded-lg"
          onPress={onSave}
        >
          <StyledText className="text-white font-semibold">Save Settings</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
};

export default SettingsPanel;