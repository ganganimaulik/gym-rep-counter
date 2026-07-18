import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HistoryScreen from '../HistoryScreen'

// Mock dependencies
jest.mock('lucide-react-native', () => ({
  X: () => null,
  Pencil: () => null,
  Trash2: () => null,
}))

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}))

const mockUser = {
  uid: 'test-user-id',
  email: 'testuser@test.com',
} as any

const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
})

describe('HistoryScreen', () => {
  let mockDataHook: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockDataHook = {
      fetchHistory: jest.fn().mockResolvedValue([]),
      updateHistoryEntry: jest.fn().mockResolvedValue(undefined),
      deleteHistoryEntry: jest.fn().mockResolvedValue(undefined),
      historyVersion: 0,
      workouts: [],
    }
  })

  it('renders no history message when empty', async () => {
    const { getByText } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(
        getByText('No workout history yet. Complete a set to get started!'),
      ).toBeTruthy()
    })
  })

  it('renders entries grouped into day sections and skips invalid items', async () => {
    const date1 = new Date('2026-07-13T10:00:00')
    const date2 = new Date('2026-07-12T15:00:00')

    const mockHistory = [
      {
        id: 'h1',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        reps: 10,
        weight: 60,
        date: createMockTimestamp(date1),
        startTime: createMockTimestamp(new Date(date1.getTime() - 60000)),
      },
      {
        id: 'h2',
        exerciseId: 'ex2',
        exerciseName: 'Squat',
        reps: 8,
        weight: 100,
        date: createMockTimestamp(date2),
        startTime: null, // missing start time
      },
      {
        id: 'h-invalid',
        exerciseId: 'ex3',
        exerciseName: 'Deadlift',
        reps: 5,
        weight: 120,
        date: null, // invalid date
      },
    ]

    mockDataHook.fetchHistory.mockResolvedValueOnce(mockHistory)

    const { getByText, queryByText } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy()
      expect(getByText('Squat')).toBeTruthy()
      expect(queryByText('Deadlift')).toBeNull() // invalid item skipped
    })
  })

  it('computes rest time badge between consecutive sets correctly', async () => {
    const today = new Date('2026-07-13')
    const time1 = new Date(today.getTime() + 10 * 60 * 1000) // 10 mins past
    const time2 = new Date(today.getTime() + 6 * 60 * 1000) // startTime of newest set (6 mins past)
    const time3 = new Date(today.getTime() + 5 * 60 * 1000) // endTime of oldest set (5 mins past)

    const mockHistory = [
      {
        id: 'set-newest',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        reps: 10,
        weight: 60,
        date: createMockTimestamp(time1),
        startTime: createMockTimestamp(time2),
      },
      {
        id: 'set-oldest',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        reps: 10,
        weight: 60,
        date: createMockTimestamp(time3),
        startTime: createMockTimestamp(new Date(today.getTime())),
      },
    ]

    mockDataHook.fetchHistory.mockResolvedValueOnce(mockHistory)

    const { getByText } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      // 6 mins - 5 mins = 1 minute rest -> "1m 0s rest"
      expect(getByText(/1m 0s rest/i)).toBeTruthy()
    })
  })

  it('runs forceRefresh when tab becomes visible and historyVersion changed', async () => {
    const { rerender } = render(
      <HistoryScreen visible={false} user={mockUser} dataHook={mockDataHook} />,
    )

    expect(mockDataHook.fetchHistory).not.toHaveBeenCalled()

    // Become visible
    mockDataHook.historyVersion = 1
    rerender(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(mockDataHook.fetchHistory).toHaveBeenCalled()
    })
  })

  it('modal updates history entry and handles non-numeric reps and fractional weight', async () => {
    const today = new Date('2026-07-13T10:00:00')
    const item = {
      id: 'h1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      reps: 10,
      weight: 60.5,
      date: createMockTimestamp(today),
      startTime: createMockTimestamp(new Date(today.getTime() - 60000)),
    }

    mockDataHook.fetchHistory.mockResolvedValueOnce([item])

    const { getByText, getByTestId } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy()
    })

    // Open edit modal
    fireEvent.press(getByText('Bench Press'))

    // Pre-filled reps and weight
    const repsInput = getByTestId('edit-log-reps')
    const weightInput = getByTestId('edit-log-weight')

    expect(repsInput.props.value).toBe('10')
    expect(weightInput.props.value).toBe('60.5')

    // Edit reps to non-numeric -> should not call update
    fireEvent.changeText(repsInput, 'abc')
    fireEvent.press(getByTestId('edit-log-save-button'))

    expect(mockDataHook.updateHistoryEntry).not.toHaveBeenCalled()

    // Re-open
    fireEvent.press(getByText('Bench Press'))

    // Wait for the modal fields to reset to 10 and 60.5
    await waitFor(() => {
      expect(getByTestId('edit-log-reps').props.value).toBe('10')
      expect(getByTestId('edit-log-weight').props.value).toBe('60.5')
    })

    // Now edit to valid numbers
    fireEvent.changeText(getByTestId('edit-log-reps'), '12')
    fireEvent.changeText(getByTestId('edit-log-weight'), '65.25') // fractional weight preserved
    fireEvent.press(getByTestId('edit-log-save-button'))

    await waitFor(() => {
      expect(mockDataHook.updateHistoryEntry).toHaveBeenCalledWith(
        'h1',
        { reps: 12, weight: 65.25, weightUnit: 'kg', variant: null },
        mockUser,
      )
    })
  })

  it('allows switching the weight unit from the edit modal', async () => {
    const today = new Date('2026-07-13T10:00:00')
    const item = {
      id: 'h1',
      exerciseId: 'ex1',
      exerciseName: 'Calf Raise',
      reps: 15,
      weight: 40,
      weightUnit: 'kg',
      date: createMockTimestamp(today),
      startTime: null,
    }

    mockDataHook.fetchHistory.mockResolvedValueOnce([item])

    const { getByText, getByTestId } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText('Calf Raise')).toBeTruthy()
    })

    fireEvent.press(getByText('Calf Raise'))
    fireEvent.press(getByTestId('edit-log-unit-plates'))
    fireEvent.changeText(getByTestId('edit-log-weight'), '4')
    fireEvent.press(getByTestId('edit-log-save-button'))

    await waitFor(() => {
      expect(mockDataHook.updateHistoryEntry).toHaveBeenCalledWith(
        'h1',
        { reps: 15, weight: 4, weightUnit: 'plates', variant: null },
        mockUser,
      )
    })

    // List reflects the new unit
    expect(getByText('15 reps @ 4 plates')).toBeTruthy()
  })

  it('allows changing and removing the variant from the edit modal', async () => {
    const today = new Date('2026-07-13T10:00:00')
    const item = {
      id: 'h1',
      exerciseId: 'ex1',
      exerciseName: 'Calf Raise',
      reps: 15,
      weight: 40,
      variant: 'Standing',
      date: createMockTimestamp(today),
      startTime: null,
    }

    mockDataHook.workouts = [
      {
        id: 'w1',
        name: 'Day 1',
        exercises: [
          {
            id: 'ex1',
            name: 'Calf Raise',
            sets: 3,
            reps: 15,
            variants: ['Standing', 'Sitting'],
          },
        ],
      },
    ]
    mockDataHook.fetchHistory.mockResolvedValueOnce([item])

    const { getByText, getByTestId } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText(/Calf Raise/)).toBeTruthy()
    })

    // Switch variant to Sitting
    fireEvent.press(getByText(/Calf Raise/))
    fireEvent.press(getByTestId('edit-log-variant-Sitting'))
    fireEvent.press(getByTestId('edit-log-save-button'))

    await waitFor(() => {
      expect(mockDataHook.updateHistoryEntry).toHaveBeenCalledWith(
        'h1',
        { reps: 15, weight: 40, weightUnit: 'kg', variant: 'Sitting' },
        mockUser,
      )
    })

    // Re-open and deselect the variant entirely
    fireEvent.press(getByText(/Calf Raise/))
    fireEvent.press(getByTestId('edit-log-variant-Sitting'))
    fireEvent.press(getByTestId('edit-log-save-button'))

    await waitFor(() => {
      expect(mockDataHook.updateHistoryEntry).toHaveBeenLastCalledWith(
        'h1',
        { reps: 15, weight: 40, weightUnit: 'kg', variant: null },
        mockUser,
      )
    })
  })

  it('offers the entry variant as an option even if removed from the routine', async () => {
    const today = new Date('2026-07-13T10:00:00')
    const item = {
      id: 'h1',
      exerciseId: 'ex-gone',
      exerciseName: 'Old Exercise',
      reps: 10,
      weight: 20,
      variant: 'Standing',
      date: createMockTimestamp(today),
      startTime: null,
    }

    mockDataHook.fetchHistory.mockResolvedValueOnce([item])

    const { getByText, getByTestId } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText(/Old Exercise/)).toBeTruthy()
    })

    fireEvent.press(getByText(/Old Exercise/))
    expect(getByTestId('edit-log-variant-Standing')).toBeTruthy()
  })

  it('deletes history entry and removes it from list', async () => {
    const today = new Date('2026-07-13T10:00:00')
    const item = {
      id: 'h1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      reps: 10,
      weight: 60,
      date: createMockTimestamp(today),
      startTime: createMockTimestamp(new Date(today.getTime() - 60000)),
    }

    mockDataHook.fetchHistory.mockResolvedValueOnce([item])

    const { getByText, queryByText } = render(
      <HistoryScreen visible={true} user={mockUser} dataHook={mockDataHook} />,
    )

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy()
    })

    // Open modal
    fireEvent.press(getByText('Bench Press'))

    // Press Delete
    fireEvent.press(getByText('Delete Entry'))

    await waitFor(() => {
      expect(mockDataHook.deleteHistoryEntry).toHaveBeenCalledWith(
        'h1',
        mockUser,
      )
      expect(queryByText('Bench Press')).toBeNull()
    })
  })
})
