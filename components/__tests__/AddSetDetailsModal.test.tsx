import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import AddSetDetailsModal from '../AddSetDetailsModal'

// Mock expo-blur
jest.mock('expo-blur', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    BlurView: View,
  }
})

describe('AddSetDetailsModal', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly when visible', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    expect(getByText('Set Complete')).toBeTruthy()
    expect(getByText('Reps')).toBeTruthy()
    expect(getByText('Weight (kg)')).toBeTruthy()
    expect(getByText('Save')).toBeTruthy()
    expect(getByTestId('reps-input').props.value).toBe('10')
  })

  it('calls onClose when onRequestClose is triggered on Modal', () => {
    const { UNSAFE_getByType } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Modal } = require('react-native')
    const modalComponent = UNSAFE_getByType(Modal)

    if (modalComponent.props.onRequestClose) {
      modalComponent.props.onRequestClose()
    }

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onSubmit with correctly parsed values and closes modal', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    const repsInput = getByTestId('reps-input')
    const weightInput = getByTestId('weight-input')
    const saveButton = getByText('Save')

    fireEvent.changeText(repsInput, '12')
    fireEvent.changeText(weightInput, '50')
    fireEvent.press(saveButton)

    expect(mockOnSubmit).toHaveBeenCalledWith(12, 50)
    expect(mockOnClose).toHaveBeenCalled()
    // Weight should be reset for next time, but we might not easily verify this without re-rendering or accessing state.
  })

  it('handles empty weight by defaulting to 0', () => {
    const { getByText } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={8}
      />,
    )

    const saveButton = getByText('Save')

    // Weight is empty by default
    fireEvent.press(saveButton)

    expect(mockOnSubmit).toHaveBeenCalledWith(8, 0)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not call onSubmit if reps is not a valid number', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    const repsInput = getByTestId('reps-input')
    const saveButton = getByText('Save')

    fireEvent.changeText(repsInput, 'invalid')
    fireEvent.press(saveButton)

    expect(mockOnSubmit).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('updates reps state when initialReps prop changes', () => {
    const { getByTestId, rerender } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    expect(getByTestId('reps-input').props.value).toBe('10')

    rerender(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={15}
      />,
    )

    expect(getByTestId('reps-input').props.value).toBe('15')
  })

  it('calls handleSubmit when onSubmitEditing is triggered on weight input', () => {
    const { getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={5}
      />,
    )

    const weightInput = getByTestId('weight-input')
    fireEvent.changeText(weightInput, '20')
    fireEvent(weightInput, 'onSubmitEditing')

    expect(mockOnSubmit).toHaveBeenCalledWith(5, 20)
    expect(mockOnClose).toHaveBeenCalled()
  })
})
