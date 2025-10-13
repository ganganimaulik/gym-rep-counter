import { renderHook, act, waitFor } from '@testing-library/react-native'
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av'
import * as Speech from 'expo-speech'
import { useAudio } from '../useAudio'
import { Settings } from '../useData'

// Mock dependencies
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn(),
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
      const { sound } = await (Audio.Sound.createAsync as jest.Mock).mock.results[0].value

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
      let speakOptions: any

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
        speakOptions.onDone()
        await jest.runAllTimers()
      })

      expect(onDoneCallback).toHaveBeenCalled()
      expect(Speech.speak).toHaveBeenCalledWith('Second', expect.any(Object))
      expect(Speech.speak).toHaveBeenCalledTimes(2)
    })

    it('should handle onError callback and process next item', async () => {
      let speakOptions: any
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
        speakOptions.onError()
        await jest.runAllTimers()
      })

      expect(Speech.speak).toHaveBeenCalledWith('Second', expect.any(Object))
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