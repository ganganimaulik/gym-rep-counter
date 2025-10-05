// useAudio.js - improved with speech queue management

import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export const useAudio = (settings) => {
  const [femaleVoice, setFemaleVoice] = useState(null);
  const speechQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  const findFemaleVoice = async () => {
    const voices = await Speech.getAvailableVoicesAsync();
    const foundVoice = voices.find(
      v =>
        v.name.includes('Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Serena') ||
        v.name.includes('Karen') ||
        v.name.includes('Victoria'),
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
        console.error("Failed to set up audio mode", error);
      }
    };
    setupAudio();

    return () => {
      Speech.stop();
    };
  }, []);

  // Process speech queue
  const processNextSpeech = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      return;
    }

    isSpeakingRef.current = true;
    const { text, options } = speechQueueRef.current.shift();
    const { onDone: originalOnDone, ...restOptions } = options;

    Speech.speak(text, {
      ...restOptions,
      onDone: () => {
        isSpeakingRef.current = false;
        if (typeof originalOnDone === 'function') {
          originalOnDone();
        }
        // Process next item after a small delay
        setTimeout(() => processNextSpeech(), 50);
      },
      onError: () => {
        isSpeakingRef.current = false;
        setTimeout(() => processNextSpeech(), 50);
      },
    });
  }, []);

  // Queue-based speak function
  const queueSpeak = useCallback((text, options = {}) => {
    // If priority, clear queue and stop current speech
    if (options.priority) {
      Speech.stop();
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
    }

    const speechOptions = {
      volume: settings.volume,
      rate: 1.4,
      ...options,
    };

    // Add to queue
    speechQueueRef.current.push({ text, options: speechOptions });

    // Start processing if not already speaking
    if (!isSpeakingRef.current) {
      processNextSpeech();
    }
  }, [settings.volume, processNextSpeech]);

  // Regular speak (non-queued, for backwards compatibility)
  const speak = useCallback((text, options = {}) => {
    Speech.speak(text, {
      volume: settings.volume,
      rate: 1.4,
      ...options,
    });
  }, [settings.volume]);

  // Special eccentric voice with collision detection
  const speakEccentric = useCallback((text) => {
    // Use the high-priority queue to interrupt other speech and play immediately.
    // This is more reliable than calling Speech.stop() directly.
    queueSpeak(text, {
      priority: true,
      rate: 1.4, // Using a slightly faster rate helps ensure the word fits within the 1-second window
      voice: femaleVoice,
    });
  }, [queueSpeak, femaleVoice]);



  return {
    speak,
    speakEccentric,
    queueSpeak
  };
};
