import { View, Text, TextInput, Switch, Pressable } from "react-native";
import { styled } from "nativewind";
import Slider from '@react-native-community/slider';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledSwitch = styled(Switch);
const StyledPressable = styled(Pressable);

const SettingsInput = ({ label, value, onChangeText, keyboardType = 'numeric' }) => (
  <StyledView>
    <StyledText className="block text-sm font-medium text-gray-300">{label}</StyledText>
    <StyledTextInput
      className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  </StyledView>
);

export default function SettingsPanel({ visible, onSave, settings, onSettingsChange }) {
  if (!visible) {
    return null;
  }

  return (
    <StyledView className="space-y-4 pt-4 border-t border-gray-700">
      <StyledText className="text-xl font-semibold text-center text-white">
        Configuration
      </StyledText>
      <StyledView className="grid grid-cols-2 gap-4">
        <SettingsInput
          label="Countdown (s)"
          value={settings.countdownSeconds.toString()}
          onChangeText={(val) => onSettingsChange('countdownSeconds', parseInt(val) || 0)}
        />
        <SettingsInput
          label="Rest (s)"
          value={settings.restSeconds.toString()}
          onChangeText={(val) => onSettingsChange('restSeconds', parseInt(val) || 0)}
        />
        <SettingsInput
          label="Max Reps"
          value={settings.maxReps.toString()}
          onChangeText={(val) => onSettingsChange('maxReps', parseInt(val) || 0)}
        />
        <SettingsInput
          label="Max Sets"
          value={settings.maxSets.toString()}
          onChangeText={(val) => onSettingsChange('maxSets', parseInt(val) || 0)}
        />
        <SettingsInput
          label="Concentric (s)"
          value={settings.concentricSeconds.toString()}
          onChangeText={(val) => onSettingsChange('concentricSeconds', parseFloat(val) || 0)}
        />
        <SettingsInput
          label="Eccentric (s)"
          value={settings.eccentricSeconds.toString()}
          onChangeText={(val) => onSettingsChange('eccentricSeconds', parseFloat(val) || 0)}
        />
      </StyledView>
      <StyledView className="col-span-2 flex-row items-center justify-center pt-2">
        <StyledText className="mr-3 text-sm font-medium text-gray-300">
          Eccentric Countdown
        </StyledText>
        <StyledSwitch
          value={settings.eccentricCountdownEnabled}
          onValueChange={(val) => onSettingsChange('eccentricCountdownEnabled', val)}
        />
      </StyledView>
      <StyledView className="col-span-2 pt-2">
        <StyledText className="block text-sm font-medium text-gray-300 mb-1">Volume</StyledText>
        <StyledView className="flex-row items-center space-x-3">
          <Slider
            style={{ flex: 1 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={settings.volume}
            onValueChange={(val) => onSettingsChange('volume', val)}
            minimumTrackTintColor="#3B82F6"
            maximumTrackTintColor="#4B5563"
            thumbTintColor="#3B82F6"
          />
          <StyledText className="text-sm font-medium w-12 text-right text-gray-300">
            {`${Math.round(settings.volume * 100)}%`}
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledView className="items-center pt-4">
        <StyledPressable
          className="py-2 px-6 bg-blue-600 rounded-lg active:bg-blue-700"
          onPress={onSave}
        >
          <StyledText className="text-white font-semibold">Save</StyledText>
        </StyledPressable>
      </StyledView>
    </StyledView>
  );
}