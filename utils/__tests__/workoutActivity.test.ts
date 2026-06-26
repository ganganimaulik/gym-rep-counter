import { Platform } from 'react-native'
import * as WorkoutActivity from '../../modules/workout-activity'
import {
  startWorkoutActivity,
  updateWorkoutActivity,
  stopWorkoutActivity,
} from '../workoutActivity'

jest.mock('../../modules/workout-activity', () => ({
  startActivity: jest.fn(),
  updateActivity: jest.fn(),
  stopActivity: jest.fn(),
}))

describe('workoutActivity', () => {
  let originalOS: string
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    originalOS = Platform.OS
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    Platform.OS = originalOS as any
    consoleErrorSpy.mockRestore()
  })

  const dummyState: any = {
    exerciseName: 'Squat',
    nextExerciseName: '',
    currentSet: 1,
    totalSets: 3,
    reps: 10,
    phase: 'rest',
    isResting: true,
    restSeconds: 60,
    restStartTimestamp: 1234567890,
  }

  describe('startWorkoutActivity', () => {
    it('calls native module on non-web', () => {
      Platform.OS = 'ios'
      startWorkoutActivity(dummyState)
      expect(WorkoutActivity.startActivity).toHaveBeenCalledWith(dummyState)
    })

    it('no-ops on web', () => {
      Platform.OS = 'web'
      startWorkoutActivity(dummyState)
      expect(WorkoutActivity.startActivity).not.toHaveBeenCalled()
    })

    it('catches and logs error when native module throws', () => {
      Platform.OS = 'ios'
      const error = new Error('Test error')
      ;(WorkoutActivity.startActivity as jest.Mock).mockImplementationOnce(
        () => {
          throw error
        },
      )
      startWorkoutActivity(dummyState)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start workout activity:',
        error,
      )
    })
  })

  describe('updateWorkoutActivity', () => {
    it('calls native module on non-web', () => {
      Platform.OS = 'ios'
      updateWorkoutActivity(dummyState)
      expect(WorkoutActivity.updateActivity).toHaveBeenCalledWith(dummyState)
    })

    it('no-ops on web', () => {
      Platform.OS = 'web'
      updateWorkoutActivity(dummyState)
      expect(WorkoutActivity.updateActivity).not.toHaveBeenCalled()
    })

    it('catches and logs error when native module throws', () => {
      Platform.OS = 'ios'
      const error = new Error('Test error')
      ;(WorkoutActivity.updateActivity as jest.Mock).mockImplementationOnce(
        () => {
          throw error
        },
      )
      updateWorkoutActivity(dummyState)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update workout activity:',
        error,
      )
    })
  })

  describe('stopWorkoutActivity', () => {
    it('calls native module on non-web', () => {
      Platform.OS = 'ios'
      stopWorkoutActivity()
      expect(WorkoutActivity.stopActivity).toHaveBeenCalled()
    })

    it('no-ops on web', () => {
      Platform.OS = 'web'
      stopWorkoutActivity()
      expect(WorkoutActivity.stopActivity).not.toHaveBeenCalled()
    })

    it('catches and logs error when native module throws', () => {
      Platform.OS = 'ios'
      const error = new Error('Test error')
      ;(WorkoutActivity.stopActivity as jest.Mock).mockImplementationOnce(
        () => {
          throw error
        },
      )
      stopWorkoutActivity()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to stop workout activity:',
        error,
      )
    })
  })
})
