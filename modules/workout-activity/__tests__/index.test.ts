import { Platform } from 'react-native'

// Unmock the module we are trying to test since it's mocked in jest.setup.js
jest.unmock('../index')

// Mock requireNativeModule
jest.mock('expo-modules-core', () => {
  return {
    requireNativeModule: jest.fn(),
  }
})

describe('WorkoutActivityModule', () => {
  let startActivitySpy: jest.Mock
  let updateActivitySpy: jest.Mock
  let stopActivitySpy: jest.Mock
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    startActivitySpy = jest.fn()
    updateActivitySpy = jest.fn()
    stopActivitySpy = jest.fn()

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should call startActivity on native module when available', () => {
    // Setup mock for requireNativeModule to return our mock native module
    const { requireNativeModule } = require('expo-modules-core')
    requireNativeModule.mockReturnValue({
      startActivity: startActivitySpy,
      updateActivity: updateActivitySpy,
      stopActivity: stopActivitySpy,
    })

    const { startActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    startActivity(mockState)

    expect(startActivitySpy).toHaveBeenCalledWith(mockState)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should warn when startActivity is called and native module is unavailable', () => {
    // Setup mock to return null or throw to simulate unavailable module
    const { requireNativeModule } = require('expo-modules-core')
    requireNativeModule.mockImplementation(() => {
      throw new Error('Module not found')
    })

    const { startActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    startActivity(mockState)

    expect(consoleWarnSpy).toHaveBeenCalledWith('WorkoutActivityModule is not available')
  })

  it('should log error when startActivity throws an exception', () => {
    // Setup mock native module that throws on startActivity
    const { requireNativeModule } = require('expo-modules-core')
    const testError = new Error('Native call failed')
    requireNativeModule.mockReturnValue({
      startActivity: jest.fn().mockImplementation(() => {
        throw testError
      }),
    })

    const { startActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    startActivity(mockState)

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to call startActivity:', testError)
  })

  it('should call updateActivity on native module when available', () => {
    const { requireNativeModule } = require('expo-modules-core')
    const mockReturnValue = 'update_success'
    updateActivitySpy.mockReturnValue(mockReturnValue)
    requireNativeModule.mockReturnValue({
      startActivity: startActivitySpy,
      updateActivity: updateActivitySpy,
      stopActivity: stopActivitySpy,
    })

    const { updateActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    const result = updateActivity(mockState)

    expect(updateActivitySpy).toHaveBeenCalledWith(mockState)
    expect(result).toBe(mockReturnValue)
  })

  it('should warn when updateActivity is called and native module is unavailable', () => {
    const { requireNativeModule } = require('expo-modules-core')
    requireNativeModule.mockImplementation(() => {
      throw new Error('Module not found')
    })

    const { updateActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    const result = updateActivity(mockState)

    expect(consoleWarnSpy).toHaveBeenCalledWith('WorkoutActivityModule is not available')
    expect(result).toBeUndefined()
  })

  it('should log error when updateActivity throws an exception', () => {
    const { requireNativeModule } = require('expo-modules-core')
    const testError = new Error('Native call failed')
    requireNativeModule.mockReturnValue({
      updateActivity: jest.fn().mockImplementation(() => {
        throw testError
      }),
    })

    const { updateActivity } = require('../index')

    const mockState = {
      exerciseName: 'Squat',
      nextExerciseName: 'Bench Press',
      currentSet: 1,
      totalSets: 3,
      reps: 10,
      phase: 'active',
      isResting: false,
      restSeconds: 0,
      restStartTimestamp: 0,
    }

    const result = updateActivity(mockState)

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to call updateActivity:', testError)
    expect(result).toBeUndefined()
  })

  it('should call stopActivity on native module when available', () => {
    const { requireNativeModule } = require('expo-modules-core')
    requireNativeModule.mockReturnValue({
      startActivity: startActivitySpy,
      updateActivity: updateActivitySpy,
      stopActivity: stopActivitySpy,
    })

    const { stopActivity } = require('../index')

    stopActivity()

    expect(stopActivitySpy).toHaveBeenCalled()
  })

  it('should warn when stopActivity is called and native module is unavailable', () => {
    const { requireNativeModule } = require('expo-modules-core')
    requireNativeModule.mockImplementation(() => {
      throw new Error('Module not found')
    })

    const { stopActivity } = require('../index')

    stopActivity()

    expect(consoleWarnSpy).toHaveBeenCalledWith('WorkoutActivityModule is not available')
  })

  it('should log error when stopActivity throws an exception', () => {
    const { requireNativeModule } = require('expo-modules-core')
    const testError = new Error('Native call failed')
    requireNativeModule.mockReturnValue({
      stopActivity: jest.fn().mockImplementation(() => {
        throw testError
      }),
    })

    const { stopActivity } = require('../index')

    stopActivity()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to call stopActivity:', testError)
  })

  it('should not call requireNativeModule when environment is web', () => {
    // Reset module resolution for this specific test first
    jest.resetModules()

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }))

    // Import again after web mock
    require('../index')

    const { requireNativeModule } = require('expo-modules-core')

    // We expect it NOT to call requireNativeModule for web
    expect(requireNativeModule).not.toHaveBeenCalled()
  })
})
