import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import TDEEScreen from '../TDEEScreen'

// Mock dependencies
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: () => () => null,
    },
  )
})

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}))

// Renders a probe node so tests can inspect the data handed to the chart.
jest.mock('react-native-chart-kit', () => {
  const ReactLib = require('react')
  const { View } = require('react-native')
  return {
    LineChart: (props: any) =>
      ReactLib.createElement(View, {
        testID: 'line-chart',
        chartData: props.data,
      }),
  }
})

jest.mock('@react-native-picker/picker', () => {
  const MockPicker = ({ children }: any) => children
  MockPicker.Item = () => null
  return {
    Picker: MockPicker,
  }
})

jest.mock('@react-native-community/datetimepicker', () => () => null)

const baseTDEEData = {
  weeks: [] as any[],
  currentWeight: 75.5,
  totalWeightChange: -1.2,
  weeksWithData: 4,
  hasEnoughData: true,
  goalCalories: 2175,
  dailyDeficit: -500,
  weeksToGoal: 8,
  goalDate: new Date('2026-09-07T00:00:00'),
  displayTDEE: 2675,
}

let mockTDEEData: any = { ...baseTDEEData }

jest.mock('../../hooks/useTDEE', () => ({
  useTDEE: () => mockTDEEData,
}))

const mockUser = {
  uid: 'test-user',
  email: 'test@user.com',
} as any

const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
})

// Log timestamps are built relative to "now" so timeframe filtering (which
// compares against the current date) behaves the same on any run date.
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d
}

const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

describe('TDEEScreen', () => {
  let mockDataHook: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockTDEEData = { ...baseTDEEData }
    mockDataHook = {
      weightLogs: [
        {
          id: 'w1',
          weight: 75.5,
          date: createMockTimestamp(new Date('2026-07-13T10:00:00')),
        },
      ],
      calorieLogs: [
        {
          id: 'c1',
          calories: 2500,
          date: createMockTimestamp(new Date('2026-07-13T10:00:00')),
        },
      ],
      tdeeConfig: {
        weightUnit: 'kg',
        energyUnit: 'cal',
        goalWeight: 70,
        goalWeeklyRate: 0.5,
      },
      saveTDEEConfig: jest.fn().mockResolvedValue(undefined),
      loadTDEEConfig: jest.fn().mockResolvedValue(undefined),
    }
  })

  const renderScreen = (props: Record<string, unknown> = {}) =>
    render(<TDEEScreen user={mockUser} dataHook={mockDataHook} {...props} />)

  it('renders pre-filled TDEE card values and logs', async () => {
    const { getByText, getAllByText } = renderScreen()

    await waitFor(() => {
      // displayTDEE: 2675 -> "2,675"
      expect(getByText(/2,675/)).toBeTruthy()
      // goalCalories: 2175 -> "2,175"
      expect(getByText(/2,175/)).toBeTruthy()
      // currentWeight: 75.5 -> "75.5" (appears on card and logs)
      expect(getAllByText(/75\.5/).length).toBeGreaterThan(0)
      // totalWeightChange: -1.2 -> "-1.2"
      expect(getByText(/-1\.2/)).toBeTruthy()
    })
  })

  it('updates goal weight and rate and calls saveTDEEConfig', async () => {
    const { getByTestId } = renderScreen()

    const goalWeightInput = getByTestId('goal-weight-input')
    const goalRateInput = getByTestId('goal-rate-input')
    const updateGoalButton = getByTestId('update-goal-button')

    fireEvent.changeText(goalWeightInput, '68')
    fireEvent.changeText(goalRateInput, '0.4')
    fireEvent.press(updateGoalButton)

    await waitFor(() => {
      expect(mockDataHook.saveTDEEConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          goalWeight: 68,
          goalWeeklyRate: 0.4,
        }),
        mockUser,
      )
    })
  })

  it('loads the saved config on mount', () => {
    renderScreen()

    expect(mockDataHook.loadTDEEConfig).toHaveBeenCalledWith(mockUser)
  })

  describe('setup flow', () => {
    beforeEach(() => {
      mockDataHook.tdeeConfig = null
    })

    it('shows the setup card and hides the dashboard until configured', () => {
      const { getByText, queryByText, queryByTestId } = renderScreen()

      expect(getByText('Setup TDEE Tracker')).toBeTruthy()
      expect(getByText('Start Tracking')).toBeTruthy()
      expect(queryByText('Weight Management Goal')).toBeNull()
      expect(queryByTestId('goal-weight-input')).toBeNull()
      expect(queryByTestId('preferences-expand-button')).toBeNull()
    })

    it('saves a default kg/cal config with a 12-week smoothing window', async () => {
      const { getByText } = renderScreen()

      fireEvent.press(getByText('Start Tracking'))

      await waitFor(() => {
        expect(mockDataHook.saveTDEEConfig).toHaveBeenCalledWith(
          {
            weightUnit: 'kg',
            energyUnit: 'cal',
            smoothingWindowWeeks: 12,
          },
          mockUser,
        )
      })
    })
  })

  describe('goal validation', () => {
    it('rejects a non-numeric goal weight', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.changeText(getByTestId('goal-weight-input'), 'abc')
      fireEvent.press(getByTestId('update-goal-button'))

      expect(alertSpy).toHaveBeenCalledWith(
        'Invalid Goal Weight',
        expect.any(String),
      )
      expect(mockDataHook.saveTDEEConfig).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it('rejects a zero goal weight', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.changeText(getByTestId('goal-weight-input'), '0')
      fireEvent.press(getByTestId('update-goal-button'))

      expect(alertSpy).toHaveBeenCalledWith(
        'Invalid Goal Weight',
        expect.any(String),
      )
      expect(mockDataHook.saveTDEEConfig).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it('rejects an invalid weekly rate', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.changeText(getByTestId('goal-rate-input'), '-1')
      fireEvent.press(getByTestId('update-goal-button'))

      expect(alertSpy).toHaveBeenCalledWith('Invalid Rate', expect.any(String))
      expect(mockDataHook.saveTDEEConfig).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it('clears both goals to null when the inputs are blanked', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.changeText(getByTestId('goal-weight-input'), '   ')
      fireEvent.changeText(getByTestId('goal-rate-input'), '')
      fireEvent.press(getByTestId('update-goal-button'))

      await waitFor(() => {
        expect(mockDataHook.saveTDEEConfig).toHaveBeenCalledWith(
          expect.objectContaining({ goalWeight: null, goalWeeklyRate: null }),
          mockUser,
        )
      })
      alertSpy.mockRestore()
    })

    it('confirms a successful save', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('update-goal-button'))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Saved', expect.any(String))
      })
      alertSpy.mockRestore()
    })

    it('preserves the existing smoothing window when saving goals', async () => {
      mockDataHook.tdeeConfig.smoothingWindowWeeks = 10
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('update-goal-button'))

      await waitFor(() => {
        expect(mockDataHook.saveTDEEConfig).toHaveBeenCalledWith(
          expect.objectContaining({ smoothingWindowWeeks: 10 }),
          mockUser,
        )
      })
      alertSpy.mockRestore()
    })
  })

  describe('projections', () => {
    it('renders a deficit with a single minus sign', () => {
      mockTDEEData.dailyDeficit = -500
      const { getByText } = renderScreen()

      expect(getByText('-500 Cal')).toBeTruthy()
    })

    it('renders a surplus with a plus sign when the goal is to gain', () => {
      mockDataHook.tdeeConfig.goalWeight = 80
      mockTDEEData.dailyDeficit = 300
      const { getByText } = renderScreen()

      expect(getByText('+300 Cal')).toBeTruthy()
    })

    it('renders an em-dash when there is no deficit figure', () => {
      mockTDEEData.dailyDeficit = null
      const { getByText } = renderScreen()

      expect(getByText('—')).toBeTruthy()
    })

    it('renders weeks-to-goal rounded up and the estimated date', () => {
      mockTDEEData.weeksToGoal = 7.2
      const { getByText } = renderScreen()

      expect(getByText('8 Weeks')).toBeTruthy()
      expect(
        getByText(
          baseTDEEData.goalDate.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        ),
      ).toBeTruthy()
    })

    it('omits the projection rows that have no value', () => {
      mockTDEEData.weeksToGoal = null
      mockTDEEData.goalDate = null
      const { queryByText } = renderScreen()

      expect(queryByText('Weeks to Goal')).toBeNull()
      expect(queryByText('Estimated Date')).toBeNull()
    })

    it('prompts for goal inputs when no target calories can be computed', () => {
      mockTDEEData.goalCalories = null
      const { queryByText, getByText } = renderScreen()

      expect(queryByText('Calculated Targets & Projections')).toBeNull()
      expect(getByText(/Provide a Goal Weight and Weekly Rate/)).toBeTruthy()
    })

    it('warns while there is not yet enough data', () => {
      mockTDEEData.hasEnoughData = false
      const { getByText } = renderScreen()

      expect(getByText(/Need at least 2 weeks of data/)).toBeTruthy()
    })

    it('drops the warning once there is enough data', () => {
      mockTDEEData.hasEnoughData = true
      const { queryByText } = renderScreen()

      expect(queryByText(/Need at least 2 weeks of data/)).toBeNull()
    })
  })

  describe('units', () => {
    it('labels weight and energy in kg/Cal by default', () => {
      const { getByText } = renderScreen()

      expect(getByText('Δ Weight (kg)')).toBeTruthy()
      expect(getByText('Goal Weight (kg)')).toBeTruthy()
      expect(getByText('Weekly Rate (kg/wk)')).toBeTruthy()
    })

    it('switches labels to lb and kJ from the saved config', () => {
      mockDataHook.tdeeConfig.weightUnit = 'lb'
      mockDataHook.tdeeConfig.energyUnit = 'kj'
      const { getByText } = renderScreen()

      expect(getByText('Δ Weight (lb)')).toBeTruthy()
      expect(getByText('Weekly Rate (lb/wk)')).toBeTruthy()
      expect(getByText(/Smoothed TDEE over time \(kJ\/day\)/)).toBeTruthy()
    })
  })

  describe('log action', () => {
    it('invokes the log callback', () => {
      const onLogPress = jest.fn()
      const { getByText } = renderScreen({ onLogPress })

      fireEvent.press(getByText('Log Weight / Calories'))

      expect(onLogPress).toHaveBeenCalled()
    })
  })

  describe('chart tabs', () => {
    it('starts on the TDEE tab offering weekly timeframes', () => {
      const { getByTestId, queryByTestId, getByText } = renderScreen()

      expect(getByText(/Smoothed TDEE over time/)).toBeTruthy()
      expect(getByTestId('timeframe-12w')).toBeTruthy()
      expect(queryByTestId('timeframe-7d')).toBeNull()
    })

    it('switches to the weight tab and its daily timeframes', () => {
      const { getByTestId, queryByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-weight'))

      expect(getByText(/Body weight over time/)).toBeTruthy()
      expect(getByTestId('timeframe-7d')).toBeTruthy()
      expect(queryByTestId('timeframe-12w')).toBeNull()
    })

    it('switches to the calories tab', () => {
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-calories'))

      expect(getByText(/Daily caloric intake/)).toBeTruthy()
      expect(getByTestId('timeframe-7d')).toBeTruthy()
    })

    it('switches back to the TDEE tab', () => {
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-weight'))
      fireEvent.press(getByTestId('chart-tab-tdee'))

      expect(getByText(/Smoothed TDEE over time/)).toBeTruthy()
      expect(getByTestId('timeframe-4w')).toBeTruthy()
    })

    it('shows a placeholder while fewer than two TDEE weeks are in range', () => {
      const { getByText, queryByTestId } = renderScreen()

      expect(queryByTestId('line-chart')).toBeNull()
      expect(
        getByText(/Need at least 2 weeks of calculation data/),
      ).toBeTruthy()
    })

    it('charts the TDEE trend once two weeks are in range', () => {
      mockTDEEData.weeks = [
        { weekStart: daysAgo(14), weekEnd: daysAgo(8), displayTDEE: 2650 },
        { weekStart: daysAgo(7), weekEnd: daysAgo(1), displayTDEE: 2700 },
      ]
      const { getByTestId } = renderScreen()

      const chart = getByTestId('line-chart').props.chartData
      expect(chart.datasets[0].data).toEqual([2650, 2700])
      expect(chart.labels).toHaveLength(2)
    })

    it('excludes weeks outside the selected weekly timeframe', () => {
      mockTDEEData.weeks = [
        { weekStart: daysAgo(200), weekEnd: daysAgo(194), displayTDEE: 2400 },
        { weekStart: daysAgo(14), weekEnd: daysAgo(8), displayTDEE: 2650 },
        { weekStart: daysAgo(7), weekEnd: daysAgo(1), displayTDEE: 2700 },
      ]
      const { getByTestId } = renderScreen()

      // Default weekly timeframe is 84 days, so the 200-day-old week is dropped.
      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([2650, 2700])

      fireEvent.press(getByTestId('timeframe-all-weekly'))

      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([2400, 2650, 2700])
    })

    it('ignores weeks that have no computed TDEE', () => {
      mockTDEEData.weeks = [
        { weekStart: daysAgo(21), weekEnd: daysAgo(15), displayTDEE: null },
        { weekStart: daysAgo(14), weekEnd: daysAgo(8), displayTDEE: 2650 },
        { weekStart: daysAgo(7), weekEnd: daysAgo(1), displayTDEE: 2700 },
      ]
      const { getByTestId } = renderScreen()

      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([2650, 2700])
    })

    it('charts weight entries inside the default 7-day window', () => {
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 76.0, date: createMockTimestamp(daysAgo(1)) },
        { id: 'w2', weight: 75.5, date: createMockTimestamp(daysAgo(3)) },
      ]
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-weight'))

      // The list is reversed for charting, so it reads oldest -> newest.
      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([75.5, 76.0])
    })

    it('brings older weight entries in when the timeframe widens', () => {
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 76.0, date: createMockTimestamp(daysAgo(1)) },
        { id: 'w2', weight: 77.0, date: createMockTimestamp(daysAgo(45)) },
      ]
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-weight'))
      expect(getByText(/Need at least 2 entries/)).toBeTruthy()

      fireEvent.press(getByTestId('timeframe-90d'))

      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([77.0, 76.0])
    })

    it('keeps every entry when the timeframe is set to All', () => {
      mockDataHook.calorieLogs = [
        { id: 'c1', calories: 2500, date: createMockTimestamp(daysAgo(2)) },
        { id: 'c2', calories: 2400, date: createMockTimestamp(daysAgo(400)) },
      ]
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-calories'))
      fireEvent.press(getByTestId('timeframe-all'))

      expect(
        getByTestId('line-chart').props.chartData.datasets[0].data,
      ).toEqual([2400, 2500])
    })

    it('blanks intermediate labels when there are more than six points', () => {
      mockDataHook.weightLogs = Array.from({ length: 10 }, (_, i) => ({
        id: `w${i}`,
        weight: 75 + i * 0.1,
        date: createMockTimestamp(daysAgo(i + 1)),
      }))
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('chart-tab-weight'))
      fireEvent.press(getByTestId('timeframe-30d'))

      const labels = getByTestId('line-chart').props.chartData.labels
      expect(labels).toHaveLength(10)
      expect(labels[0]).not.toBe('')
      expect(labels[labels.length - 1]).not.toBe('')
      expect(labels.filter((l: string) => l === '').length).toBeGreaterThan(0)
    })
  })

  describe('daily history', () => {
    it('groups a weight log and a calorie log from the same day into one row', () => {
      const day = daysAgo(1)
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 76.2, date: createMockTimestamp(day) },
      ]
      mockDataHook.calorieLogs = [
        { id: 'c1', calories: 2450, date: createMockTimestamp(day) },
      ]
      const { getByText } = renderScreen()

      expect(getByText('76.2 kg')).toBeTruthy()
      expect(getByText('2450 Cal')).toBeTruthy()
    })

    it('orders rows newest first', () => {
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 70.1, date: createMockTimestamp(daysAgo(5)) },
        { id: 'w2', weight: 70.2, date: createMockTimestamp(daysAgo(1)) },
      ]
      mockDataHook.calorieLogs = []
      const { getAllByText } = renderScreen()

      const weights = getAllByText(/^70\.\d kg$/).map(
        (n) => n.props.children.join?.('') ?? n.props.children,
      )
      expect(weights[0]).toContain('70.2')
      expect(weights[1]).toContain('70.1')
    })

    it('passes the pressed day group to the edit callback', () => {
      const onEditLogPress = jest.fn()
      const day = daysAgo(2)
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 74.4, date: createMockTimestamp(day) },
      ]
      mockDataHook.calorieLogs = []
      const { getByText } = renderScreen({ onEditLogPress })

      fireEvent.press(getByText('74.4 kg'))

      expect(onEditLogPress).toHaveBeenCalledWith(
        expect.objectContaining({
          date: day,
          weightLog: expect.objectContaining({ id: 'w1' }),
        }),
      )
    })

    it('does not throw when no edit callback is supplied', () => {
      mockDataHook.weightLogs = [
        { id: 'w1', weight: 74.4, date: createMockTimestamp(daysAgo(2)) },
      ]
      mockDataHook.calorieLogs = []
      const { getByText } = renderScreen()

      expect(() => fireEvent.press(getByText('74.4 kg'))).not.toThrow()
    })

    it('shows an empty state when nothing has been logged', () => {
      mockDataHook.weightLogs = []
      mockDataHook.calorieLogs = []
      const { getByText } = renderScreen()

      expect(getByText(/No daily stats logged yet/)).toBeTruthy()
    })

    it('caps the list at 15 days', () => {
      mockDataHook.weightLogs = Array.from({ length: 20 }, (_, i) => ({
        id: `w${i}`,
        weight: 70 + i,
        date: createMockTimestamp(daysAgo(i + 1)),
      }))
      mockDataHook.calorieLogs = []
      const { getAllByText } = renderScreen()

      expect(getAllByText(/ kg$/)).toHaveLength(15)
    })
  })

  describe('weekly history', () => {
    const weeks = [
      {
        weekStart: new Date('2026-06-29T00:00:00'),
        weekEnd: new Date('2026-07-05T00:00:00'),
        avgWeight: 76.6,
        avgCalories: null,
        weightDelta: 0.3,
        displayTDEE: null,
      },
      {
        weekStart: new Date('2026-07-06T00:00:00'),
        weekEnd: new Date('2026-07-12T00:00:00'),
        avgWeight: 76.24,
        avgCalories: 2600,
        weightDelta: -0.4,
        displayTDEE: 2700,
      },
    ]

    it('renders averages, deltas and TDEE newest first', () => {
      mockTDEEData.weeks = weeks
      const { getByTestId, getByText, getAllByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(getByText('76.2')).toBeTruthy() // avgWeight, 1dp
      expect(getByText('2,600')).toBeTruthy() // avgCalories, grouped
      expect(getByText('-0.4')).toBeTruthy() // negative delta
      expect(getByText('+0.3')).toBeTruthy() // positive delta gets a sign
      expect(getByText('2,700')).toBeTruthy() // displayTDEE
      // The older week is missing calories and TDEE.
      expect(getAllByText('—')).toHaveLength(2)
    })

    it('labels each row with its week range', () => {
      mockTDEEData.weeks = weeks
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(
        getByText(
          `${shortDate(weeks[1].weekStart)} – ${shortDate(weeks[1].weekEnd)}`,
        ),
      ).toBeTruthy()
    })

    it('renders a zero delta without a sign', () => {
      mockTDEEData.weeks = [{ ...weeks[1], weightDelta: 0 }]
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(getByText('0.0')).toBeTruthy()
    })

    it('skips weeks with neither weight nor calorie averages', () => {
      mockTDEEData.weeks = [
        {
          weekStart: new Date('2026-06-22T00:00:00'),
          weekEnd: new Date('2026-06-28T00:00:00'),
          avgWeight: null,
          avgCalories: null,
          weightDelta: null,
          displayTDEE: null,
        },
        weeks[1],
      ]
      const { getByTestId, queryByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(
        queryByText(
          `${shortDate(new Date('2026-06-22T00:00:00'))} – ${shortDate(
            new Date('2026-06-28T00:00:00'),
          )}`,
        ),
      ).toBeNull()
    })

    it('caps the breakdown at 20 weeks', () => {
      mockTDEEData.weeks = Array.from({ length: 25 }, (_, i) => ({
        weekStart: new Date(2026, 0, 5 + i * 7),
        weekEnd: new Date(2026, 0, 11 + i * 7),
        avgWeight: 80 - i,
        avgCalories: 2500,
        weightDelta: -0.5,
        displayTDEE: 2600,
      }))
      const { getByTestId, getAllByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(getAllByText('-0.5')).toHaveLength(20)
    })

    it('shows an empty state with no weekly data', () => {
      mockTDEEData.weeks = []
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))

      expect(getByText(/No weekly average data calculated yet/)).toBeTruthy()
    })

    it('returns to the daily tab', () => {
      mockDataHook.weightLogs = []
      mockDataHook.calorieLogs = []
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('weekly-average-tab'))
      fireEvent.press(getByTestId('daily-logs-tab'))

      expect(getByText(/No daily stats logged yet/)).toBeTruthy()
    })
  })

  describe('preferences', () => {
    it('stays collapsed until pressed', () => {
      const { queryByTestId, queryByText } = renderScreen()

      expect(queryByTestId('save-preferences-button')).toBeNull()
      expect(queryByText('Weight Unit')).toBeNull()
    })

    it('expands to reveal the unit pickers', () => {
      const { getByTestId, getByText } = renderScreen()

      fireEvent.press(getByTestId('preferences-expand-button'))

      expect(getByText('Weight Unit')).toBeTruthy()
      expect(getByText('Energy Unit')).toBeTruthy()
      expect(getByTestId('save-preferences-button')).toBeTruthy()
    })

    it('collapses again on a second press', () => {
      const { getByTestId, queryByTestId } = renderScreen()

      fireEvent.press(getByTestId('preferences-expand-button'))
      fireEvent.press(getByTestId('preferences-expand-button'))

      expect(queryByTestId('save-preferences-button')).toBeNull()
    })

    it('saves through the same handler as the goal card', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId('preferences-expand-button'))
      fireEvent.press(getByTestId('save-preferences-button'))

      await waitFor(() => {
        expect(mockDataHook.saveTDEEConfig).toHaveBeenCalledWith(
          expect.objectContaining({ weightUnit: 'kg', energyUnit: 'cal' }),
          mockUser,
        )
      })
      alertSpy.mockRestore()
    })
  })
})
