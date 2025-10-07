import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { useData, Settings, Workout } from '../useData';
import { getDefaultWorkouts } from '../../utils/defaultWorkouts';

// Mock Firestore
jest.mock('firebase/firestore', () => {
  const mockTimestamp = jest.fn((seconds, nanoseconds) => ({
    seconds: seconds,
    nanoseconds: nanoseconds,
    toDate: () => new Date(seconds * 1000),
  }));
  mockTimestamp.now = jest.fn(() => {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = (now % 1000) * 1000000;
    return { seconds, nanoseconds, toDate: () => new Date(now) };
  });
  mockTimestamp.fromDate = jest.fn((date) => {
    const time = date.getTime();
    const seconds = Math.floor(time / 1000);
    const nanoseconds = (time % 1000) * 1000000;
    return { seconds, nanoseconds, toDate: () => date };
  });

  return {
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    collection: jest.fn(),
    addDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    Timestamp: mockTimestamp,
    writeBatch: jest.fn(),
  };
});

const mockBatch = {
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};
(writeBatch as jest.Mock).mockReturnValue(mockBatch);

// Mock default workouts
jest.mock('../../utils/defaultWorkouts');
const mockDefaultWorkouts = [
  { id: '1', name: 'Default Workout', exercises: [] },
];
(getDefaultWorkouts as jest.Mock).mockReturnValue(mockDefaultWorkouts);

describe('useData Hook', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@test.com',
    displayName: 'Test User',
  };
  const defaultSettings: Settings = {
    countdownSeconds: 5,
    restSeconds: 60,
    maxReps: 15,
    maxSets: 3,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
    volume: 1.0,
  };

  let memoryStore = {};
  let dateNowSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.delete.mockClear();
    mockBatch.commit.mockClear();

    // Mock Date.now() to ensure unique IDs for local entries
    let time = 1;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => 1000000000000 + time++);

    // Mock AsyncStorage implementation
    memoryStore = {};
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
      memoryStore[key] = value;
      return Promise.resolve(null);
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      return Promise.resolve(memoryStore[key] || null);
    });
    (AsyncStorage.clear as jest.Mock).mockImplementation(() => {
      memoryStore = {};
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('Settings', () => {
    it('should load default settings if none are in storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadSettings();
      });

      expect(result.current.settings).toEqual(defaultSettings);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('repCounterSettings');
    });

    it('should load settings from AsyncStorage', async () => {
      const customSettings = { ...defaultSettings, countdownSeconds: 10 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(customSettings),
      );
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadSettings();
      });

      expect(result.current.settings).toEqual(customSettings);
    });

    it('should save settings to AsyncStorage and Firestore', async () => {
      const { result } = renderHook(() => useData());
      const newSettings = { ...defaultSettings, volume: 0.5 };

      await act(async () => {
        await result.current.saveSettings(newSettings, mockUser);
      });

      expect(result.current.settings).toEqual(newSettings);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'repCounterSettings',
        JSON.stringify(newSettings),
      );
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Workouts', () => {
    it('should load default workouts if none are in storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadWorkouts();
      });

      expect(result.current.workouts).toEqual(mockDefaultWorkouts);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(mockDefaultWorkouts),
      );
    });

    it('should load workouts from AsyncStorage', async () => {
      const customWorkouts: Workout[] = [
        { id: '2', name: 'My Workout', exercises: [] },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(customWorkouts),
      );
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadWorkouts();
      });

      expect(result.current.workouts).toEqual(customWorkouts);
    });

    it('should save workouts to AsyncStorage and Firestore', async () => {
      const { result } = renderHook(() => useData());
      const newWorkouts: Workout[] = [
        { id: '3', name: 'New Workout', exercises: [] },
      ];

      await act(async () => {
        await result.current.saveWorkouts(newWorkouts, mockUser);
      });

      expect(result.current.workouts).toEqual(newWorkouts);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(newWorkouts),
      );
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Workout History & Completions', () => {
    const exerciseId = 'ex1';
    const workoutId = 'w1';

    it('should add a history entry and update todaysCompletions', async () => {
      const { result } = renderHook(() => useData());
      (addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' });

      const entry = {
        workoutId,
        exerciseId,
        exerciseName: 'Test Exercise',
        reps: 10,
        weight: 50,
      };
      const setNumber = 1;

      await act(async () => {
        await result.current.addHistoryEntry(entry, setNumber, mockUser);
      });

      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ ...entry, set: setNumber }),
      );
      expect(result.current.todaysCompletions).toHaveLength(1);
      expect(result.current.todaysCompletions[0]).toMatchObject({
        ...entry,
        set: setNumber,
      });
    });

    it("should fetch today's completions for a given exercise", async () => {
      const mockCompletions = [
        { id: 'doc1', data: () => ({ exerciseId, set: 1 }) },
        { id: 'doc3', data: () => ({ exerciseId, set: 2 }) },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockCompletions });
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.fetchTodaysCompletions(mockUser, exerciseId);
      });

      expect(getDocs).toHaveBeenCalled();
      expect(result.current.todaysCompletions).toHaveLength(2);
      expect(
        result.current.todaysCompletions.every((c) => c.exerciseId === exerciseId),
      ).toBe(true);
    });

    it('should correctly identify if a set is completed', async () => {
      const { result } = renderHook(() => useData());

      await act(async () => {
        (addDoc as jest.Mock).mockResolvedValue({ id: 'doc1' });
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          mockUser,
        );
      });

      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true);
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false);
    });

    it('should get the next uncompleted set', async () => {
      const { result } = renderHook(() => useData());
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(1);

      await act(async () => {
        (addDoc as jest.Mock).mockResolvedValue({ id: 'doc1' });
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          mockUser,
        );
      });
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2);

      await act(async () => {
        (addDoc as jest.Mock).mockResolvedValue({ id: 'doc2' });
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          3,
          mockUser,
        );
      });
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2);

      await act(async () => {
        (addDoc as jest.Mock).mockResolvedValue({ id: 'doc3' });
        await result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          mockUser,
        );
      });
      expect(result.current.getNextUncompletedSet(exerciseId)).toBe(4);
    });

    it('should reset sets from a given set number', async () => {
      const { result } = renderHook(() => useData());
      (addDoc as jest.Mock).mockResolvedValue({ id: 'new-doc-id' });

      await act(async () => {
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          1,
          mockUser,
        );
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          2,
          mockUser,
        );
        result.current.addHistoryEntry(
          {
            workoutId,
            exerciseId,
            exerciseName: 'Test Exercise',
            reps: 10,
            weight: 50,
          },
          3,
          mockUser,
        );
      });
      result.current.todaysCompletions[0].id = 'doc1';
      result.current.todaysCompletions[1].id = 'doc2';
      result.current.todaysCompletions[2].id = 'doc3';

      await act(async () => {
        await result.current.resetSetsFrom(exerciseId, 2, mockUser);
      });

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
      expect(result.current.todaysCompletions).toHaveLength(1);
      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true);
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false);
      expect(result.current.isSetCompleted(exerciseId, 3)).toBe(false);
    });
  });

  describe('User Data Sync', () => {
    it('should sync settings and workouts from firestore for an existing user', async () => {
      const firestoreData = {
        settings: { ...defaultSettings, restSeconds: 90 },
        workouts: [
          { id: 'firebase-workout', name: 'Firebase Workout', exercises: [] },
        ],
      };
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => firestoreData,
      });

      const { result } = renderHook(() => useData());
      await act(async () => {
        await result.current.syncUserData(mockUser, {} as any, []);
      });

      expect(result.current.settings).toEqual(firestoreData.settings);
      expect(result.current.workouts).toEqual(firestoreData.workouts);
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'setCompletions',
        expect.any(String),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'repCounterSettings',
        JSON.stringify(firestoreData.settings),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'workouts',
        JSON.stringify(firestoreData.workouts),
      );
    });

    it('should upload local data for a new user', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const { result } = renderHook(() => useData());
      const localSettings = { ...defaultSettings, countdownSeconds: 2 };
      const localWorkouts = [
        { id: 'local-workout', name: 'Local Workout', exercises: [] },
      ];

      await act(async () => {
        await result.current.syncUserData(mockUser, localSettings, localWorkouts);
      });

      const setDocCall = (setDoc as jest.Mock).mock.calls[0];
      expect(setDocCall[1]).not.toHaveProperty('setCompletions');
      expect(setDocCall[1]).toHaveProperty('settings', localSettings);
      expect(setDocCall[1]).toHaveProperty('workouts', localWorkouts);
    });
  });

  describe('Anonymous User Data', () => {
    const exerciseId = 'anon-ex1';
    const workoutId = 'anon-w1';

    it('should save history to AsyncStorage for anonymous users', async () => {
      const { result } = renderHook(() => useData());
      const entry = {
        workoutId,
        exerciseId,
        exerciseName: 'Test Exercise',
        reps: 5,
        weight: 10,
      };
      const setNumber = 1;

      await act(async () => {
        await result.current.addHistoryEntry(entry, setNumber, null);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'todaysCompletions',
        expect.any(String),
      );
      expect(addDoc).not.toHaveBeenCalled();
      expect(result.current.todaysCompletions).toHaveLength(1);
      expect(result.current.todaysCompletions[0]).toMatchObject({
        ...entry,
        set: setNumber,
      });
    });

    it('should fetch history from AsyncStorage for anonymous users', async () => {
      const mockCompletion = {
        id: 'local-123',
        exerciseId,
        exerciseName: 'Test Exercise',
        reps: 5,
        weight: 10,
        set: 1,
        date: Timestamp.now(),
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([mockCompletion]));

      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.fetchTodaysCompletions(null, exerciseId);
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('todaysCompletions');
      expect(getDocs).not.toHaveBeenCalled();
      expect(result.current.todaysCompletions).toHaveLength(1);
      expect(result.current.todaysCompletions[0].id).toBe('local-123');
    });

    it('should reset sets from AsyncStorage for anonymous users', async () => {
        const { result } = renderHook(() => useData());
        const entry = {
          workoutId,
          exerciseId,
          exerciseName: 'Test Exercise',
          reps: 5,
          weight: 10,
        };

        await act(async () => {
          await result.current.addHistoryEntry(entry, 1, null);
          await result.current.addHistoryEntry(entry, 2, null);
        });

        expect(result.current.todaysCompletions).toHaveLength(2);

        await act(async () => {
          await result.current.resetSetsFrom(exerciseId, 2, null);
        });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'todaysCompletions',
          expect.stringContaining(entry.exerciseName),
        );
        expect(mockBatch.commit).not.toHaveBeenCalled();
        expect(result.current.todaysCompletions).toHaveLength(1);
        expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true);
        expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false);
      });
  });
});