import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ProgressScreen from '../ProgressScreen'

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

const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
})

const mockAnalytics = {
  isLoading: false,
  error: null,
  prs: [
    {
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      repsAtMax: 10,
      maxWeight: 80,
      date: createMockTimestamp(new Date('2026-07-13T10:00:00')),
    },
  ],
  streak: 5,
  weeklyVolume: [
    { label: 'Week 1', value: 10000 },
    { label: 'Week 2', value: 12000 },
  ],
  exercises: ['Bench Press', 'Squat'],
  getExerciseTrends: jest.fn(() => ({
    labels: ['Week 1', 'Week 2'],
    data: [75, 80],
  })),
  refreshAnalytics: jest.fn(),
}

jest.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: () => mockAnalytics,
}))

const mockUser = {
  uid: 'test-user',
  email: 'test@user.com',
} as any

describe('ProgressScreen', () => {
  let mockDataHook: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockDataHook = {
      // Seed logs as yesterday so today is empty (triggers addWeightLog instead of updateWeightLog)
      weightLogs: [
        {
          id: 'w1',
          weight: 75.5,
          date: createMockTimestamp(new Date('2026-07-12T10:00:00')),
        },
      ],
      addWeightLog: jest.fn().mockResolvedValue(undefined),
      updateWeightLog: jest.fn().mockResolvedValue(undefined),
      deleteWeightLog: jest.fn().mockResolvedValue(undefined),
      calorieLogs: [
        {
          id: 'c1',
          calories: 2500,
          date: createMockTimestamp(new Date('2026-07-12T10:00:00')),
        },
      ],
      addCalorieLog: jest.fn().mockResolvedValue(undefined),
      updateCalorieLog: jest.fn().mockResolvedValue(undefined),
      deleteCalorieLog: jest.fn().mockResolvedValue(undefined),
      fetchWeightLogs: jest.fn(),
      fetchCalorieLogs: jest.fn(),
      loadTDEEConfig: jest.fn(),
    }
  })

  it('renders progress screen in Health (default) mode and lists logs', async () => {
    const { getByText } = render(
      <ProgressScreen
        visible={true}
        onClose={jest.fn()}
        user={mockUser}
        dataHook={mockDataHook}
      />,
    )

    await waitFor(() => {
      expect(getByText(/75\.5/)).toBeTruthy()
      expect(getByText(/2500/)).toBeTruthy()
    })
  })

  it('switches to Workouts sub-tab and renders PRs', async () => {
    const { getByText } = render(
      <ProgressScreen
        visible={true}
        onClose={jest.fn()}
        user={mockUser}
        dataHook={mockDataHook}
      />,
    )

    // Click "Workout Trends" tab
    fireEvent.press(getByText('Workout Trends'))

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy()
      expect(getByText(/80/)).toBeTruthy()
      expect(getByText(/10/)).toBeTruthy()
      expect(getByText('Weekly Volume')).toBeTruthy()
    })
  })

  it('opens and saves logs via add log modal', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ProgressScreen
        visible={true}
        onClose={jest.fn()}
        user={mockUser}
        dataHook={mockDataHook}
      />,
    )

    // Press "Log Weight / Calories" button
    fireEvent.press(getByText('Log Weight / Calories'))

    // The modal should open with fields for weight and calories
    const weightInput = getByPlaceholderText('e.g. 75.5')
    const calorieInput = getByPlaceholderText('e.g. 2500')

    fireEvent.changeText(weightInput, '77.2')
    fireEvent.changeText(calorieInput, '2650')

    // Press save button in modal
    fireEvent.press(getByTestId('save-health-button'))

    await waitFor(() => {
      expect(mockDataHook.addWeightLog).toHaveBeenCalledWith(
        77.2,
        expect.any(Date),
        mockUser,
      )
      expect(mockDataHook.addCalorieLog).toHaveBeenCalledWith(
        2650,
        expect.any(Date),
        mockUser,
      )
    })
  })
})
