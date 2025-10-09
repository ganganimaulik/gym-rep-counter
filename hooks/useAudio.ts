import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Audio,
  InterruptionModeIOS,
  InterruptionModeAndroid,
  AVPlaybackStatusSuccess,
} from 'expo-av'
import * as Speech from 'expo-speech'
import { Settings } from './useData'
import silentAudio from '../assets/silence.mp3'

// Interfaces
export interface SpeechOptions extends Speech.SpeechOptions {
  priority?: boolean
}

interface SpeechQueueItem {
  text: string
  options: SpeechOptions
}

export interface AudioHandler {
  speak: (text: string, options?: Speech.SpeechOptions) => void
  speakEccentric: (text: string) => void
  queueSpeak: (text: string, options?: SpeechOptions) => void
}

export const useAudio = (settings: Settings): AudioHandler => {
  const [femaleVoice, setFemaleVoice] = useState<string | null>(null)
  const speechQueueRef = useRef<SpeechQueueItem[]>([])
  const isSpeakingRef = useRef<boolean>(false)
  const silentSoundRef = useRef<Audio.Sound | null>(null)

  const findFemaleVoice = async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync()
      if (voices.length === 0) {
        console.warn('No speech voices available on this device.')
        return
      }

      const femaleVoiceNames = ['female', 'samantha', 'serena', 'karen', 'victoria']

      // 1. Prioritize Enhanced quality female voices
      let foundVoice = voices.find(
        (v) =>
          v.quality === Speech.VoiceQuality.Enhanced &&
          femaleVoiceNames.some((name) => v.name.toLowerCase().includes(name)),
      )

      // 2. Fallback to any female voice
      if (!foundVoice) {
        foundVoice = voices.find((v) =>
          femaleVoiceNames.some((name) => v.name.toLowerCase().includes(name)),
        )
      }

      // 3. Default to the first available voice
      if (!foundVoice) {
        foundVoice = voices[0]
        console.warn('Female voice not found, defaulting to the first available voice.')
      }

      if (foundVoice) {
        setFemaleVoice(foundVoice.identifier)
      }
    } catch (error) {
      console.error('Error finding a suitable voice:', error)
    }
  }

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        })

        const { sound } = await Audio.Sound.createAsync(silentAudio, {
          isLooping: true,
        })
        silentSoundRef.current = sound
        const status = (await sound.getStatusAsync()) as AVPlaybackStatusSuccess
        if (status.isLoaded && !status.isPlaying) {
          await sound.playAsync()
        }

        await findFemaleVoice()
      } catch (error) {
        console.error('Failed to set up audio mode', error)
      }
    }
    setupAudio()

    return () => {
      Speech.stop()
      if (silentSoundRef.current) {
        silentSoundRef.current.unloadAsync()
      }
    }
  }, [])

  const processNextSpeech = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false
      return
    }

    isSpeakingRef.current = true
    const { text, options } = speechQueueRef.current.shift()!
    const { onDone: originalOnDone, ...restOptions } = options

    Speech.speak(text, {
      ...restOptions,
      onDone: () => {
        isSpeakingRef.current = false
        if (typeof originalOnDone === 'function') {
          originalOnDone()
        }
        setTimeout(() => processNextSpeech(), 50)
      },
      onError: () => {
        isSpeakingRef.current = false
        setTimeout(() => processNextSpeech(), 50)
      },
    })
  }, [])

  const queueSpeak = useCallback(
    (text: string, options: SpeechOptions = {}) => {
      if (options.priority) {
        Speech.stop()
        speechQueueRef.current = []
        isSpeakingRef.current = false
      }

      const speechOptions: SpeechOptions = {
        volume: settings.volume,
        rate: 1.3,
        ...options,
      }

      speechQueueRef.current.push({ text, options: speechOptions })

      if (!isSpeakingRef.current) {
        processNextSpeech()
      }
    },
    [settings.volume, processNextSpeech],
  )

  const speak = useCallback(
    (text: string, options: Speech.SpeechOptions = {}) => {
      Speech.speak(text, {
        volume: settings.volume,
        rate: 1.3,
        ...options,
      })
    },
    [settings.volume],
  )

  const speakEccentric = useCallback(
    (text: string) => {
      queueSpeak(text, {
        priority: true,
        rate: 1.3,
        voice: femaleVoice || undefined,
      })
    },
    [queueSpeak, femaleVoice],
  )

  return {
    speak,
    speakEccentric,
    queueSpeak,
  }
}
