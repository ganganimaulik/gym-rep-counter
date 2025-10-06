import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useData, Settings, Workout } from '../useData';
import { setDoc, getDoc } from 'firebase/firestore';
import { getDefaultWorkouts } from '../../utils/defaultWorkouts';

// Mock getLocalDateString to return a consistent date
const MOCK_DATE = '2024-01-01';
jest.mock('../../utils/getLocalDateString', () => jest.fn(() => MOCK_DATE));

// Mock default workouts
jest.mock('../../utils/defaultWorkouts');
const mockDefaultWorkouts = [
  { id: '1', name: 'Default Workout', exercises: [] },
];
(getDefaultWorkouts as jest.Mock).mockReturnValue(mockDefaultWorkouts);

describe('useData Hook', () => {
  const mockUser = { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' };
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

  beforeEach(() => {
    // Reset mocks before each test
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.clear as jest.Mock).mockClear();
    (setDoc as jest.Mock).mockClear();
    (getDoc as jest.Mock).mockClear();
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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(customSettings));
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
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('repCounterSettings', JSON.stringify(newSettings));
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
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('workouts', JSON.stringify(mockDefaultWorkouts));
    });

    it('should load workouts from AsyncStorage', async () => {
      const customWorkouts: Workout[] = [{ id: '2', name: 'My Workout', exercises: [] }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(customWorkouts));
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadWorkouts();
      });

      expect(result.current.workouts).toEqual(customWorkouts);
    });

    it('should save workouts to AsyncStorage and Firestore', async () => {
      const { result } = renderHook(() => useData());
      const newWorkouts: Workout[] = [{ id: '3', name: 'New Workout', exercises: [] }];

      await act(async () => {
        await result.current.saveWorkouts(newWorkouts, mockUser);
      });

      expect(result.current.workouts).toEqual(newWorkouts);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('workouts', JSON.stringify(newWorkouts));
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Set Completions', () => {
    const exerciseId = 'ex1';

    it('should load set completions for today', async () => {
      const completions = { [exerciseId]: { date: MOCK_DATE, completed: [1] } };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(completions));
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadSetCompletions();
      });

      expect(result.current.setCompletions).toEqual(completions);
    });

    it('should reset completions if they are from a previous day', async () => {
      const oldCompletions = { [exerciseId]: { date: '2023-12-31', completed: [1] } };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(oldCompletions));
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.loadSetCompletions();
      });

      expect(result.current.setCompletions).toEqual({});
    });

    it('should mark a set as completed', async () => {
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.markSetAsCompleted(exerciseId, 1, mockUser);
      });

      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it('should correctly check if previous sets are completed', async () => {
      const { result } = renderHook(() => useData());

      await act(async () => {
        await result.current.markSetAsCompleted(exerciseId, 1, null);
      });

      expect(result.current.arePreviousSetsCompleted(exerciseId, 1)).toBe(true);
      expect(result.current.arePreviousSetsCompleted(exerciseId, 2)).toBe(true);

      await act(async () => {
        await result.current.markSetAsCompleted(exerciseId, 2, null);
      });

      expect(result.current.arePreviousSetsCompleted(exerciseId, 3)).toBe(true);
      expect(result.current.arePreviousSetsCompleted(exerciseId, 4)).toBe(false);
    });

    it('should reset sets from a given set number', async () => {
      const { result } = renderHook(() => useData());
      for (const set of [1, 2, 3]) {
        await act(async () => {
          await result.current.markSetAsCompleted(exerciseId, set, null);
        });
      }

      await act(async () => {
        await result.current.resetSetsFrom(exerciseId, 2, mockUser);
      });

      expect(result.current.isSetCompleted(exerciseId, 1)).toBe(true);
      expect(result.current.isSetCompleted(exerciseId, 2)).toBe(false);
      expect(result.current.isSetCompleted(exerciseId, 3)).toBe(false);
    });

    it('should get the next uncompleted set', async () => {
        const { result } = renderHook(() => useData());

        expect(result.current.getNextUncompletedSet(exerciseId)).toBe(1);

        await act(async () => {
          await result.current.markSetAsCompleted(exerciseId, 1, null);
        });

        expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2);

        await act(async () => {
          await result.current.markSetAsCompleted(exerciseId, 3, null);
        });

        expect(result.current.getNextUncompletedSet(exerciseId)).toBe(2);

        await act(async () => {
          await result.current.markSetAsCompleted(exerciseId, 2, null);
        });

        expect(result.current.getNextUncompletedSet(exerciseId)).toBe(4);
      });
  });

  describe('User Data Sync', () => {
    it('should sync data from firestore for an existing user', async () => {
        const firestoreData = {
          settings: { ...defaultSettings, restSeconds: 90 },
          workouts: [{ id: 'firebase-workout', name: 'Firebase Workout', exercises: [] }],
          setCompletions: { 'firebase-ex': { date: MOCK_DATE, completed: [1] } },
        };
        (getDoc as jest.Mock).mockResolvedValue({
          exists: () => true,
          data: () => firestoreData,
        });

        const { result } = renderHook(() => useData());
        await act(async () => {
          await result.current.syncUserData(mockUser, {} as any, [], {});
        });

        expect(result.current.settings).toEqual(firestoreData.settings);
        expect(result.current.workouts).toEqual(firestoreData.workouts);
        expect(result.current.setCompletions).toEqual(firestoreData.setCompletions);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('repCounterSettings', JSON.stringify(firestoreData.settings));
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('workouts', JSON.stringify(firestoreData.workouts));
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('setCompletions', JSON.stringify(firestoreData.setCompletions));
      });

      it('should upload local data for a new user', async () => {
        (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

        const { result } = renderHook(() => useData());
        const localSettings = { ...defaultSettings, countdownSeconds: 2 };
        const localWorkouts = [{ id: 'local-workout', name: 'Local Workout', exercises: [] }];
        const localCompletions = { 'local-ex': { date: MOCK_DATE, completed: [1, 2] } };

        await act(async () => {
            await result.current.loadSettings();
            await result.current.loadWorkouts();
            await result.current.loadSetCompletions();

            await result.current.saveSettings(localSettings, null);
            await result.current.saveWorkouts(localWorkouts, null);
            await result.current.saveSetCompletions(localCompletions, null);
        });

        await act(async () => {
          await result.current.syncUserData(mockUser, localSettings, localWorkouts, localCompletions);
        });

        expect(setDoc).toHaveBeenCalledWith(
          undefined, // result of doc() is mocked
          expect.objectContaining({
            settings: localSettings,
            workouts: localWorkouts,
            setCompletions: localCompletions,
          }),
        );
      });
  });
});