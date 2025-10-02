import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export const useAudio = (settings) => {
  const [femaleVoice, setFemaleVoice] = useState(null);
  const soundRef = useRef();

  const findFemaleVoice = async () => {
    const voices = await Speech.getAvailableVoicesAsync();
    const foundVoice = voices.find(
      v =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Serena'),
    );
    if (foundVoice) {
      setFemaleVoice(foundVoice.identifier);
    }
  };

  useEffect(() => {
    const setupAudio = async () => {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: 2, // MixWithOthers
                shouldDuckAndroid: true,
                interruptionModeAndroid: 2, // DuckOthers
                playThroughEarpieceAndroid: false,
            });
            await findFemaleVoice();
        } catch (error) {
            console.error("Failed to set up audio mode", error)
        }
    };
    setupAudio();

    return () => {
      unloadSound();
    };
  }, []);

  const playBeep = async (freq = 440) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/beep.mp3'),
        { shouldPlay: true, volume: settings.volume },
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
  };

  const speak = (text, options) => {
    Speech.speak(text, {
      volume: settings.volume,
      rate: 1.2,
      ...options,
    });
  };

  const speakEccentric = text => {
    Speech.speak(text, {
      volume: settings.volume,
      rate: 1.2,
      voice: femaleVoice,
    });
  };

  return { playBeep, unloadSound, speak, speakEccentric };
};