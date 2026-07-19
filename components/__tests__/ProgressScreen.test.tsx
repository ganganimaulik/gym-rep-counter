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
      weightUnit: 'kg',
      date: createMockTimestamp(new Date('2026-07-13T10:00:00')),
    },
    {
      exerciseId: 'ex2',
      exerciseName: 'Leg Press',
      repsAtMax: 8,
      maxWeight: 12,
      weightUnit: 'plates',
      date: createMockTimestamp(new Date('2026-07-13T10:00:00')),
    },
  ],
  streak: {
    currentStreak: 5,
    longestStreak: 6,
    lastWorkoutDate: new Date('2026-07-13T10:00:00'),
    currentWeekWorkouts: 3,
  },
  weeklyVolume: [
    { label: 'W1', kgVolume: 10000, platesVolume: 300 },
    { label: 'W2', kgVolume: 12000, platesVolume: 350 },
  ],
  exercises: [
    { id: 'ex1', name: 'Bench Press' },
    { id: 'ex2', name: 'Leg Press' },
  ],
  getExerciseTrends: jest.fn(() => [
    {
      weightUnit: 'kg',
      data: [
        {
          date: new Date('2026-07-06T10:00:00'),
          avgWeight: 75,
          avgReps: 10,
          setCount: 3,
        },
        {
          date: new Date('2026-07-13T10:00:00'),
          avgWeight: 80,
          avgReps: 10,
          setCount: 3,
        },
      ],
    },
    {
      weightUnit: 'plates',
      data: [
        {
          date: new Date('2026-07-06T10:00:00'),
          avgWeight: 10,
          avgReps: 8,
          setCount: 2,
        },
        {
          date: new Date('2026-07-13T10:00:00'),
          avgWeight: 12,
          avgReps: 8,
          setCount: 2,
        },
      ],
    },
  ]),
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
      measurementLogs: [],
      addMeasurementLog: jest.fn().mockResolvedValue(undefined),
      updateMeasurementLog: jest.fn().mockResolvedValue(undefined),
      deleteMeasurementLog: jest.fn().mockResolvedValue(undefined),
      fetchWeightLogs: jest.fn(),
      fetchCalorieLogs: jest.fn(),
      fetchMeasurementLogs: jest.fn(),
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

  it('switches to Workouts sub-tab and renders PRs per weight unit', async () => {
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
      // PRs keep their own unit instead of being compared numerically
      expect(getByText('80 kg')).toBeTruthy()
      expect(getByText('× 10 reps')).toBeTruthy()
      expect(getByText('Leg Press')).toBeTruthy()
      expect(getByText('12 plates')).toBeTruthy()
      // Both units present -> group labels shown
      expect(getByText('kg')).toBeTruthy()
      expect(getByText('plates')).toBeTruthy()
      expect(getByText('Weekly Volume')).toBeTruthy()
    })
  })

  it('renders separate weekly volume and trend charts per weight unit', async () => {
    const { getByText } = render(
      <ProgressScreen
        visible={true}
        onClose={jest.fn()}
        user={mockUser}
        dataHook={mockDataHook}
      />,
    )

    fireEvent.press(getByText('Workout Trends'))

    await waitFor(() => {
      expect(getByText('Total weight × reps per week (kg)')).toBeTruthy()
      expect(getByText('Total plates × reps per week (plates)')).toBeTruthy()
      expect(
        getByText('Average weight trend (last 10 sessions, kg)'),
      ).toBeTruthy()
      expect(
        getByText('Average weight trend (last 10 sessions, plates)'),
      ).toBeTruthy()
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
