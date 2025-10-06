import { renderHook, act } from '@testing-library/react-native'
import * as Speech from 'expo-speech'
import { useWorkoutTimer } from '../useWorkoutTimer'
import { useSharedValue } from 'react-native-reanimated'
import { bgSetTimeout, bgClearTimeout } from 'expo-background-timer'
import { Exercise, Settings } from '../useData'

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useSharedValue: jest.fn(initialValue => ({
    value: initialValue,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
  })),
  runOnJS: jest.fn(fn => fn),
}))

// Mock expo-background-timer
jest.mock('expo-background-timer', () => ({
  bgSetTimeout: jest.fn((callback, timeout) => setTimeout(callback, timeout)),
  bgClearTimeout: jest.fn(timeoutId => clearTimeout(timeoutId)),
  enableBackgroundExecution: jest.fn(() => Promise.resolve()),
}))

// Mock expo-speech
jest.mock('expo-speech')

describe('useWorkoutTimer', () => {
  const mockSpeak = Speech.speak as jest.Mock
  const mockStop = Speech.stop as jest.Mock
  const mockSetTimeout = bgSetTimeout as jest.Mock
  const mockClearTimeout = bgClearTimeout as jest.Mock

  const mockSettings: Settings = {
    countdownSeconds: 3,
    restSeconds: 5,
    maxReps: 2,
    maxSets: 2,
    concentricSeconds: 1,
    eccentricSeconds: 2,
    eccentricCountdownEnabled: true,
    volume: 1.0,
  }

  const mockExercise: Exercise = {
    id: 'ex1',
    name: 'Test Exercise',
    sets: 3,
    reps: 12,
    weight: 100,
  }

  const mockAudioHandler = {
    queueSpeak: jest.fn((text, options) => {
      mockSpeak(text, options)
      if (options?.onDone) {
        options.onDone()
      }
    }),
    speakEccentric: jest.fn(),
  }

  const mockDataHandlers = {
    markSetAsCompleted: jest.fn().mockResolvedValue(undefined),
    isSetCompleted: jest.fn().mockReturnValue(false),
    getNextUncompletedSet: jest.fn().mockReturnValue(1),
  }

  const mockUser = { uid: 'test-uid' } as any

  beforeEach(() => {
    jest.useFakeTimers()
    mockSpeak.mockClear()
    mockStop.mockClear()
    mockSetTimeout.mockClear()
    mockClearTimeout.mockClear()
    mockAudioHandler.queueSpeak.mockClear()
    mockAudioHandler.speakEccentric.mockClear()
    mockDataHandlers.markSetAsCompleted.mockClear()
    mockDataHandlers.isSetCompleted.mockReturnValue(false)
    mockDataHandlers.getNextUncompletedSet.mockReturnValue(1)
    ;(useSharedValue as jest.Mock).mockImplementation(initialValue => ({
      value: initialValue,
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const getHook = (
    exercise: Exercise | undefined = mockExercise,
    settings: Settings = mockSettings,
  ) => {
    return renderHook(() =>
      useWorkoutTimer(
        settings,
        mockAudioHandler,
        exercise,
        mockUser,
        mockDataHandlers,
      ),
    )
  }

  // Initial State Test
  it('should initialize with correct default state', () => {
    const { result } = getHook()
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isPaused).toBe(false)
    expect(result.current.phase).toBe('')
    expect(result.current.currentRep.value).toBe(0)
    expect(result.current.currentSet.value).toBe(1)
    expect(result.current.statusText.value).toBe('Press Start for Set 1')
  })

  // startWorkout tests
  describe('startWorkout', () => {
    it('should start the countdown and transition to concentric phase', async () => {
      const { result } = getHook()

      act(() => {
        result.current.startWorkout()
      })

      expect(result.current.isRunning).toBe(true)
      expect(result.current.phase).toBe('Get Ready')
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Get ready.', {
        priority: true,
      })

      // Fast-forward through countdown
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('3')
      expect(result.current.statusText.value).toBe('Get Ready… 3')

      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('2')
      expect(result.current.statusText.value).toBe('Get Ready… 2')

      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('1')
      expect(result.current.statusText.value).toBe('Get Ready… 1')

      // Final tick to start concentric
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })

      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Go!', {
        priority: true,
      })
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('1')
      expect(result.current.phase).toBe('Concentric')
      expect(result.current.currentRep.value).toBe(1)
      expect(result.current.statusText.value).toBe('In Progress')
    })

    it('should not start if the current set is already completed', () => {
      mockDataHandlers.isSetCompleted.mockReturnValue(true)
      const { result } = getHook()

      act(() => {
        result.current.startWorkout()
      })

      expect(result.current.isRunning).toBe(false)
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith(
        'Set 1 is already completed for today.',
      )
      expect(result.current.statusText.value).toBe(
        'Set 1 is already done.',
      )
    })
  })

  // Repetition and Set Cycle Tests
  describe('Repetition and Set Cycles', () => {
    it('should transition through a full rep cycle (concentric -> eccentric)', async () => {
      const { result } = getHook()
      act(() => result.current.startWorkout())

      // Skip countdown
      await act(async () => jest.advanceTimersByTime(mockSettings.countdownSeconds * 1000))
      expect(result.current.phase).toBe('Concentric')
      expect(result.current.currentRep.value).toBe(1)

      // concentric -> eccentric
      await act(async () => jest.advanceTimersByTime(mockSettings.concentricSeconds * 1000))
      expect(result.current.phase).toBe('Eccentric')
      expect(mockAudioHandler.speakEccentric).toHaveBeenCalled()

      // eccentric -> next rep (concentric)
      await act(async () => jest.advanceTimersByTime(mockSettings.eccentricSeconds * 1000))
      expect(result.current.phase).toBe('Concentric')
      expect(result.current.currentRep.value).toBe(2) // Rep 2
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('2')
    })

    it('should end the set, mark as complete, and start resting', async () => {
      const { result } = getHook()
      act(() => result.current.startWorkout())

      // Skip to the last rep
      await act(async () => jest.advanceTimersByTime(mockSettings.countdownSeconds * 1000)) // Countdown
      await act(async () => jest.advanceTimersByTime(mockSettings.concentricSeconds * 1000)) // Rep 1 Concentric
      await act(async () => jest.advanceTimersByTime(mockSettings.eccentricSeconds * 1000)) // Rep 1 Eccentric
      expect(result.current.currentRep.value).toBe(2)

      // Finish the last rep to trigger endSet
      await act(async () => jest.advanceTimersByTime(mockSettings.concentricSeconds * 1000)) // Rep 2 Concentric
      await act(async () => jest.advanceTimersByTime(mockSettings.eccentricSeconds * 1000)) // Rep 2 Eccentric

      // endSet is called
      expect(mockDataHandlers.markSetAsCompleted).toHaveBeenCalledWith(
        mockExercise.id,
        1,
        mockUser,
      )
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith(
        'Set complete. Rest now.',
        expect.any(Object),
      )

      // Should be in Rest phase
      expect(result.current.isResting).toBe(true)
      expect(result.current.phase).toBe('Rest')
      expect(result.current.currentSet.value).toBe(2) // Advanced to next set

      // Check rest timer
      await act(async () => jest.advanceTimersByTime(1000))
      expect(result.current.statusText.value).toBe('Rest: 4s')
    })

    it('should complete the exercise after the final set', async () => {
      const { result } = getHook()
      // Jump to the last set
      act(() => result.current.jumpToSet(mockSettings.maxSets))
      await act(async () => jest.runAllTimers()) // Let jumpToSet finish

      // Start the last set
      act(() => result.current.startWorkout())
      await act(async () => jest.runAllTimers()) // Complete the last set

      // Assertions
      expect(mockDataHandlers.markSetAsCompleted).toHaveBeenCalledWith(
        mockExercise.id,
        mockSettings.maxSets,
        mockUser,
      )
      expect(result.current.isExerciseComplete).toBe(true)
      expect(result.current.statusText.value).toBe('Exercise Complete!')
      // Check for full reset
      expect(result.current.isRunning).toBe(false)
      expect(result.current.currentSet.value).toBe(1)
    })
  })

  // User Interaction Controls
  describe('User Interaction Controls', () => {
    it('should pause and resume the workout correctly', async () => {
      const { result } = getHook()
      act(() => result.current.startWorkout())

      // Let countdown start
      await act(async () => jest.advanceTimersByTime(1000))
      expect(result.current.statusText.value).toBe('Get Ready… 3')

      // Pause
      act(() => result.current.pauseWorkout())
      expect(result.current.isPaused).toBe(true)
      expect(result.current.statusText.value).toBe('Paused')
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Paused', {
        priority: true,
      })
      const clearTimeoutCount = mockClearTimeout.mock.calls.length
      expect(clearTimeoutCount).toBeGreaterThan(0)

      // Timers should be stopped
      await act(async () => jest.advanceTimersByTime(5000))
      expect(result.current.statusText.value).toBe('Paused') // Should not change

      // Resume
      act(() => result.current.pauseWorkout())
      expect(result.current.isPaused).toBe(false)
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Resuming', {
        priority: true,
      })

      // Check it resumes from where it left off (2s remaining in countdown)
      await act(async () => jest.advanceTimersByTime(1000))
      expect(result.current.statusText.value).toBe('Get Ready… 2')
    })

    it('should stop the workout and reset the current set', async () => {
      const { result } = getHook()
      act(() => result.current.startWorkout())
      await act(async () => jest.advanceTimersByTime(4000)) // In rep 1

      expect(result.current.currentRep.value).toBe(1)

      act(() => result.current.stopWorkout())

      expect(result.current.isRunning).toBe(false)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.currentRep.value).toBe(0)
      expect(result.current.currentSet.value).toBe(1) // Set should not change
      expect(result.current.statusText.value).toBe('Press Start for Set 1')
    })

    it('should jump to a specific set', async () => {
      const { result } = getHook()

      act(() => result.current.jumpToSet(2))

      expect(result.current.currentSet.value).toBe(2)
      expect(result.current.currentRep.value).toBe(0)
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Set 2.', {
        priority: true,
      })
      expect(result.current.phase).toBe('Get Ready') // Should start countdown
    })

    it('should jump to a specific rep', async () => {
      const { result } = getHook()

      act(() => result.current.jumpToRep(5))

      expect(result.current.currentRep.value).toBe(5)
      expect(mockAudioHandler.queueSpeak).toHaveBeenCalledWith('Rep 5.', {
        priority: true,
      })
      // Should skip countdown and go straight to concentric
      expect(result.current.phase).toBe('Concentric')
    })

    it('should call endSet and transition to rest', async () => {
      const { result } = getHook()
      act(() => result.current.startWorkout())
      await act(async () => jest.advanceTimersByTime(4000)) // In rep 1

      act(() => result.current.endSet())

      expect(mockDataHandlers.markSetAsCompleted).toHaveBeenCalledWith(
        mockExercise.id,
        1,
        mockUser,
      )
      expect(result.current.isResting).toBe(true)
      expect(result.current.currentSet.value).toBe(2)
    })
  })

  // Edge Cases and Resets
  describe('Edge Cases and Resets', () => {
    it('should reset the state when the active exercise changes', async () => {
      const initialExercise = { ...mockExercise, id: 'ex1' }
      const newExercise = { ...mockExercise, id: 'ex2' }

      mockDataHandlers.getNextUncompletedSet
        .mockReturnValueOnce(1) // for initial load
        .mockReturnValueOnce(2) // for new exercise

      const { result, rerender } = renderHook(
        ({ exercise }) =>
          useWorkoutTimer(
            mockSettings,
            mockAudioHandler,
            exercise,
            mockUser,
            mockDataHandlers,
          ),
        { initialProps: { exercise: initialExercise } },
      )

      // Start the workout to get it into a running state
      act(() => result.current.startWorkout())
      await act(async () => jest.advanceTimersByTime(4000)) // In rep 1 of set 1
      expect(result.current.isRunning).toBe(true)
      expect(result.current.currentSet.value).toBe(1)

      // Change the exercise
      act(() => {
        rerender({ exercise: newExercise })
      })

      // Check that state is reset
      expect(result.current.isRunning).toBe(false)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.currentRep.value).toBe(0)
      // getNextUncompletedSet was mocked to return 2 for the new exercise
      expect(mockDataHandlers.getNextUncompletedSet).toHaveBeenCalledWith('ex2')
      expect(result.current.currentSet.value).toBe(2)
      expect(result.current.statusText.value).toBe('Press Start for Set 2')
    })

    it('should reset the workout if start is pressed after completion', async () => {
      const { result } = getHook()
      act(() => result.current.jumpToSet(mockSettings.maxSets))
      await act(async () => jest.runAllTimers())
      act(() => result.current.startWorkout())
      await act(async () => jest.runAllTimers())

      // Exercise is complete
      expect(result.current.isExerciseComplete).toBe(true)
      expect(result.current.statusText.value).toBe('Exercise Complete!')

      // Press start again
      act(() => result.current.startWorkout())

      // Should reset and start countdown for Set 1
      expect(result.current.isExerciseComplete).toBe(false)
      expect(result.current.isRunning).toBe(true)
      expect(result.current.currentSet.value).toBe(1)
      expect(result.current.phase).toBe('Get Ready')
    })
  })
})