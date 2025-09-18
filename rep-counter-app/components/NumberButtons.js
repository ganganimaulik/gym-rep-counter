import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NumberButtons = ({ maxReps, onJumpToRep, currentRep }) => {
  const buttons = [];
  for (let i = 1; i <= maxReps; i++) {
    buttons.push(
      <TouchableOpacity
        key={i}
        style={[styles.button, currentRep === i && styles.activeButton]}
        onPress={() => onJumpToRep(i)}>
        <Text style={[styles.buttonText, currentRep === i && styles.activeButtonText]}>{i}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <Text style={styles.title}>Jump to Rep</Text>
      <View style={styles.container}>{buttons}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    color: '#9ca3af', // gray-400
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 16,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151', // gray-700
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  activeButton: {
    backgroundColor: '#2563eb', // blue-600
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeButtonText: {
    color: 'white',
  },
});

export default NumberButtons;
