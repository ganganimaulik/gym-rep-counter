import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import SettingsPanel from './SettingsPanel';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

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

interface SettingsProps {
  settings: SettingsValues;
  setters: SettingsSetters;
  saveSettings: () => void;
}

const Settings = ({ settings, setters, saveSettings }: SettingsProps) => {
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  return (
    <StyledView className="w-full">
      <StyledView className="items-center">
        <StyledTouchableOpacity onPress={() => setIsPanelVisible(!isPanelVisible)}>
          <StyledText className="text-blue-400">
            {isPanelVisible ? 'Hide Settings' : 'Show Settings'}
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>
      {isPanelVisible && (
        <SettingsPanel
          settings={settings}
          setters={setters}
          onSave={saveSettings}
        />
      )}
    </StyledView>
  );
};

export default Settings;