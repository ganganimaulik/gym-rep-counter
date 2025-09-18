import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MainButtons = ({ isRunning, isPaused, isResting, onStart, onPause, onStop, onEndSet }) => {
  const renderButtons = () => {
    if (isResting) {
      return (
        <TouchableOpacity style={[styles.button, styles.stop, { flex: 1 }]} onPress={onStop}>
          <Text style={styles.buttonText}>Stop Workout</Text>
        </TouchableOpacity>
      );
    }

    if (isRunning) {
      return (
        <View style={styles.runningButtonsContainer}>
          <TouchableOpacity style={[styles.button, styles.pause]} onPress={onPause}>
            <Text style={styles.buttonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          {!isPaused && (
            <TouchableOpacity style={[styles.button, styles.endSet]} onPress={onEndSet}>
              <Text style={styles.buttonText}>End Set</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, styles.stop]} onPress={onStop}>
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity style={[styles.button, styles.start, { flex: 2 }]} onPress={onStart}>
        <Text style={styles.buttonText}>Start Workout</Text>
      </TouchableOpacity>
    );
  };

  return <View style={styles.container}>{renderButtons()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
    minHeight: 50,
  },
  runningButtonsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  start: {
    backgroundColor: '#16a34a', // green-600
  },
  pause: {
    backgroundColor: '#d97706', // yellow-500
    flex: 1,
  },
  endSet: {
    backgroundColor: '#2563eb', // blue-600
    flex: 1,
  },
  stop: {
    backgroundColor: '#dc2626', // red-600
    flex: 1,
  },
});

export default MainButtons;
