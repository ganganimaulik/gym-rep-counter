import { renderHook, act } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'
import * as Speech from 'expo-speech'
import { useAudio, AudioHandler } from '../useAudio'
import { Settings } from '../useData'

// Mock dependencies
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn(),
          pauseAsync: jest.fn(),
          unloadAsync: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({
            isLoaded: true,
            isPlaying: false,
          }),
        },
      }),
    },
  },
  InterruptionModeIOS: {
    DuckOthers: 'DuckOthers',
    MixWithOthers: 'MixWithOthers',
  },
  InterruptionModeAndroid: {
    DuckOthers: 'DuckOthers',
  },
}))

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(),
  VoiceQuality: {
    Enhanced: 'Enhanced',
  },
}))

const defaultSettings: Settings = {
  volume: 1.0,
  countdownSeconds: 5,
  restSeconds: 60,
  maxReps: 15,
  maxSets: 3,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  countdownAnnouncementThreshold: 15,
}

describe('useAudio Hook', () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {})
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {})

  // Helper to render the hook and wait for initial effects
  const renderAndWait = async () => {
    const renderResult = renderHook(() => useAudio(defaultSettings))
    await act(async () => {
      // Wait for useEffect to run and promises to resolve
      await jest.runAllTimers()
    })
    return renderResult
  }

  // Session transitions are a chain of awaits; drain them without leaning on
  // timers (which are faked here).
  const flushSessionUpdate = async () => {
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve()
      }
    })
  }

  const silentLoop = async () =>
    (await (Audio.Sound.createAsync as jest.Mock).mock.results[0].value)
      .sound as {
      playAsync: jest.Mock
      pauseAsync: jest.Mock
      unloadAsync: jest.Mock
    }

  const lastCallOrder = (mock: jest.Mock) =>
    Math.max(...mock.mock.invocationCallOrder)

  const mixesWithOthers = expect.objectContaining({
    interruptionModeIOS: 'MixWithOthers',
    shouldDuckAndroid: false,
  })
  const ducksOthers = expect.objectContaining({
    interruptionModeIOS: 'DuckOthers',
    shouldDuckAndroid: true,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Default successful mock implementations
    ;(Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined)
    ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Initialization and Voice Selection', () => {
    it('should initialize audio mode and unload sound on unmount', async () => {
      const { unmount } = await renderAndWait()

      expect(Audio.setAudioModeAsync).toHaveBeenCalled()
      const { sound } = await (Audio.Sound.createAsync as jest.Mock).mock
        .results[0].value

      act(() => unmount())

      expect(sound.unloadAsync).toHaveBeenCalled()
    })

    it('should handle errors during audio setup', async () => {
      const error = new Error('Audio setup failed')
      ;(Audio.setAudioModeAsync as jest.Mock).mockRejectedValue(error)

      await renderAndWait()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to set up audio mode',
        error,
      )
    })

    it('should handle errors when finding a voice', async () => {
      const error = new Error('Voice finding failed')
      ;(Speech.getAvailableVoicesAsync as jest.Mock).mockRejectedValue(error)

      await renderAndWait()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding a suitable voice:',
        error,
      )
    })

    it('should find and set an enhanced female voice', async () => {
      const mockVoices = [
        { identifier: 'male-voice', name: 'Daniel' },
        {
          identifier: 'female-voice-enhanced',
          name: 'Samantha',
          quality: Speech.VoiceQuality.Enhanced,
        },
      ]
      ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(
        mockVoices,
      )

      const { result } = await renderAndWait()

      act(() => {
        result.current.speakEccentric('test')
      })

      expect(Speech.speak).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ voice: 'female-voice-enhanced' }),
      )
    })

    it('should fall back to a standard female voice if no enhanced one is found', async () => {
      const mockVoices = [
        { identifier: 'male-voice', name: 'Daniel' },
        { identifier: 'female-voice-standard', name: 'Karen' },
      ]
      ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(
        mockVoices,
      )

      const { result } = await renderAndWait()

      act(() => {
        result.current.speakEccentric('test')
      })

      expect(Speech.speak).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ voice: 'female-voice-standard' }),
      )
    })

    it('should fall back to the first available voice if no female voice is found', async () => {
      const mockVoices = [
        { identifier: 'first-voice', name: 'Daniel' },
        { identifier: 'second-voice', name: 'Alex' },
      ]
      ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(
        mockVoices,
      )

      const { result } = await renderAndWait()

      act(() => {
        result.current.speakEccentric('test')
      })

      expect(Speech.speak).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ voice: 'first-voice' }),
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Female voice not found, defaulting to the first available voice.',
      )
    })

    it('should warn if no voices are available', async () => {
      await renderAndWait()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'No speech voices available on this device.',
      )
    })
  })

  describe('Audio Session Mode', () => {
    const setPlatform = (os: string) => {
      // Typed readonly, but a plain property at runtime.
      ;(Platform as unknown as { OS: string }).OS = os
    }

    afterEach(() => setPlatform('ios'))

    it('leaves other apps alone on startup', async () => {
      await renderAndWait()
      const loop = await silentLoop()

      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(mixesWithOthers)
      expect(Audio.setAudioModeAsync).not.toHaveBeenCalledWith(ducksOthers)
      // The loop is only nudged to seed the iOS session's category, never left
      // running — that is what would hold other apps down.
      expect(lastCallOrder(loop.pauseAsync)).toBeGreaterThan(
        lastCallOrder(loop.playAsync),
      )
    })

    it('does not touch the loop on startup on Android', async () => {
      setPlatform('android')
      await renderAndWait()
      const loop = await silentLoop()

      expect(loop.playAsync).not.toHaveBeenCalled()
      expect(loop.pauseAsync).not.toHaveBeenCalled()
    })

    it('ducks other apps while a set is running', async () => {
      const { result } = await renderAndWait()

      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(ducksOthers)
      expect((await silentLoop()).playAsync).toHaveBeenCalled()
    })

    it('keeps the session alive but unducked during rest on iOS', async () => {
      const { result } = await renderAndWait()
      const loop = await silentLoop()

      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()
      act(() => result.current.setAudioSessionMode('keepAlive'))
      await flushSessionUpdate()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
      // Bounced rather than stopped: the mode change only reaches the iOS
      // session when the loop re-activates it.
      expect(lastCallOrder(loop.pauseAsync)).toBeLessThan(
        lastCallOrder(loop.playAsync),
      )
    })

    it('stops the loop during rest on Android, where playing anything ducks', async () => {
      setPlatform('android')
      const { result } = await renderAndWait()
      const loop = await silentLoop()

      act(() => result.current.setAudioSessionMode('keepAlive'))
      await flushSessionUpdate()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
      expect(loop.playAsync).not.toHaveBeenCalled()
      expect(loop.pauseAsync).toHaveBeenCalled()
    })

    it('drops the duck before pausing the loop when the workout ends', async () => {
      const { result } = await renderAndWait()
      const loop = await silentLoop()

      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()
      act(() => result.current.setAudioSessionMode('idle'))
      await flushSessionUpdate()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
      // The undocking category change is skipped by expo-av unless a player is
      // still active, so it has to come first.
      expect(lastCallOrder(Audio.setAudioModeAsync as jest.Mock)).toBeLessThan(
        lastCallOrder(loop.pauseAsync),
      )
      expect(lastCallOrder(loop.pauseAsync)).toBeGreaterThan(
        lastCallOrder(loop.playAsync),
      )
    })

    it('ignores a mode it is already in', async () => {
      const { result } = await renderAndWait()
      const callsAfterSetup = (Audio.setAudioModeAsync as jest.Mock).mock.calls
        .length

      act(() => result.current.setAudioSessionMode('idle'))
      await flushSessionUpdate()

      expect((Audio.setAudioModeAsync as jest.Mock).mock.calls.length).toBe(
        callsAfterSetup,
      )
    })

    it('releases the duck on unmount', async () => {
      const { result, unmount } = await renderAndWait()

      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()
      act(() => unmount())

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
    })
  })

  describe('Speech Ducking', () => {
    const lastUtterance = () => {
      const calls = (Speech.speak as jest.Mock).mock.calls
      return calls[calls.length - 1][1]
    }

    // Comfortably past the post-utterance hold (800ms).
    const waitOutDuckRelease = async () => {
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      await flushSessionUpdate()
    }

    const startResting = async (result: { current: AudioHandler }) => {
      act(() => result.current.setAudioSessionMode('keepAlive'))
      await flushSessionUpdate()
    }

    it('ducks other apps for a cue spoken during rest', async () => {
      const { result } = await renderAndWait()
      const loop = await silentLoop()
      await startResting(result)

      act(() => result.current.queueSpeak('Rest target reached.'))
      await flushSessionUpdate()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(ducksOthers)
      expect(loop.playAsync).toHaveBeenCalled()
    })

    it('hands the volume back once the cue is done', async () => {
      const { result } = await renderAndWait()
      await startResting(result)

      act(() => result.current.queueSpeak('Rest target reached.'))
      await flushSessionUpdate()
      act(() => lastUtterance().onDone())
      await waitOutDuckRelease()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
    })

    it('keeps the duck up across back-to-back cues', async () => {
      const { result } = await renderAndWait()
      await startResting(result)

      act(() => {
        result.current.queueSpeak('Set complete.')
        result.current.queueSpeak('Rest now.')
      })
      await flushSessionUpdate()

      // First cue ends; the second starts 50ms later. Other apps must not pump
      // back up in between.
      act(() => lastUtterance().onDone())
      await act(async () => {
        jest.advanceTimersByTime(100)
      })
      await flushSessionUpdate()

      expect(Speech.speak).toHaveBeenCalledTimes(2)
      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(ducksOthers)
    })

    it('ducks for cues spoken outside the queue', async () => {
      const { result } = await renderAndWait()
      await startResting(result)

      act(() => result.current.speak('Next exercise: Squat'))
      await flushSessionUpdate()
      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(ducksOthers)

      act(() => lastUtterance().onDone())
      await waitOutDuckRelease()
      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
    })

    it('still runs a caller onDone once the cue has settled', async () => {
      const { result } = await renderAndWait()
      const onDone = jest.fn()

      act(() => result.current.speak('Workout Complete!', { onDone }))
      act(() => lastUtterance().onDone())

      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('holds the duck through the set to rest handover', async () => {
      const { result } = await renderAndWait()
      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()

      // The cue announcing rest is queued in the same tick the workout stops
      // claiming the audio.
      act(() => result.current.queueSpeak('Set complete. Rest now.'))
      act(() => result.current.setAudioSessionMode('keepAlive'))
      await flushSessionUpdate()
      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(ducksOthers)

      act(() => lastUtterance().onDone())
      await waitOutDuckRelease()
      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
    })

    it('leaves the session alone for cues during a set', async () => {
      const { result } = await renderAndWait()
      act(() => result.current.setAudioSessionMode('ducking'))
      await flushSessionUpdate()
      const callsBefore = (Audio.setAudioModeAsync as jest.Mock).mock.calls
        .length

      act(() => result.current.queueSpeak('3'))
      await flushSessionUpdate()
      act(() => lastUtterance().onDone())
      await waitOutDuckRelease()

      expect((Audio.setAudioModeAsync as jest.Mock).mock.calls.length).toBe(
        callsBefore,
      )
    })

    it('releases the duck after a cue is cut short by a priority cue', async () => {
      const { result } = await renderAndWait()
      await startResting(result)

      act(() => result.current.queueSpeak('Rest target reached.'))
      await flushSessionUpdate()
      const interrupted = lastUtterance()

      act(() => result.current.queueSpeak('Get ready.', { priority: true }))
      // A cut-off utterance is reported as stopped, not done.
      act(() => interrupted.onStopped())
      act(() => lastUtterance().onDone())
      await waitOutDuckRelease()

      expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(mixesWithOthers)
    })
  })

  describe('Speech Queue', () => {
    it('should queue and speak a message', async () => {
      const { result } = await renderAndWait()

      act(() => {
        result.current.queueSpeak('Hello')
      })

      expect(Speech.speak).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({ volume: defaultSettings.volume }),
      )
    })

    it('should handle priority messages by stopping current speech and clearing the queue', async () => {
      const { result } = await renderAndWait()

      act(() => {
        result.current.queueSpeak('First message')
        result.current.queueSpeak('Second message')
        result.current.queueSpeak('Priority message', { priority: true })
      })

      expect(Speech.stop).toHaveBeenCalled()
      expect(Speech.speak).toHaveBeenCalledWith(
        'Priority message',
        expect.any(Object),
      )
    })

    it('should call onDone callback and process next item when speech is finished', async () => {
      const onDoneCallback = jest.fn()
      let speakOptions: Record<string, unknown>
      ;(Speech.speak as jest.Mock).mockImplementation((text, options) => {
        speakOptions = options
      })

      const { result } = await renderAndWait()

      act(() => {
        result.current.queueSpeak('First', { onDone: onDoneCallback })
        result.current.queueSpeak('Second')
      })

      expect(Speech.speak).toHaveBeenCalledWith('First', expect.any(Object))
      expect(Speech.speak).toHaveBeenCalledTimes(1)

      // Simulate first speech finishing
      await act(async () => {
        ;(speakOptions.onDone as () => void)()
        await jest.runAllTimers()
      })

      expect(onDoneCallback).toHaveBeenCalled()
      expect(Speech.speak).toHaveBeenCalledWith('Second', expect.any(Object))
      expect(Speech.speak).toHaveBeenCalledTimes(2)
    })

    it('should handle onError callback and process next item', async () => {
      let speakOptions: Record<string, unknown>
      ;(Speech.speak as jest.Mock).mockImplementation((text, options) => {
        speakOptions = options
      })

      const { result } = await renderAndWait()

      act(() => {
        result.current.queueSpeak('First')
        result.current.queueSpeak('Second')
      })

      expect(Speech.speak).toHaveBeenCalledWith('First', expect.any(Object))

      // Simulate first speech erroring
      await act(async () => {
        ;(speakOptions.onError as () => void)()
        await jest.runAllTimers()
      })

      expect(Speech.speak).toHaveBeenCalledWith('Second', expect.any(Object))
    })

    it('recovers the queue when an utterance never settles (stuck web TTS)', async () => {
      const { result } = await renderAndWait()

      act(() => {
        result.current.queueSpeak('First')
        result.current.queueSpeak('Second')
      })

      expect(Speech.speak).toHaveBeenCalledWith('First', expect.any(Object))
      expect(Speech.speak).toHaveBeenCalledTimes(1)

      // Neither onDone nor onError ever fires for 'First'. The watchdog
      // must clear the native channel and move on to 'Second'.
      await act(async () => {
        jest.advanceTimersByTime(10100)
      })

      expect(Speech.stop).toHaveBeenCalled()
      expect(Speech.speak).toHaveBeenCalledWith('Second', expect.any(Object))
      expect(Speech.speak).toHaveBeenCalledTimes(2)

      // A late onDone from the stuck utterance must not advance the queue
      // a second time.
      const firstOptions = (Speech.speak as jest.Mock).mock.calls[0][1]
      await act(async () => {
        firstOptions.onDone()
        await jest.runAllTimers()
      })
      expect(Speech.speak).toHaveBeenCalledTimes(2)
    })
  })

  describe('Direct Speech', () => {
    it('should speak immediately with the speak function', async () => {
      const { result } = await renderAndWait()

      act(() => {
        result.current.speak('Immediate message')
      })

      expect(Speech.speak).toHaveBeenCalledWith(
        'Immediate message',
        expect.objectContaining({
          volume: defaultSettings.volume,
        }),
      )
    })

    it('should speak eccentric message with priority and found female voice', async () => {
      const mockVoices = [
        {
          identifier: 'female-voice-id',
          name: 'Samantha',
          quality: Speech.VoiceQuality.Enhanced,
        },
      ]
      ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(
        mockVoices,
      )

      const { result } = await renderAndWait()

      act(() => {
        result.current.speakEccentric('Eccentric message')
      })

      expect(Speech.stop).toHaveBeenCalled()
      expect(Speech.speak).toHaveBeenCalledWith(
        'Eccentric message',
        expect.objectContaining({
          priority: true,
          voice: 'female-voice-id',
        }),
      )
    })
  })
})
