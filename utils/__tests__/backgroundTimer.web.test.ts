import {
  bgSetTimeout,
  bgClearTimeout,
  enableBackgroundExecution,
  disableBackgroundExecution,
} from '../backgroundTimer.web'

describe('backgroundTimer (web)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('correctly behaves like setTimeout on web', () => {
    const callback = jest.fn()
    const id = bgSetTimeout(callback, 1000)

    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalled()

    bgClearTimeout(id)
  })

  it('correctly behaves like clearTimeout on web', () => {
    const callback = jest.fn()
    const id = bgSetTimeout(callback, 1000)

    bgClearTimeout(id)

    jest.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not throw on enable/disable background execution', () => {
    expect(() => enableBackgroundExecution()).not.toThrow()
    expect(() => disableBackgroundExecution()).not.toThrow()
  })
})
