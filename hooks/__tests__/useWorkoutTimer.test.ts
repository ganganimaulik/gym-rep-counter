import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWorkoutTimer } from '../useWorkoutTimer';
import { Settings, Exercise } from '../useData';
import { AudioHandler } from '../useAudio';
import * as Speech from 'expo-speech';
import {
  bgSetTimeout,
  bgClearTimeout,
  enableBackgroundExecution,
} from 'expo-background-timer';
import { User } from 'firebase/auth';

// Mock dependencies
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('expo-background-timer', () => ({
  bgSetTimeout: jest.fn((callback, timeout) => setTimeout(callback, timeout)),
  bgClearTimeout: jest.fn((id) => clearTimeout(id)),
  enableBackgroundExecution: jest.fn(),
  disableBackgroundExecution: jest.fn(),
}));

const mockQueueSpeak = jest.fn((_text, options) => {
  if (options?.onDone) {
    options.onDone();
  }
});
const mockSpeakEccentric = jest.fn();
const mockMarkSetAsCompleted = jest.fn();
const mockIsSetCompleted = jest.fn().mockReturnValue(false);
const mockGetNextUncompletedSet = jest.fn().mockReturnValue(1);

const mockAudioHandler: AudioHandler = {
  queueSpeak: mockQueueSpeak,
  speakEccentric: mockSpeakEccentric,
  isSpeaking: false,
  stopSpeaking: jest.fn(),
  initializeAudio: jest.fn(),
};

const mockDataHandlers = {
  markSetAsCompleted: mockMarkSetAsCompleted,
  isSetCompleted: mockIsSetCompleted,
  getNextUncompletedSet: mockGetNextUncompletedSet,
};

const mockUser = { uid: 'test-uid' } as User;

const defaultSettings: Settings = {
  countdownSeconds: 3,
  restSeconds: 5,
  maxReps: 3,
  maxSets: 2,
  concentricSeconds: 1,
  eccentricSeconds: 2,
  eccentricCountdownEnabled: true,
  volume: 1,
};

const activeExercise: Exercise = {
  id: 'ex1',
  name: 'Test Exercise',
  sets: 2,
  reps: 3,
  weight: 10,
};

describe('useWorkoutTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Reset isSetCompleted to its default mock for most tests
    mockIsSetCompleted.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with the correct default state', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockUser,
        mockDataHandlers,
      ),
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentRep.value).toBe(0);
    expect(result.current.currentSet.value).toBe(1);
    expect(result.current.statusText.value).toBe('Press Start for Set 1');
  });

  it('should start the workout and begin the countdown', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockUser,
        mockDataHandlers,
      ),
    );

    act(() => {
      result.current.startWorkout();
    });

    expect(result.current.isRunning).toBe(true);
    expect(mockQueueSpeak).toHaveBeenCalledWith('Get ready.', { priority: true });
    expect(result.current.phase).toBe('Get Ready');
  });

  it('should stop the workout and reset the state', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockUser,
        mockDataHandlers,
      ),
    );

    act(() => {
      result.current.startWorkout();
    });

    act(() => {
      result.current.stopWorkout();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.currentRep.value).toBe(0);
    expect(result.current.statusText.value).toBe('Press Start for Set 1');
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('should pause and resume the workout', () => {
    const { result } = renderHook(() =>
      useWorkoutTimer(
        defaultSettings,
        mockAudioHandler,
        activeExercise,
        mockUser,
        mockDataHandlers,
      ),
    );

    act(() => {
      result.current.startWorkout();
    });

    // Pause
    act(() => {
      result.current.pauseWorkout();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.statusText.value).toBe('Paused');
    expect(mockQueueSpeak).toHaveBeenCalledWith('Paused', { priority: true });

    // Resume
    act(() => {
      result.current.pauseWorkout();
    });

    expect(result.current.isPaused).toBe(false);
    expect(mockQueueSpeak).toHaveBeenCalledWith('Resuming', { priority: true });
  });

  describe('Phase Transitions', () => {
    it('should transition from countdown to concentric phase', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => {
        result.current.startWorkout();
      });

      act(() => {
        jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000);
      });

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric');
        expect(result.current.currentRep.value).toBe(1);
      });
    });

    it('should transition from concentric to eccentric phase', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => result.current.startWorkout());
      act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000));
      act(() => jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000));

      await waitFor(() => {
        expect(result.current.phase).toBe('Eccentric');
      });
    });

    it('should transition from eccentric to the next rep (concentric)', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => result.current.startWorkout());
      act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000));
      act(() => jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000));
      act(() => jest.advanceTimersByTime(defaultSettings.eccentricSeconds * 1000));

      await waitFor(() => {
        expect(result.current.phase).toBe('Concentric');
        expect(result.current.currentRep.value).toBe(2);
      });
    });

    it('should transition to rest phase after the last rep', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => result.current.startWorkout());
      act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000));

      for (let i = 0; i < defaultSettings.maxReps; i++) {
        act(() => jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000));
        act(() => jest.advanceTimersByTime(defaultSettings.eccentricSeconds * 1000));
      }

      await waitFor(() => {
        expect(mockMarkSetAsCompleted).toHaveBeenCalledWith(activeExercise.id, 1, mockUser);
        expect(result.current.phase).toBe('Rest');
      });
    });

    it('should stop the timer after the rest phase is complete', async () => {
        const { result } = renderHook(() =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            activeExercise,
            mockUser,
            mockDataHandlers,
          ),
        );

        act(() => result.current.startWorkout());
        act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000));

        for (let i = 0; i < defaultSettings.maxReps; i++) {
          act(() => jest.advanceTimersByTime(defaultSettings.concentricSeconds * 1000));
          act(() => jest.advanceTimersByTime(defaultSettings.eccentricSeconds * 1000));
        }

        await waitFor(() => {
            expect(result.current.phase).toBe('Rest');
            expect(result.current.currentSet.value).toBe(2);
        });

        act(() => jest.advanceTimersByTime(defaultSettings.restSeconds * 1000 + 500));

        await waitFor(() => {
            expect(result.current.statusText.value).toBe('Press Start for Set 2');
        });
      });
  });

  describe('Advanced Controls', () => {
    it('should jump to a specific rep', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => {
        result.current.jumpToRep(5);
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true);
        expect(result.current.currentRep.value).toBe(5);
        expect(result.current.phase).toBe('Concentric');
      });
      expect(mockQueueSpeak).toHaveBeenCalledWith('Rep 5.', { priority: true });
    });

    it('should jump to a specific set', async () => {
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => {
        result.current.jumpToSet(2);
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true);
        expect(result.current.currentSet.value).toBe(2);
        expect(result.current.phase).toBe('Get Ready');
      });
      expect(mockQueueSpeak).toHaveBeenCalledWith('Set 2.', { priority: true });
    });

    it('should end a set manually and start the rest period', async () => {
        const { result } = renderHook(() =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            activeExercise,
            mockUser,
            mockDataHandlers,
          ),
        );

        act(() => result.current.startWorkout());
        act(() => jest.advanceTimersByTime(defaultSettings.countdownSeconds * 1000));

        act(() => {
          result.current.endSet();
        });

        await waitFor(() => {
          expect(mockMarkSetAsCompleted).toHaveBeenCalledWith(activeExercise.id, 1, mockUser);
          expect(result.current.phase).toBe('Rest');
          expect(result.current.currentSet.value).toBe(2);
        });
      });
  });

  describe('Edge Cases and Exercise Changes', () => {
    it('should not start a workout if the set is already completed', () => {
      mockIsSetCompleted.mockReturnValue(true);
      const { result } = renderHook(() =>
        useWorkoutTimer(
          defaultSettings,
          mockAudioHandler,
          activeExercise,
          mockUser,
          mockDataHandlers,
        ),
      );

      act(() => {
        result.current.startWorkout();
      });

      expect(result.current.isRunning).toBe(false);
      expect(mockQueueSpeak).toHaveBeenCalledWith('Set 1 is already completed for today.');
    });

    it('should reset the state when the active exercise changes', () => {
      const { result, rerender } = renderHook(
        ({ exercise }) =>
          useWorkoutTimer(
            defaultSettings,
            mockAudioHandler,
            exercise,
            mockUser,
            mockDataHandlers,
          ),
        { initialProps: { exercise: activeExercise } },
      );

      act(() => result.current.startWorkout());
      act(() => jest.advanceTimersByTime(5000)); // Get into a running state

      const newExercise = { ...activeExercise, id: 'ex2' };
      mockGetNextUncompletedSet.mockReturnValue(3); // Simulate new exercise starts at set 3

      rerender({ exercise: newExercise });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.currentRep.value).toBe(0);
      expect(result.current.currentSet.value).toBe(3);
      expect(result.current.statusText.value).toBe('Press Start for Set 3');
      expect(mockGetNextUncompletedSet).toHaveBeenCalledWith('ex2');
    });
  });
});