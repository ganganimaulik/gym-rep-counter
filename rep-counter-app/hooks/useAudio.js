import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export const useAudio = (volume) => {
  const [femaleVoice, setFemaleVoice] = useState(null);
  const soundRef = useRef(null);

  const findFemaleVoice = useCallback(async () => {
    const voices = await Speech.getAvailableVoicesAsync();
    const foundVoice = voices.find(
      (v) =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Serena')
    );
    if (foundVoice) {
      setFemaleVoice(foundVoice.identifier);
    }
  }, []);

  useEffect(() => {
    const initializeAudio = async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 2, // MixWithOthers
        shouldDuckAndroid: true,
        interruptionModeAndroid: 2, // DuckOthers
        playThroughEarpieceAndroid: false,
      });
      await findFemaleVoice();
    };

    initializeAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [findFemaleVoice]);

  const playBeep = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/beep.mp3'),
        { shouldPlay: true, volume }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [volume]);

  const speak = useCallback((text, options) => {
    Speech.stop();
    Speech.speak(text, {
      volume,
      rate: 1.2,
      ...options,
    });
  }, [volume]);

  const speakEccentric = useCallback((text) => {
    Speech.stop();
    Speech.speak(text, {
      volume,
      rate: 1.2,
      voice: femaleVoice,
    });
  }, [volume, femaleVoice]);

  const stopSpeech = () => {
    Speech.stop();
  }

  return { playBeep, speak, speakEccentric, stopSpeech };
};