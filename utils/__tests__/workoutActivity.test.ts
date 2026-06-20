import { Platform } from 'react-native';
import { startWorkoutActivity, updateWorkoutActivity, stopWorkoutActivity } from '../workoutActivity';
import * as WorkoutActivity from '../../modules/workout-activity';

jest.mock('../../modules/workout-activity', () => ({
  startActivity: jest.fn(),
  updateActivity: jest.fn(),
  stopActivity: jest.fn(),
}));

describe('workoutActivity utils', () => {
  let originalConsoleError: typeof console.error;
  let originalPlatformOS: typeof Platform.OS;

  beforeAll(() => {
    originalConsoleError = console.error;
    originalPlatformOS = Platform.OS;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    Platform.OS = originalPlatformOS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkoutActivity', () => {
    it('should return early if Platform.OS is web', () => {
      Platform.OS = 'web';
      startWorkoutActivity({} as any);
      expect(WorkoutActivity.startActivity).not.toHaveBeenCalled();
    });

    it('should call WorkoutActivity.startActivity if Platform.OS is not web', () => {
      Platform.OS = 'ios';
      const state = {} as any;
      startWorkoutActivity(state);
      expect(WorkoutActivity.startActivity).toHaveBeenCalledWith(state);
    });

    it('should catch and log error if WorkoutActivity.startActivity throws', () => {
      Platform.OS = 'ios';
      const error = new Error('Test error');
      (WorkoutActivity.startActivity as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });
      startWorkoutActivity({} as any);
      expect(console.error).toHaveBeenCalledWith('Failed to start workout activity:', error);
    });
  });

  describe('updateWorkoutActivity', () => {
    it('should return early if Platform.OS is web', () => {
      Platform.OS = 'web';
      updateWorkoutActivity({} as any);
      expect(WorkoutActivity.updateActivity).not.toHaveBeenCalled();
    });

    it('should call WorkoutActivity.updateActivity if Platform.OS is not web', () => {
      Platform.OS = 'ios';
      const state = {} as any;
      updateWorkoutActivity(state);
      expect(WorkoutActivity.updateActivity).toHaveBeenCalledWith(state);
    });

    it('should catch and log error if WorkoutActivity.updateActivity throws', () => {
      Platform.OS = 'ios';
      const error = new Error('Test error');
      (WorkoutActivity.updateActivity as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });
      updateWorkoutActivity({} as any);
      expect(console.error).toHaveBeenCalledWith('Failed to update workout activity:', error);
    });
  });

  describe('stopWorkoutActivity', () => {
    it('should return early if Platform.OS is web', () => {
      Platform.OS = 'web';
      stopWorkoutActivity();
      expect(WorkoutActivity.stopActivity).not.toHaveBeenCalled();
    });

    it('should call WorkoutActivity.stopActivity if Platform.OS is not web', () => {
      Platform.OS = 'ios';
      stopWorkoutActivity();
      expect(WorkoutActivity.stopActivity).toHaveBeenCalled();
    });

    it('should catch and log error if WorkoutActivity.stopActivity throws', () => {
      Platform.OS = 'ios';
      const error = new Error('Test error');
      (WorkoutActivity.stopActivity as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });
      stopWorkoutActivity();
      expect(console.error).toHaveBeenCalledWith('Failed to stop workout activity:', error);
    });
  });
});
