import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import {
  Audio,
  AudioMode,
  InterruptionModeIOS,
  InterruptionModeAndroid,
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

// Longest app utterance is ~2s; a queue item not settled by now is stuck.
const SPEECH_WATCHDOG_MS = 10000

// How long a speech-driven duck lingers after the last utterance settles. Long
// enough to bridge the gap between queued cues (and the tail of the one just
// spoken) so other apps' volume doesn't pump between words.
const SPEECH_DUCK_RELEASE_MS = 800

/**
 * How much of the device's audio the workout claims:
 * - `idle`: nothing. Whatever the user is listening to plays untouched.
 * - `keepAlive`: an inaudible session so iOS doesn't suspend the app (and its
 *   rest-timer announcements) while it is backgrounded — without turning
 *   other apps down.
 * - `ducking`: other apps are turned down so the set's spoken cues cut through.
 *
 * Speech promotes whatever mode is in force to `ducking` for as long as it is
 * talking, so cues outside a set — "Rest target reached", "Next exercise: …" —
 * are heard too, without holding the volume down in between.
 */
export type AudioSessionMode = 'idle' | 'keepAlive' | 'ducking'

const BASE_AUDIO_MODE: Partial<AudioMode> = {
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  playThroughEarpieceAndroid: false,
  // Android turns other apps down by taking audio focus, not via this mode —
  // this is only what the focus request asks for once the loop does play.
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
}

const AUDIO_MODES: Record<AudioSessionMode, Partial<AudioMode>> = {
  idle: {
    ...BASE_AUDIO_MODE,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    shouldDuckAndroid: false,
  },
  keepAlive: {
    ...BASE_AUDIO_MODE,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    shouldDuckAndroid: false,
  },
  ducking: {
    ...BASE_AUDIO_MODE,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    shouldDuckAndroid: true,
  },
}

// Which modes need the looping silence actually playing. iOS suspends a
// backgrounded app unless something is playing, so `keepAlive` has to keep the
// clip running there. On Android any playback grabs audio focus — which turns
// other apps down whatever interruption mode we ask for — so the loop only
// runs while ducking is wanted; background rest timers there ride on the wake
// lock in expo-background-timer instead.
const needsSilentLoop = (mode: AudioSessionMode): boolean =>
  mode === 'ducking' || (mode === 'keepAlive' && Platform.OS !== 'android')

export interface AudioHandler {
  speak: (text: string, options?: Speech.SpeechOptions) => void
  speakEccentric: (text: string) => void
  queueSpeak: (text: string, options?: SpeechOptions) => void
  setAudioSessionMode: (mode: AudioSessionMode) => void
}

export const useAudio = (settings: Settings): AudioHandler => {
  const [femaleVoice, setFemaleVoice] = useState<string | null>(null)
  const speechQueueRef = useRef<SpeechQueueItem[]>([])
  const isSpeakingRef = useRef<boolean>(false)
  const silentSoundRef = useRef<Audio.Sound | null>(null)
  const workoutSessionModeRef = useRef<AudioSessionMode>('idle')
  const activeSessionModeRef = useRef<AudioSessionMode>('idle')
  const sessionUpdateRef = useRef<Promise<void>>(Promise.resolve())
  const isDuckingForSpeechRef = useRef(false)
  const utterancesInFlightRef = useRef(0)
  const duckReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const findFemaleVoice = async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync()
      if (voices.length === 0) {
        console.warn('No speech voices available on this device.')
        return
      }

      const femaleVoiceNames = [
        'female',
        'samantha',
        'serena',
        'karen',
        'victoria',
      ]

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
        console.warn(
          'Female voice not found, defaulting to the first available voice.',
        )
      }

      if (foundVoice) {
        setFemaleVoice(foundVoice.identifier)
      }
    } catch (error) {
      console.error('Error finding a suitable voice:', error)
    }
  }

  const applySessionMode = useCallback(async () => {
    const mode = isDuckingForSpeechRef.current
      ? 'ducking'
      : workoutSessionModeRef.current
    const sound = silentSoundRef.current
    // Clip still loading — setupAudio re-syncs as soon as it is ready.
    if (!sound || mode === activeSessionModeRef.current) return

    if (needsSilentLoop(mode)) {
      // expo-av only pushes a category onto the iOS session when it activates
      // it, and it activates on playback — so bounce the loop to make the new
      // interruption mode take hold.
      await sound.pauseAsync()
      await Audio.setAudioModeAsync(AUDIO_MODES[mode])
      await sound.playAsync()
    } else {
      // Reverse order on the way out: expo-av never really deactivates the
      // iOS session, so the category change that drops the duck has to land
      // while the loop is still playing or it is skipped entirely.
      await Audio.setAudioModeAsync(AUDIO_MODES[mode])
      await sound.pauseAsync()
    }
    activeSessionModeRef.current = mode
  }, [])

  // Each transition is several awaits long and modes can flip faster than one
  // finishes, so run them one at a time.
  const syncAudioSession = useCallback(() => {
    sessionUpdateRef.current = sessionUpdateRef.current
      .then(applySessionMode)
      .catch((error) => {
        console.error('Failed to update audio session', error)
      })
  }, [applySessionMode])

  const setAudioSessionMode = useCallback(
    (mode: AudioSessionMode) => {
      if (workoutSessionModeRef.current === mode) return
      workoutSessionModeRef.current = mode
      syncAudioSession()
    },
    [syncAudioSession],
  )

  // Held for the duration of an utterance (a burst of them, when they queue up
  // back to back) so a cue spoken outside a set is still heard over whatever
  // the user has playing.
  const holdSpeechDuck = useCallback(() => {
    if (duckReleaseTimerRef.current != null) {
      clearTimeout(duckReleaseTimerRef.current)
      duckReleaseTimerRef.current = null
    }
    utterancesInFlightRef.current += 1
    if (isDuckingForSpeechRef.current) return
    isDuckingForSpeechRef.current = true
    syncAudioSession()
  }, [syncAudioSession])

  const releaseSpeechDuck = useCallback(() => {
    utterancesInFlightRef.current = Math.max(
      0,
      utterancesInFlightRef.current - 1,
    )
    if (utterancesInFlightRef.current > 0 || !isDuckingForSpeechRef.current) {
      return
    }
    if (duckReleaseTimerRef.current != null) {
      clearTimeout(duckReleaseTimerRef.current)
    }
    duckReleaseTimerRef.current = setTimeout(() => {
      duckReleaseTimerRef.current = null
      if (utterancesInFlightRef.current > 0) return
      isDuckingForSpeechRef.current = false
      syncAudioSession()
    }, SPEECH_DUCK_RELEASE_MS)
  }, [syncAudioSession])

  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Launching the app must not touch other apps' audio: claim nothing
        // until a set actually starts (see setAudioSessionMode).
        await Audio.setAudioModeAsync(AUDIO_MODES.idle)

        const { sound } = await Audio.Sound.createAsync(silentAudio, {
          isLooping: true,
        })
        silentSoundRef.current = sound

        if (Platform.OS === 'ios') {
          // expo-speech talks through the app's audio session, and expo-av only
          // pushes the mode above onto it while something plays. Nudge it once
          // so the session isn't left on iOS' non-mixing default, where a cue
          // spoken between sets would cut the user's music off instead of
          // playing over it.
          await sound.playAsync()
          await sound.pauseAsync()
        }

        // A set may have started while the clip was loading.
        await applySessionMode()

        await findFemaleVoice()
      } catch (error) {
        console.error('Failed to set up audio mode', error)
      }
    }
    setupAudio()

    return () => {
      Speech.stop()
      if (duckReleaseTimerRef.current != null) {
        clearTimeout(duckReleaseTimerRef.current)
        duckReleaseTimerRef.current = null
      }
      // Drop the duck before the session goes away — iOS holds on to the
      // category, so other apps would stay turned down. Both calls land on
      // expo-av's queue in order, so the unload can't beat it.
      Promise.resolve(Audio.setAudioModeAsync(AUDIO_MODES.idle)).catch(() => {
        /* nothing left to release */
      })
      if (silentSoundRef.current) {
        silentSoundRef.current.unloadAsync()
      }
    }
  }, [applySessionMode])

  const processNextSpeech = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false
      return
    }

    isSpeakingRef.current = true
    const { text, options } = speechQueueRef.current.shift()!
    const { onDone: originalOnDone, ...restOptions } = options

    holdSpeechDuck()

    // Web speechSynthesis can silently drop an utterance's events (e.g.
    // after an interrupting cancel), which would jam the queue forever.
    // Settle each utterance exactly once: onDone, onError, onStopped (an
    // interrupting priority cue) or the watchdog.
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      isSpeakingRef.current = false
      releaseSpeechDuck()
      if (typeof originalOnDone === 'function') {
        originalOnDone()
      }
      setTimeout(() => processNextSpeech(), 50)
    }
    const watchdog = setTimeout(() => {
      // A stuck utterance also blocks the native channel until a cancel.
      Speech.stop()
      settle()
    }, SPEECH_WATCHDOG_MS)

    Speech.speak(text, {
      ...restOptions,
      onDone: settle,
      onStopped: settle,
      onError: (error) => {
        console.error('Speech error occurred:', error)
        settle()
      },
    })
  }, [holdSpeechDuck, releaseSpeechDuck])

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
      const {
        onDone: originalOnDone,
        onError: originalOnError,
        ...restOptions
      } = options

      holdSpeechDuck()

      // Same one-shot settling as the queue: the duck has to be released even
      // if the platform never reports the utterance finishing.
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        clearTimeout(watchdog)
        releaseSpeechDuck()
        if (typeof originalOnDone === 'function') {
          originalOnDone()
        }
      }
      const watchdog = setTimeout(settle, SPEECH_WATCHDOG_MS)

      Speech.speak(text, {
        volume: settings.volume,
        rate: 1.3,
        ...restOptions,
        onDone: settle,
        onStopped: settle,
        onError: (error) => {
          console.error('Speech error occurred:', error)
          settle()
          if (typeof originalOnError === 'function') {
            originalOnError(error)
          }
        },
      })
    },
    [settings.volume, holdSpeechDuck, releaseSpeechDuck],
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

  return useMemo(
    () => ({
      speak,
      speakEccentric,
      queueSpeak,
      setAudioSessionMode,
    }),
    [speak, speakEccentric, queueSpeak, setAudioSessionMode],
  )
}
