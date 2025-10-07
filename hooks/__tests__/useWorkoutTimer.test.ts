import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useWorkoutTimer } from '../useWorkoutTimer'
import { Settings, Exercise } from '../useData'
import { AudioHandler } from '../useAudio'
import * as Speech from 'expo-speech'

// Mock dependencies
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}))

jest.mock('expo-background-timer', () => ({
  bgSetTimeout: jest.fn((callback, timeout) => setTimeout(callback, timeout)),
  bgClearTimeout: jest.fn((id) => clearTimeout(id)),
  enableBackgroundExecution: jest.fn(),
  disableBackgroundExecution: jest.fn(),
}))

const mockQueueSpeak = jest.fn((_text, options) => {
  if (options?.onDone) {
    // Simulate async speech completion
    setTimeout(() => options.onDone!(), 0)
  }
})
const mockSpeakEccentric = jest.fn()
const mockOnSetComplete = jest.fn()

const mockAudioHandler: AudioHandler = {
  queueSpeak: mockQueueSpeak,
  speakEccentric: mockSpeakEccentric,
  isSpeaking: false,
  stopSpeaking: jest.fn(),
  initializeAudio: jest.fn(),
}

const defaultSettings: Settings = {
  countdownSeconds: 3,
  restSeconds: 5,
  maxReps: 3,
  maxSets: 2,
  concentricSeconds: 1,
  eccentricSeconds: 2,
  eccentricCountdownEnabled: true,
  volume: 1,
}

const activeExercise: Exercise = {
  id: 'ex1',
  name: 'Test Exercise',
  sets: 2,
  reps: 3,
}

describe('useWorkoutTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with the correct default state', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockOnSetComplete,
        1,
      ),
    )

    expect(result.current.isRunning).toBe(false)
    expect(result.current.isPaused).toBe(false)
    expect(result.current.currentRep.value).toBe(0)
    expect(result.current.currentSet.value).toBe(1)
    expect(result.current.statusText.value).toBe('Press Start for Set 1')
  })

  it('should start the workout and begin the countdown', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockOnSetComplete,
        1,
      ),
    )

    act(() => {
      result.current.startWorkout()
    })

    expect(result.current.isRunning).toBe(true)
    expect(mockQueueSpeak).toHaveBeenCalledWith('Get ready.', { priority: true })
    expect(result.current.phase).toBe('Get Ready')
  })

  it('should stop the workout and reset the state', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockOnSetComplete,
        1,
      ),
    )

    act(() => {
      result.current.startWorkout()
    })

    act(() => {
      result.current.stopWorkout()
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.currentRep.value).toBe(0)
    expect(result.current.statusText.value).toBe('Press Start for Set 1')
    expect(Speech.stop).toHaveBeenCalled()
  })

  it('should pause and resume the workout', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockOnSetComplete,
        1,
      ),
    )

    act(() => {
      result.current.startWorkout()
    })

    act(() => {
      result.current.pauseWorkout()
    })

    expect(result.current.isPaused).toBe(true)
    expect(result.current.statusText.value).toBe('Paused')
    expect(mockQueueSpeak).toHaveBeenCalledWith('Paused', { priority: true })

    act(() => {
      result.current.pauseWorkout()
    })

    expect(result.current.isPaused).toBe(false)
    expect(mockQueueSpeak).toHaveBeenCalledWith('Resuming', { priority: true })
  })

  describe('Phase Transitions', () => {
    it('should call onSetComplete after the last rep', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())
      act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000))

      for (let i = 0; i < defaultSettings.maxReps; i++) {
        act(() => jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000))
        act(() => jest.advanceTimersByTime(defaultSettings.eccentricSeconds * 1000))
      }

      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledWith({
          exerciseId: activeExercise.id,
          reps: defaultSettings.maxReps,
          set: 1,
        })
      })
    })

    it('should transition to rest phase when continueToNextPhase is called', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      // Manually trigger the end of a set
      act(() => {
        result.current.continueToNextPhase()
      })

      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
        expect(result.current.currentSet.value).toBe(2)
        expect(mockQueueSpeak).toHaveBeenCalledWith('Set complete. Rest now.', expect.any(Object))
      })

      // Advance timers to finish the rest
      act(() => jest.advanceTimersByTime(defaultSettings.restSeconds * 1000 + 500))

      await waitFor(() => {
          expect(result.current.statusText.value).toBe('Press Start for Set 2')
      })
    })

    it('should complete the exercise after the last set', async () => {
        const { result } = renderHook(() =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            activeExercise,
            mockOnSetComplete,
            defaultSettings.maxSets, // Start on the last set
          ),
        );

        // Manually trigger the end of the last set
        act(() => {
          result.current.continueToNextPhase();
        });

        await waitFor(() => {
          expect(result.current.isExerciseComplete).toBe(true);
          expect(result.current.statusText.value).toBe('Exercise Complete!');
        });
      });
  })

  describe('Advanced Controls', () => {
    it('should jump to a specific rep', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => {
        result.current.jumpToRep(5)
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true)
        expect(result.current.currentRep.value).toBe(5)
        expect(result.current.phase).toBe('Concentric')
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith('Rep 5.', { priority: true })
    })

    it('should jump to a specific set', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => {
        result.current.jumpToSet(2)
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true)
        expect(result.current.currentSet.value).toBe(2)
        expect(result.current.phase).toBe('Get Ready')
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith('Set 2.', { priority: true })
    })
  })

  describe('Edge Cases and Exercise Changes', () => {
    it('should reset the state when the active exercise or starting set changes', () => {
      const { result, rerender } = renderHook(
        ({ exercise, set }) =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            exercise,
            mockOnSetComplete,
            set,
          ),
        { initialProps: { exercise: activeExercise, set: 1 } },
      )

      act(() => result.current.startWorkout())
      act(() => jest.advanceTimersByTime(1000))

      const newExercise = { ...activeExercise, id: 'ex2' }
      rerender({ exercise: newExercise, set: 3 })

      expect(result.current.isRunning).toBe(false)
      expect(result.current.currentRep.value).toBe(0)
      expect(result.current.currentSet.value).toBe(3)
      expect(result.current.statusText.value).toBe('Press Start for Set 3')
    })
  })
})