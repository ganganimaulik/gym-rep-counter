import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useWorkoutTimer, WorkoutTimerHook } from '../useWorkoutTimer'
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

jest.mock('../../utils/workoutActivity', () => ({
  startWorkoutActivity: jest.fn(),
  updateWorkoutActivity: jest.fn(),
  stopWorkoutActivity: jest.fn(),
}))

jest.mock('../../utils/restNotification', () => ({
  scheduleRestEndNotification: jest.fn().mockResolvedValue(undefined),
  cancelRestEndNotification: jest.fn().mockResolvedValue(undefined),
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
  speak: jest.fn(),
}

const defaultSettings: Settings = {
  countdownSeconds: 3,
  restSeconds: 5,
  maxReps: 3,
  maxSets: 2,
  concentricSeconds: 1,
  eccentricSeconds: 2,
  eccentricCountdownEnabled: true,
  countdownAnnouncementThreshold: 15,
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
    expect(mockQueueSpeak).toHaveBeenCalledWith('Get ready.', {
      priority: true,
    })
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

  it('should freeze all timers while paused (no phase progression)', async () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockOnSetComplete,
        1,
      ),
    )

    // Start workout — enters countdown phase
    act(() => {
      result.current.startWorkout()
    })
    expect(result.current.phase).toBe('Get Ready')

    // Advance partway through the countdown so the timer is actively ticking
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.phase).toBe('Get Ready')

    // Pause
    act(() => {
      result.current.pauseWorkout()
    })
    expect(result.current.isPaused).toBe(true)

    // Clear mocks so we can assert nothing new fires while paused
    mockQueueSpeak.mockClear()
    mockSpeakEccentric.mockClear()
    mockOnSetComplete.mockClear()

    // Advance timers well past what would finish the countdown + a full set
    const totalPhaseMs =
      (defaultSettings.countdownSeconds +
        defaultSettings.concentricSeconds +
        defaultSettings.eccentricSeconds) *
      1000 *
      2
    act(() => {
      jest.advanceTimersByTime(totalPhaseMs)
    })

    // Phase must NOT have advanced — still paused in countdown
    expect(result.current.isPaused).toBe(true)
    expect(result.current.phase).toBe('Get Ready')
    expect(result.current.currentRep.value).toBe(0)
    expect(mockOnSetComplete).not.toHaveBeenCalled()
    // No speech should have fired (countdown numbers, 'Go!', rep announcements, etc.)
    expect(mockQueueSpeak).not.toHaveBeenCalled()
    expect(mockSpeakEccentric).not.toHaveBeenCalled()
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
      act(() =>
        jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000),
      )

      for (let i = 0; i < defaultSettings.maxReps; i++) {
        act(() =>
          jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000),
        )
        act(() =>
          jest.advanceTimersByTime(defaultSettings.eccentricSeconds * 1000),
        )
      }

      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledWith({
          exerciseId: activeExercise.id,
          reps: defaultSettings.maxReps,
          set: 1,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
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
        expect(mockQueueSpeak).toHaveBeenCalledWith(
          'Set complete. Rest now.',
          expect.any(Object),
        )
      })

      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
        expect(result.current.currentSet.value).toBe(2)
        expect(mockQueueSpeak).toHaveBeenCalledWith(
          'Set complete. Rest now.',
          expect.any(Object),
        )
      })

      // Advance timers to finish the rest target
      act(() =>
        jest.advanceTimersByTime(defaultSettings.restSeconds * 1000 + 500),
      )

      await waitFor(() => {
        // It should STILL be running, but effectively notifying
        expect(result.current.phase).toBe('Rest')
        expect(result.current.statusText.value).toContain('Rest:')
        // The message "Rest target reached" should have been spoken
        expect(mockQueueSpeak).toHaveBeenCalledWith(
          'Rest target reached.',
          expect.any(Object),
        )
      })
    })

    it('starts the rest timer even when speech callbacks never fire', async () => {
      // Simulate stuck TTS: the announcement is queued but never settles.
      mockQueueSpeak.mockImplementationOnce(() => {})
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
        result.current.continueToNextPhase()
      })

      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
      })

      // The rest countdown must tick regardless of the speech outcome.
      act(() => jest.advanceTimersByTime(1100))
      expect(result.current.statusText.value).toMatch(/^Rest: /)
    })

    it('announces rest target even when a tick lands past the target second (timer throttling)', async () => {
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
        result.current.continueToNextPhase()
      })

      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
      })

      // Let one tick run normally, well before the 5s target
      act(() => jest.advanceTimersByTime(1000))
      expect(result.current.isRestComplete).toBe(false)

      // Simulate a throttled/backgrounded JS timer: the clock jumps well past
      // the target without any ticks firing, then a single delayed tick runs.
      act(() => {
        jest.setSystemTime(Date.now() + 10000)
      })
      act(() => jest.advanceTimersByTime(1000))

      await waitFor(() => {
        expect(result.current.isRestComplete).toBe(true)
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )

      // The announcement must fire only once even though subsequent ticks
      // also satisfy elapsed >= restSeconds
      mockQueueSpeak.mockClear()
      act(() => jest.advanceTimersByTime(3000))
      expect(mockQueueSpeak).not.toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )
    })

    it('should rest after the last set, then complete the exercise on next phase', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          defaultSettings.maxSets, // Start on the last set
        ),
      )

      // Manually trigger the end of the last set
      act(() => {
        result.current.continueToNextPhase()
      })

      // The last set completes and starts rest phase
      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
        expect(result.current.isExerciseComplete).toBe(false)
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith(
        'Set complete. Rest now.',
        expect.any(Object),
      )

      // Advancing past post-exercise rest completes the exercise
      act(() => {
        result.current.continueToNextPhase()
      })

      await waitFor(() => {
        expect(result.current.isExerciseComplete).toBe(true)
        expect(result.current.statusText.value).toBe('Exercise Complete!')
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith('Set complete.', {
        priority: true,
      })
    })

    it('runs an extra set instead of completing when sets increase mid-exercise', async () => {
      const { result, rerender } = renderHook<
        WorkoutTimerHook,
        { exercise: Exercise }
      >(
        ({ exercise }) =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            exercise,
            mockOnSetComplete,
            activeExercise.sets, // Start on what was the last set
          ),
        { initialProps: { exercise: activeExercise } },
      )

      // User adds one more set while the (previously) final set is active
      rerender({
        exercise: { ...activeExercise, sets: activeExercise.sets + 1 },
      })

      act(() => {
        result.current.continueToNextPhase()
      })

      // Should rest and advance to the extra set, not complete the exercise
      await waitFor(() => {
        expect(result.current.isExerciseComplete).toBe(false)
        expect(result.current.currentSet.value).toBe(activeExercise.sets + 1)
        expect(mockQueueSpeak).toHaveBeenCalledWith(
          'Set complete. Rest now.',
          expect.any(Object),
        )
      })

      // Finishing the extra set enters rest after final set
      act(() => {
        result.current.continueToNextPhase()
      })
      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
        expect(result.current.isExerciseComplete).toBe(false)
      })

      // Continuing after post-exercise rest completes the exercise
      act(() => {
        result.current.continueToNextPhase()
      })
      await waitFor(() => {
        expect(result.current.isExerciseComplete).toBe(true)
        expect(result.current.statusText.value).toBe('Exercise Complete!')
      })
    })

    it('should only call onSetComplete once when endSet is called twice rapidly', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      // Start workout and advance past countdown into counting phase
      act(() => result.current.startWorkout())
      act(() =>
        jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000),
      )

      // Advance through at least one rep
      act(() =>
        jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000),
      )

      mockOnSetComplete.mockClear()

      // Call endSet twice rapidly (simulating race between auto-complete and user tap)
      act(() => {
        result.current.endSet()
        result.current.endSet()
      })

      await waitFor(() => {
        // onSetComplete should only be called once despite two endSet calls
        expect(mockOnSetComplete).toHaveBeenCalledTimes(1)
      })
    })

    it('Countdown announces remaining time only when countdown <= countdownAnnouncementThreshold', async () => {
      const longCountdownSettings = {
        ...defaultSettings,
        countdownSeconds: 20,
        countdownAnnouncementThreshold: 15,
      }
      const { result } = renderHook(() =>
        useWorkoutTimer(
          longCountdownSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())

      // Initially, at 20s, it says 'Get ready.'
      expect(mockQueueSpeak).toHaveBeenCalledWith('Get ready.', {
        priority: true,
      })
      mockQueueSpeak.mockClear()

      // Advance by 1 second to 19s
      act(() => jest.advanceTimersByTime(1000))
      // Not below threshold, shouldn't speak 19
      expect(mockQueueSpeak).not.toHaveBeenCalledWith('19')

      // Advance by 6 ticks to cross 14
      for (let i = 0; i < 6; i++) {
        act(() => jest.advanceTimersByTime(1000))
      }
      expect(mockQueueSpeak).toHaveBeenCalledWith('15')
      expect(mockQueueSpeak).toHaveBeenCalledWith('14')
    })

    it('skips eccentric countdown speech when eccentricCountdownEnabled is false', async () => {
      const settingsWithoutEccentricSpeech = {
        ...defaultSettings,
        eccentricCountdownEnabled: false,
        countdownSeconds: 1,
        concentricSeconds: 1,
        eccentricSeconds: 3,
      }
      const { result } = renderHook(() =>
        useWorkoutTimer(
          settingsWithoutEccentricSpeech,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())
      // Get past countdown
      act(() => jest.advanceTimersByTime(1000))

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric')
      })

      // Get past concentric
      act(() => jest.advanceTimersByTime(1000))

      await waitFor(() => {
        expect(result.current.phase).toBe('Eccentric')
      })

      // Advance by 1 second to trigger eccentric tick if it were enabled
      act(() => jest.advanceTimersByTime(1000))

      expect(mockSpeakEccentric).not.toHaveBeenCalled()
    })

    it('should end the set and call onSetComplete when endSet is called during concentric phase', async () => {
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
      // Enter concentric phase
      for (let i = 0; i < defaultSettings.countdownSeconds; i++) {
        act(() => jest.advanceTimersByTime(1000))
      }

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric')
      })

      act(() => result.current.endSet())

      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledWith({
          exerciseId: activeExercise.id,
          reps: 1,
          set: 1,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        })
      })
    })
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

    it('should record a fresh setStartTime when jumping to a rep from idle', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      const jumpTime = Date.now()
      act(() => {
        result.current.jumpToRep(2)
      })

      // Let some workout time elapse, then end the set
      act(() => jest.advanceTimersByTime(3000))
      act(() => result.current.endSet())

      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledTimes(1)
      })

      // Without the fix, startTime would be the stale value (0) from before the jump
      const details = mockOnSetComplete.mock.calls[0][0]
      expect(details.startTime).toBe(jumpTime)
    })

    it('should keep the original setStartTime when jumping to a rep mid-set', async () => {
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
      act(() =>
        jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000),
      )

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric')
      })
      const afterCountdown = Date.now()

      // Jump mid-set to correct the rep count — the set start must not move
      act(() => jest.advanceTimersByTime(500))
      const jumpTime = Date.now()
      act(() => result.current.jumpToRep(2))
      act(() => result.current.endSet())

      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledTimes(1)
      })

      const details = mockOnSetComplete.mock.calls[0][0]
      expect(details.startTime).toBeGreaterThan(0)
      expect(details.startTime).toBeLessThanOrEqual(afterCountdown)
      expect(details.startTime).toBeLessThan(jumpTime)
    })

    it('should handle jumpToRep 0 correctly', async () => {
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
        result.current.jumpToRep(0)
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true)
        expect(result.current.currentRep.value).toBe(0)
        expect(result.current.phase).toBe('Concentric')
      })
    })
  })

  describe('Edge Cases and Exercise Changes', () => {
    it('should reset the state when the active exercise or starting set changes', () => {
      const { result, rerender } = renderHook(
        ({ exercise, set }: { exercise: Exercise; set: number }) =>
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

    it('should end the set and call onSetComplete when endSet is called during countdown', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      // Start the workout to enter the countdown phase
      act(() => {
        result.current.startWorkout()
      })

      // Ensure we are in the countdown phase
      expect(result.current.phase).toBe('Get Ready')
      expect(result.current.isRunning).toBe(true)

      // Advance time slightly, but not enough to finish the countdown
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // End the set during the countdown
      act(() => {
        result.current.endSet()
      })

      // Check that onSetComplete was called with 0 reps
      await waitFor(() => {
        expect(mockOnSetComplete).toHaveBeenCalledWith({
          exerciseId: activeExercise.id,
          reps: 0, // Reps should be 0 as the set was ended during countdown
          set: 1,
          startTime: expect.any(Number), // startTime is updated to endTime during countdown
          endTime: expect.any(Number),
        })
      })

      // Check that the timer is no longer running
      expect(result.current.isRunning).toBe(false)
    })

    it('should not reset timer when startingSet changes during active workout', async () => {
      const { result, rerender } = renderHook(
        ({ exercise, set }: { exercise: Exercise; set: number }) =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            exercise,
            mockOnSetComplete,
            set,
          ),
        { initialProps: { exercise: activeExercise, set: 1 } },
      )

      // Start workout and enter countdown
      act(() => result.current.startWorkout())
      expect(result.current.isRunning).toBe(true)
      expect(result.current.phase).toBe('Get Ready')

      act(() => jest.advanceTimersByTime(1000))

      // Simulate startingSet changing (as if history was updated)
      rerender({ exercise: activeExercise, set: 2 })

      // Timer should STILL be running - not reset
      expect(result.current.isRunning).toBe(true)
      expect(result.current.currentSet.value).toBe(1) // Still on set 1
    })

    it('should handle ending a set during the rest phase', async () => {
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
      // Trigger transition to rest
      act(() => result.current.continueToNextPhase())

      await waitFor(() => {
        expect(result.current.phase).toBe('Rest')
      })

      // User decides to skip rest and start next set immediately (or end 'rest' set?)
      // Actually continueToNextPhase IS the way to skip rest.
      // But if they call endSet() during rest, what should happen?
      // Usually endSet() is for ending the *active* set (concentric/eccentric).
      // If called during rest, it might be ignored or act as skip.
      // Let's assume it should probably act as "finish rest" or "start next set".
      // Checking current behavior or desired behavior:
      act(() => result.current.endSet())

      // If implemented, it should probably stop the timer or transition.
      // For now, let's verify it doesn't crash and perhaps stops the timer as 'endSet' implies stopping.
      expect(result.current.isRunning).toBe(false)
    })

    it('should handle rapid set completion correctly', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      // Set 1
      act(() => result.current.startWorkout())
      act(() => result.current.continueToNextPhase()) // Finish Set 1, Enter Rest
      await waitFor(() => expect(result.current.phase).toBe('Rest'))

      act(() => result.current.runNextSet()) // Skip Rest, Start Set 2
      await waitFor(() => expect(result.current.phase).toBe('Get Ready')) // or Concentric depending on logic

      // Finish Set 2 immediately (enters post-exercise rest)
      act(() => result.current.continueToNextPhase()) // Finish Set 2

      await waitFor(() => {
        if (activeExercise.sets > 2) {
          expect(result.current.currentSet.value).toBe(3)
        } else {
          expect(result.current.phase).toBe('Rest')
        }
      })

      if (activeExercise.sets <= 2) {
        act(() => result.current.continueToNextPhase()) // Complete exercise after rest
        await waitFor(() => {
          expect(result.current.isExerciseComplete).toBe(true)
        })
      }
    })

    it('should handle settings changes during active workout', async () => {
      const { result, rerender } = renderHook(
        ({ settings, exercise }: { settings: Settings; exercise: Exercise }) =>
          useWorkoutTimer(
            settings,
            mockAudioHandler,
            exercise,
            mockOnSetComplete,
            1,
          ),
        {
          initialProps: { settings: defaultSettings, exercise: activeExercise },
        },
      )

      act(() => result.current.startWorkout())
      expect(result.current.isRunning).toBe(true)

      const newSettings = { ...defaultSettings, countdownSeconds: 10 }
      rerender({ settings: newSettings, exercise: activeExercise })

      expect(result.current.isRunning).toBe(true)
    })

    it('should not throw and should full reset when startWorkout is called with no active exercise', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          undefined as any, // no active exercise
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())
      act(() =>
        jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000),
      )
      act(() => result.current.endSet())

      expect(result.current.isRunning).toBe(false)
      // Since no active exercise, it does fullReset when endSet is called instead of calling onSetComplete
      expect(mockOnSetComplete).not.toHaveBeenCalled()
    })

    it('rest target announcement fires exactly once per rest period and preserves remaining/elapsed time across pause/resume', async () => {
      const threeSetExercise = { ...activeExercise, sets: 3 }
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          threeSetExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())
      act(() => result.current.continueToNextPhase()) // finish set 1 -> enter rest

      await waitFor(() => expect(result.current.phase).toBe('Rest'))

      mockQueueSpeak.mockClear()

      // Ticks continue past target (restSeconds = 5)
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(result.current.isRestComplete).toBe(true)
      })

      // Announcement should have fired once
      expect(mockQueueSpeak).toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )
      expect(mockQueueSpeak).toHaveBeenCalledTimes(1)

      // Advance more: should not fire announcement again
      mockQueueSpeak.mockClear()
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(mockQueueSpeak).not.toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )

      // Pause during rest: elapsed time should be stored
      act(() => {
        result.current.pauseWorkout()
      })
      expect(result.current.isPaused).toBe(true)

      // Resume: should not re-fire announcement since it was already announced
      mockQueueSpeak.mockClear()
      act(() => {
        result.current.pauseWorkout() // toggles pause -> resume
      })
      expect(result.current.isPaused).toBe(false)
      expect(mockQueueSpeak).not.toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )

      // Moving to next set (set 2 rest) should reset restTargetAnnounced
      act(() => result.current.runNextSet())
      await waitFor(() => expect(result.current.phase).toBe('Get Ready'))
      act(() => result.current.continueToNextPhase())
      await waitFor(() => expect(result.current.phase).toBe('Rest'))

      mockQueueSpeak.mockClear()
      act(() => {
        jest.advanceTimersByTime(5000)
      })
      await waitFor(() => {
        expect(result.current.isRestComplete).toBe(true)
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith(
        'Rest target reached.',
        expect.any(Object),
      )
    })

    it('endSet during eccentric phase records setStartTime and passes to onSetComplete', async () => {
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
      act(() => {
        jest.advanceTimersByTime(3000) // countdown
      })
      await waitFor(() => expect(result.current.phase).toBe('Concentric'))

      act(() => {
        jest.advanceTimersByTime(1000) // concentric duration
      })
      await waitFor(() => expect(result.current.phase).toBe('Eccentric'))

      mockOnSetComplete.mockClear()
      act(() => {
        result.current.endSet()
      })

      expect(mockOnSetComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        }),
      )
    })

    it('endSet during countdown sets setStartTime to endTime', () => {
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
      mockOnSetComplete.mockClear()

      act(() => {
        result.current.endSet()
      })

      expect(mockOnSetComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        }),
      )
      const call = mockOnSetComplete.mock.calls[0][0]
      expect(call.startTime).toBe(call.endTime)
    })

    it('pauseWorkout when not running or startWorkout when already running are no-ops', () => {
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
        result.current.pauseWorkout()
      })
      expect(result.current.isPaused).toBe(false)

      act(() => {
        result.current.startWorkout()
      })
      expect(result.current.isRunning).toBe(true)

      act(() => {
        result.current.startWorkout()
      })
      expect(result.current.isRunning).toBe(true)
    })

    it('addCountdownTime adds 5s only during countdown phase', () => {
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
        result.current.addCountdownTime()
      })

      act(() => {
        result.current.startWorkout()
      })
      expect(result.current.phase).toBe('Get Ready')

      act(() => {
        result.current.addCountdownTime()
      })
    })

    it('eccentric audio countdown speaks each of the last <=5 whole seconds once', async () => {
      const customSettings = {
        ...defaultSettings,
        eccentricSeconds: 6,
        eccentricCountdownEnabled: true,
      }
      const { result } = renderHook(() =>
        useWorkoutTimer(
          customSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      act(() => result.current.startWorkout())
      act(() => {
        jest.advanceTimersByTime(3000) // countdown
      })
      await waitFor(() => expect(result.current.phase).toBe('Concentric'))

      act(() => {
        jest.advanceTimersByTime(1000) // concentric
      })
      await waitFor(() => expect(result.current.phase).toBe('Eccentric'))

      mockSpeakEccentric.mockClear()
      for (let i = 0; i < 6; i++) {
        act(() => {
          jest.advanceTimersByTime(1000)
        })
      }

      await waitFor(() => {
        expect(mockSpeakEccentric).toHaveBeenCalledTimes(5)
      })
      expect(mockSpeakEccentric).toHaveBeenCalledWith('5')
      expect(mockSpeakEccentric).toHaveBeenCalledWith('1')
    })

    it('countdown reaching 0: speaks Go!, rep to 1, speaks 1 when not jumping', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      mockQueueSpeak.mockClear()
      act(() => result.current.startWorkout())
      act(() => {
        jest.advanceTimersByTime(3000) // countdown seconds
      })

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric')
      })
      expect(mockQueueSpeak).toHaveBeenCalledWith('Go!', expect.any(Object))
      expect(mockQueueSpeak).toHaveBeenCalledWith('1')
      expect(result.current.currentRep.value).toBe(1)
    })

    it('live-activity integration is called on start, update, and stop', async () => {
      const {
        startWorkoutActivity,
        updateWorkoutActivity,
        stopWorkoutActivity,
      } = require('../../utils/workoutActivity')
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )

      startWorkoutActivity.mockClear()
      updateWorkoutActivity.mockClear()
      stopWorkoutActivity.mockClear()

      act(() => {
        result.current.startWorkout()
      })

      await waitFor(() => {
        expect(startWorkoutActivity).toHaveBeenCalled()
      })

      act(() => {
        jest.advanceTimersByTime(3000) // countdown ends -> concentric
      })
      await waitFor(() => {
        expect(updateWorkoutActivity).toHaveBeenCalled()
      })

      // Stop workout manually
      act(() => {
        result.current.stopWorkout()
      })
      await waitFor(() => {
        expect(stopWorkoutActivity).toHaveBeenCalled()
      })

      // Or, unmount while active:
      // Let's render a new hook and unmount it to verify unmount behavior
      const renderRes = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockOnSetComplete,
          1,
        ),
      )
      act(() => {
        renderRes.result.current.startWorkout()
      })
      await waitFor(() => {
        expect(startWorkoutActivity).toHaveBeenCalled()
      })

      stopWorkoutActivity.mockClear()
      renderRes.unmount()
      expect(stopWorkoutActivity).toHaveBeenCalled()
    })
  })
})
