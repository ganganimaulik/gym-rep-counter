import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
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

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
}))

jest.mock('@react-native-picker/picker', () => {
  const MockPicker = ({ children }: any) => children
  MockPicker.Item = () => null
  return {
    Picker: MockPicker,
  }
})

jest.mock('@react-native-community/datetimepicker', () => () => null)

const mockTDEEData = {
  weeks: [],
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

describe('TDEEScreen', () => {
  let mockDataHook: any

  beforeEach(() => {
    jest.clearAllMocks()
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

  it('renders pre-filled TDEE card values and logs', async () => {
    const { getByText, getAllByText } = render(
      <TDEEScreen user={mockUser} dataHook={mockDataHook} />,
    )

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
    const { getByTestId } = render(
      <TDEEScreen user={mockUser} dataHook={mockDataHook} />,
    )

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
})
