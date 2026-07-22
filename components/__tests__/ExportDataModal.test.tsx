import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ExportDataModal from '../ExportDataModal'
import * as exportUtils from '../../utils/exportUtils'

jest.mock('../../utils/exportUtils', () => {
  const original = jest.requireActual('../../utils/exportUtils')
  return {
    ...original,
    copyLogsToClipboard: jest.fn().mockResolvedValue(true),
  }
})

describe('ExportDataModal', () => {
  const mockOnClose = jest.fn()

  const journalEntries: any[] = [
    {
      id: 'j1',
      note: 'Morning workout note',
      date: { toDate: () => new Date() },
      supplements: [{ name: 'Creatine', dosage: '5g' }],
    },
  ]

  const weightLogs: any[] = [
    {
      id: 'w1',
      weight: 75.0,
      date: { toDate: () => new Date() },
    },
  ]

  const calorieLogs: any[] = [
    {
      id: 'c1',
      calories: 2500,
      date: { toDate: () => new Date() },
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('does not render when visible is false', () => {
    const { queryByText } = render(
      <ExportDataModal
        visible={false}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )
    expect(queryByText('EXPORT DATA')).toBeNull()
  })

  test('renders correctly and displays summary counts when visible', () => {
    const { getByText, getByTestId } = render(
      <ExportDataModal
        visible={true}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )

    expect(getByText('EXPORT DATA')).toBeTruthy()
    expect(getByTestId('summary-count-journal')).toHaveTextContent('1 items')
    expect(getByTestId('summary-count-supplements')).toHaveTextContent(
      '1 items',
    )
    expect(getByTestId('summary-count-weight')).toHaveTextContent('1 items')
    expect(getByTestId('summary-count-calories')).toHaveTextContent('1 items')
  })

  test('allows selecting different date range presets', () => {
    const { getByTestId } = render(
      <ExportDataModal
        visible={true}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )

    fireEvent.press(getByTestId('export-range-3m'))
    fireEvent.press(getByTestId('export-range-6m'))
    fireEvent.press(getByTestId('export-range-custom'))

    expect(getByTestId('export-start-date-input')).toBeTruthy()
    expect(getByTestId('export-end-date-input')).toBeTruthy()
  })

  test('copies formatted data to clipboard on button press', async () => {
    const { getByTestId } = render(
      <ExportDataModal
        visible={true}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )

    const copyBtn = getByTestId('copy-export-button')
    fireEvent.press(copyBtn)

    await waitFor(() => {
      expect(exportUtils.copyLogsToClipboard).toHaveBeenCalled()
    })
  })

  test('calls onClose when close button is pressed', () => {
    const { getByTestId } = render(
      <ExportDataModal
        visible={true}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )

    fireEvent.press(getByTestId('close-export-modal-button'))
    expect(mockOnClose).toHaveBeenCalled()
  })
})
