import * as Speech from 'expo-speech';
import { useState, useEffect } from 'react';

export const useAudio = (volume: number) => {
  const [femaleVoice, setFemaleVoice] = useState<Speech.Voice | null>(null);

  useEffect(() => {
    const getVoices = async () => {
      const voices = await Speech.getAvailableVoicesAsync();
      let foundVoice = voices.find(
        (voice) =>
          /female/i.test(voice.name) && /en-US/i.test(voice.language)
      );
      if (!foundVoice) {
        foundVoice = voices.find((voice) => /female/i.test(voice.name) && /en/i.test(voice.language));
      }
      setFemaleVoice(foundVoice || null);
    };
    getVoices();
  }, []);

  const speak = (text: string, rate = 1.0) => {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      rate,
      volume,
    });
  };

  const speakEccentric = (number: number) => {
    Speech.stop();
    Speech.speak(number.toString(), {
      language: 'en-US',
      rate: 1.5,
      volume,
      voice: femaleVoice?.identifier,
    });
  };

  // Beep sounds are omitted as expo-av requires an audio file asset.

  return { speak, speakEccentric };
};