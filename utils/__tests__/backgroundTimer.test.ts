import {
  bgSetTimeout,
  bgClearTimeout,
  enableBackgroundExecution,
  disableBackgroundExecution,
} from '../backgroundTimer'

// Mock expo-background-timer
jest.mock('expo-background-timer', () => ({
  bgSetTimeout: jest.fn(),
  bgClearTimeout: jest.fn(),
  enableBackgroundExecution: jest.fn(),
  disableBackgroundExecution: jest.fn(),
}))

describe('backgroundTimer (native)', () => {
  it('correctly re-exports native functions from expo-background-timer', () => {
    const expoTimer = require('expo-background-timer')

    bgSetTimeout(() => {}, 1000)
    expect(expoTimer.bgSetTimeout).toHaveBeenCalled()

    bgClearTimeout(123)
    expect(expoTimer.bgClearTimeout).toHaveBeenCalledWith(123)

    enableBackgroundExecution()
    expect(expoTimer.enableBackgroundExecution).toHaveBeenCalled()

    disableBackgroundExecution()
    expect(expoTimer.disableBackgroundExecution).toHaveBeenCalled()
  })
})
