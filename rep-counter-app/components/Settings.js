import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch } from 'react-native';

const Settings = ({ settings, onSave }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  const handleSave = () => {
    onSave(tempSettings);
    setShowSettings(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
        <Text style={styles.toggleText}>{showSettings ? 'Hide Settings' : 'Show Settings'}</Text>
      </TouchableOpacity>

      {showSettings && (
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.label}>Countdown (s)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(tempSettings.countdownSeconds)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, countdownSeconds: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rest (s)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(tempSettings.restSeconds)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, restSeconds: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Max Reps</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(tempSettings.maxReps)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, maxReps: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Max Sets</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(tempSettings.maxSets)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, maxSets: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Concentric (s)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(tempSettings.concentricSeconds)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, concentricSeconds: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Eccentric (s)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(tempSettings.eccentricSeconds)}
              onChangeText={(val) => setTempSettings({ ...tempSettings, eccentricSeconds: Number(val) })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Eccentric Countdown</Text>
            <Switch
              value={tempSettings.eccentricCountdownEnabled}
              onValueChange={(val) => setTempSettings({ ...tempSettings, eccentricCountdownEnabled: val })}
            />
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  toggleText: {
    color: '#60a5fa', // blue-400
    textAlign: 'center',
    fontSize: 16,
  },
  panel: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#1f2937', // gray-800
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    color: 'white',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#374151', // gray-700
    color: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    width: 80,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#2563eb', // blue-600
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default Settings;
