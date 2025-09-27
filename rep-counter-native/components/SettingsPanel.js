import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { colors, typography, components } from '../styles';

const SettingsPanel = ({ settings, onSettingChange, onSave, visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Configuration</Text>

      <View style={styles.grid}>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Countdown (s)</Text>
          <TextInput
            style={components.input}
            keyboardType="number-pad"
            value={String(settings.countdownSeconds)}
            onChangeText={(val) => onSettingChange('countdownSeconds', Number(val))}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Rest (s)</Text>
          <TextInput
            style={components.input}
            keyboardType="number-pad"
            value={String(settings.restSeconds)}
            onChangeText={(val) => onSettingChange('restSeconds', Number(val))}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Max Reps</Text>
          <TextInput
            style={components.input}
            keyboardType="number-pad"
            value={String(settings.maxReps)}
            onChangeText={(val) => onSettingChange('maxReps', Number(val))}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Max Sets</Text>
          <TextInput
            style={components.input}
            keyboardType="number-pad"
            value={String(settings.maxSets)}
            onChangeText={(val) => onSettingChange('maxSets', Number(val))}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Concentric (s)</Text>
          <TextInput
            style={components.input}
            keyboardType="decimal-pad"
            value={String(settings.concentricSeconds)}
            onChangeText={(val) => onSettingChange('concentricSeconds', Number(val))}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={typography.label}>Eccentric (s)</Text>
          <TextInput
            style={components.input}
            keyboardType="decimal-pad"
            value={String(settings.eccentricSeconds)}
            onChangeText={(val) => onSettingChange('eccentricSeconds', Number(val))}
          />
        </View>
      </View>

      <View style={styles.switchContainer}>
        <Text style={typography.label}>Eccentric Countdown</Text>
        <Switch
          trackColor={{ false: colors.input, true: colors.primary }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.input}
          onValueChange={(val) => onSettingChange('eccentricCountdownEnabled', val)}
          value={settings.eccentricCountdownEnabled}
        />
      </View>

      {/* A proper slider would be better, but avoiding extra deps for now */}
      <View style={styles.volumeContainer}>
        <Text style={typography.label}>Volume</Text>
        <Text style={styles.volumeValue}>{Math.round(settings.volume * 100)}%</Text>
      </View>


      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[components.button, { backgroundColor: colors.primary }]}
          onPress={onSave}
        >
          <Text style={components.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  inputGroup: {
    width: '48%',
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  volumeContainer: {
    marginTop: 16,
  },
  volumeValue: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
});

export default SettingsPanel;