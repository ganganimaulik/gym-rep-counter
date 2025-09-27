import { View, Text, Pressable, TextInput, Switch } from "react-native";
import { styled } from "nativewind";
import Slider from "@react-native-community/slider";
import { Feather } from "@expo/vector-icons";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);
const StyledTextInput = styled(TextInput);

const Settings = ({
  settings,
  onSettingChange,
  onSave,
  isVisible,
  onToggle,
}) => {
  if (!isVisible) {
    return (
      <StyledView className="items-center">
        <StyledPressable onPress={onToggle}>
          <StyledText className="text-blue-400 hover:text-blue-300">
            Settings
          </StyledText>
        </StyledPressable>
      </StyledView>
    );
  }

  return (
    <StyledView className="space-y-4 pt-4 border-t border-gray-700">
      <StyledView className="flex-row justify-between items-center">
        <StyledText className="text-xl font-semibold text-white text-center flex-1">
          Configuration
        </StyledText>
        <StyledPressable onPress={onToggle}>
          <StyledText className="text-blue-400">Hide</StyledText>
        </StyledPressable>
      </StyledView>

      {/* Inputs Grid */}
      <StyledView className="flex-row flex-wrap justify-between">
        <SettingInput
          label="Countdown (s)"
          value={settings.countdownSeconds.toString()}
          onChangeText={(val) => onSettingChange("countdownSeconds", parseInt(val) || 0)}
        />
        <SettingInput
          label="Rest (s)"
          value={settings.restSeconds.toString()}
          onChangeText={(val) => onSettingChange("restSeconds", parseInt(val) || 0)}
        />
        <SettingInput
          label="Max Reps"
          value={settings.maxReps.toString()}
          onChangeText={(val) => onSettingChange("maxReps", parseInt(val) || 1)}
        />
        <SettingInput
          label="Max Sets"
          value={settings.maxSets.toString()}
          onChangeText={(val) => onSettingChange("maxSets", parseInt(val) || 1)}
        />
        <SettingInput
          label="Concentric (s)"
          value={settings.concentricSeconds.toString()}
          onChangeText={(val) => onSettingChange("concentricSeconds", parseFloat(val) || 0.1)}
          step="0.1"
        />
        <SettingInput
          label="Eccentric (s)"
          value={settings.eccentricSeconds.toString()}
          onChangeText={(val) => onSettingChange("eccentricSeconds", parseFloat(val) || 0.1)}
          step="0.1"
        />
      </StyledView>

      {/* Eccentric Countdown Toggle */}
      <StyledView className="flex-row items-center justify-center pt-2">
        <StyledText className="mr-3 text-sm font-medium text-gray-300">
          Eccentric Countdown
        </StyledText>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={settings.eccentricCountdownEnabled ? "#2563eb" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(val) => onSettingChange("eccentricCountdownEnabled", val)}
          value={settings.eccentricCountdownEnabled}
        />
      </StyledView>

      {/* Volume Slider */}
      <StyledView className="col-span-2 pt-2">
        <StyledText className="block text-sm font-medium text-gray-300 mb-1">
          Volume
        </StyledText>
        <StyledView className="flex-row items-center space-x-3">
          <Feather name="volume-1" size={20} color="#9CA3AF" />
          <Slider
            style={{ flex: 1, height: 40 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#4b5563"
            thumbTintColor="#3b82f6"
            value={settings.volume}
            onValueChange={(val) => onSettingChange("volume", val)}
          />
          <Feather name="volume-2" size={20} color="#9CA3AF" />
          <StyledText className="text-sm font-medium w-12 text-right text-gray-300">
            {`${Math.round(settings.volume * 100)}%`}
          </StyledText>
        </StyledView>
      </StyledView>

      <StyledView className="items-center">
        <StyledPressable
          className="py-2 px-6 bg-blue-600 rounded-lg active:bg-blue-700"
          onPress={onSave}
        >
          <StyledText className="font-semibold text-white">Save</StyledText>
        </StyledPressable>
      </StyledView>
    </StyledView>
  );
};

const SettingInput = ({ label, value, onChangeText, ...props }) => (
  <StyledView className="w-[48%] mb-4">
    <StyledText className="block text-sm font-medium text-gray-300">
      {label}
    </StyledText>
    <StyledTextInput
      className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
      value={value}
      onChangeText={onChangeText}
      keyboardType="numeric"
      {...props}
    />
  </StyledView>
);

export default Settings;