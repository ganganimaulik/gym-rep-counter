import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import AddSetDetailsModal from '../AddSetDetailsModal'

// Mock expo-blur
jest.mock('expo-blur', () => {
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

  it('displays the exercise name when provided', () => {
    const { getByText, queryByTestId, rerender } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
        exerciseName="Bench Press"
      />,
    )

    expect(getByText('Bench Press')).toBeTruthy()

    rerender(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    expect(queryByTestId('set-complete-exercise-name')).toBeNull()
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

    const { Modal } = require('react-native')
    const modalComponent = UNSAFE_getByType(Modal)

    if (modalComponent.props.onRequestClose) {
      modalComponent.props.onRequestClose()
    }

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onSubmit with correctly parsed values and lets the parent close the modal', () => {
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

    expect(mockOnSubmit).toHaveBeenCalledWith(12, 50, 'kg', undefined)
    // The parent hides the modal after saving; the dismiss handler must not
    // fire on save or the set would be logged twice.
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('preserves fractional weight values instead of truncating them', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    const weightInput = getByTestId('weight-input')
    const saveButton = getByText('Save')

    fireEvent.changeText(weightInput, '22.5')
    fireEvent.press(saveButton)

    expect(mockOnSubmit).toHaveBeenCalledWith(10, 22.5, 'kg', undefined)
  })

  it('uses a decimal keyboard so fractional weights can be entered', () => {
    const { getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    expect(getByTestId('weight-input').props.keyboardType).toBe('decimal-pad')
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

    expect(mockOnSubmit).toHaveBeenCalledWith(8, 0, 'kg', undefined)
    expect(mockOnClose).not.toHaveBeenCalled()
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

  it('does not call onSubmit when onSubmitEditing is triggered on weight input (dismisses keyboard instead)', () => {
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

    // onSubmitEditing should dismiss keyboard, not submit the form
    expect(mockOnSubmit).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('prevents double-submit by disabling Save after first press', () => {
    const { getByTestId, getByText } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    const weightInput = getByTestId('weight-input')
    fireEvent.changeText(weightInput, '60')

    const saveButton = getByText('Save')

    // First press should submit
    fireEvent.press(saveButton)
    expect(mockOnSubmit).toHaveBeenCalledTimes(1)
    expect(mockOnSubmit).toHaveBeenCalledWith(10, 60, 'kg', undefined)

    // Second press should be blocked by isSubmitting guard
    fireEvent.press(getByText('Saving...'))
    expect(mockOnSubmit).toHaveBeenCalledTimes(1) // Still only 1
  })

  it('submits with the selected weight unit when the user switches to plates', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    fireEvent.press(getByTestId('weight-unit-plates'))
    expect(getByText('Weight (plates)')).toBeTruthy()

    fireEvent.changeText(getByTestId('weight-input'), '4')
    fireEvent.press(getByText('Save'))

    expect(mockOnSubmit).toHaveBeenCalledWith(10, 4, 'plates', undefined)
  })

  it('defaults the unit to the exercise-configured weight unit', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
        defaultWeightUnit="plates"
      />,
    )

    expect(getByText('Weight (plates)')).toBeTruthy()

    fireEvent.changeText(getByTestId('weight-input'), '4')
    fireEvent.press(getByText('Save'))

    expect(mockOnSubmit).toHaveBeenCalledWith(10, 4, 'plates', undefined)
  })

  it('lets the user pick a variant and passes it to onSubmit', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={15}
        exerciseName="Calf Raise"
        variants={['Standing', 'Sitting']}
      />,
    )

    fireEvent.press(getByTestId('variant-option-Sitting'))
    fireEvent.changeText(getByTestId('weight-input'), '40')
    fireEvent.press(getByText('Save'))

    expect(mockOnSubmit).toHaveBeenCalledWith(15, 40, 'kg', 'Sitting')
  })

  it('tapping a selected variant deselects it', () => {
    const { getByText, getByTestId } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={15}
        variants={['Standing', 'Sitting']}
      />,
    )

    fireEvent.press(getByTestId('variant-option-Standing'))
    fireEvent.press(getByTestId('variant-option-Standing'))
    fireEvent.press(getByText('Save'))

    expect(mockOnSubmit).toHaveBeenCalledWith(15, 0, 'kg', undefined)
  })

  it('does not render variant options when the exercise has none', () => {
    const { queryByText } = render(
      <AddSetDetailsModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialReps={10}
      />,
    )

    expect(queryByText('Variant')).toBeNull()
  })
})
