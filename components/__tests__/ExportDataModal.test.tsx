import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Platform } from 'react-native'
import ExportDataModal from '../ExportDataModal'
import * as exportUtils from '../../utils/exportUtils'

jest.mock('../../utils/exportUtils', () => {
  const original = jest.requireActual('../../utils/exportUtils')
  return {
    ...original,
    copyLogsToClipboard: jest.fn().mockResolvedValue(true),
  }
})

jest.mock('react-native-toast-message', () => {
  const mockToast = () => null
  mockToast.show = jest.fn()
  mockToast.hide = jest.fn()
  return mockToast
})

// Passthrough so tests can read `value` and drive `onChange` directly.
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react')
  const { View } = require('react-native')
  return (props: any) => ReactLib.createElement(View, props)
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

  const renderModal = () =>
    render(
      <ExportDataModal
        visible={true}
        onClose={mockOnClose}
        journalEntries={journalEntries}
        weightLogs={weightLogs}
        calorieLogs={calorieLogs}
      />,
    )

  // Opens the custom range section and returns the RNTL result.
  const renderCustomRange = () => {
    const utils = renderModal()
    fireEvent.press(utils.getByTestId('export-range-custom'))
    return utils
  }

  describe('copy outcomes', () => {
    it('reports the exported counts on success', async () => {
      const Toast = require('react-native-toast-message')
      const { getByTestId } = renderModal()

      fireEvent.press(getByTestId('copy-export-button'))

      await waitFor(() => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            text1: 'Export Copied to Clipboard!',
            text2: '1 journal, 1 weight & 1 calorie logs',
          }),
        )
      })
    })

    it('confirms in the button label, then reverts after the timeout', async () => {
      jest.useFakeTimers()
      try {
        const { getByText, queryByText } = renderModal()

        await act(async () => {
          fireEvent.press(getByText('COPY DATA TO CLIPBOARD'))
        })

        expect(getByText('COPIED TO CLIPBOARD!')).toBeTruthy()

        await act(async () => {
          jest.advanceTimersByTime(2500)
        })

        expect(queryByText('COPIED TO CLIPBOARD!')).toBeNull()
        expect(getByText('COPY DATA TO CLIPBOARD')).toBeTruthy()
      } finally {
        jest.useRealTimers()
      }
    })

    it('warns when the clipboard write reports failure', async () => {
      const Toast = require('react-native-toast-message')
      ;(exportUtils.copyLogsToClipboard as jest.Mock).mockResolvedValue(false)
      const { getByTestId, queryByText } = renderModal()

      await act(async () => {
        fireEvent.press(getByTestId('copy-export-button'))
      })

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Copy Failed',
          text2: 'Could not copy export data to clipboard.',
        }),
      )
      expect(queryByText('COPIED TO CLIPBOARD!')).toBeNull()
    })

    it('swallows an unexpected throw and still surfaces an error toast', async () => {
      const Toast = require('react-native-toast-message')
      const error = new Error('clipboard exploded')
      ;(exportUtils.copyLogsToClipboard as jest.Mock).mockRejectedValue(error)
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { getByTestId } = renderModal()

      await act(async () => {
        fireEvent.press(getByTestId('copy-export-button'))
      })

      expect(errorSpy).toHaveBeenCalledWith('Export copy failed:', error)
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Copy Failed',
          text2: 'Something went wrong while preparing the export.',
        }),
      )
      errorSpy.mockRestore()
    })
  })

  describe('custom range', () => {
    it('stays hidden for the preset ranges', () => {
      const { queryByTestId } = renderModal()

      expect(queryByTestId('export-start-date-input')).toBeNull()
      expect(queryByTestId('export-end-date-input')).toBeNull()
    })

    it('prefills the inputs with one month back through today', () => {
      const { getByTestId } = renderCustomRange()

      const pattern = /^\d{4}-\d{2}-\d{2}$/
      expect(getByTestId('export-start-date-input').props.value).toMatch(
        pattern,
      )
      expect(getByTestId('export-end-date-input').props.value).toMatch(pattern)
    })

    it('adopts a typed start date', () => {
      const { getByTestId } = renderCustomRange()

      fireEvent.changeText(getByTestId('export-start-date-input'), '2026-03-04')
      fireEvent.press(getByTestId('export-start-date-input'))

      expect(getByTestId('export-start-datepicker').props.value).toEqual(
        new Date(2026, 2, 4),
      )
    })

    it('adopts a typed end date', () => {
      const { getByTestId } = renderCustomRange()

      fireEvent.changeText(getByTestId('export-end-date-input'), '2026-05-06')
      fireEvent.press(getByTestId('export-end-date-input'))

      expect(getByTestId('export-end-datepicker').props.value).toEqual(
        new Date(2026, 4, 6),
      )
    })

    it.each([
      ['too few segments', '2026-03'],
      ['non-numeric segments', 'abc-de-fg'],
      ['empty text', ''],
    ])('keeps the previous start date for %s', (_label, text) => {
      const { getByTestId } = renderCustomRange()

      fireEvent.changeText(getByTestId('export-start-date-input'), '2026-03-04')
      fireEvent.press(getByTestId('export-start-date-input'))
      const before = getByTestId('export-start-datepicker').props.value

      fireEvent.changeText(getByTestId('export-start-date-input'), text)

      // The text field still shows what was typed, but the date is untouched.
      expect(getByTestId('export-start-date-input').props.value).toBe(text)
      expect(getByTestId('export-start-datepicker').props.value).toEqual(before)
    })

    it('keeps the previous end date for unparseable text', () => {
      const { getByTestId } = renderCustomRange()

      fireEvent.changeText(getByTestId('export-end-date-input'), '2026-05-06')
      fireEvent.press(getByTestId('export-end-date-input'))
      const before = getByTestId('export-end-datepicker').props.value

      fireEvent.changeText(getByTestId('export-end-date-input'), 'nope')

      expect(getByTestId('export-end-datepicker').props.value).toEqual(before)
    })

    it('opens each picker only once its field is pressed', () => {
      const { getByTestId, queryByTestId } = renderCustomRange()

      expect(queryByTestId('export-start-datepicker')).toBeNull()
      expect(queryByTestId('export-end-datepicker')).toBeNull()

      fireEvent.press(getByTestId('export-start-date-input'))
      expect(getByTestId('export-start-datepicker')).toBeTruthy()
      expect(queryByTestId('export-end-datepicker')).toBeNull()

      fireEvent.press(getByTestId('export-end-date-input'))
      expect(getByTestId('export-end-datepicker')).toBeTruthy()
    })
  })

  describe('native date pickers', () => {
    const originalOS = Platform.OS

    afterEach(() => {
      Platform.OS = originalOS
    })

    it('applies a picked start date to both the field and the range', () => {
      Platform.OS = 'ios'
      const { getByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-start-date-input'))

      act(() => {
        getByTestId('export-start-datepicker').props.onChange(
          { type: 'set' },
          new Date(2026, 0, 15),
        )
      })

      expect(getByTestId('export-start-date-input').props.value).toBe(
        '2026-01-15',
      )
      expect(getByTestId('export-start-datepicker').props.value).toEqual(
        new Date(2026, 0, 15),
      )
    })

    it('applies a picked end date', () => {
      Platform.OS = 'ios'
      const { getByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-end-date-input'))

      act(() => {
        getByTestId('export-end-datepicker').props.onChange(
          { type: 'set' },
          new Date(2026, 11, 9),
        )
      })

      expect(getByTestId('export-end-date-input').props.value).toBe(
        '2026-12-09',
      )
    })

    it('keeps the inline picker mounted on iOS', () => {
      Platform.OS = 'ios'
      const { getByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-start-date-input'))

      act(() => {
        getByTestId('export-start-datepicker').props.onChange(
          { type: 'set' },
          new Date(2026, 0, 15),
        )
      })

      expect(getByTestId('export-start-datepicker')).toBeTruthy()
    })

    it('dismisses the dialog on Android once a date is chosen', () => {
      Platform.OS = 'android'
      const { getByTestId, queryByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-start-date-input'))

      act(() => {
        getByTestId('export-start-datepicker').props.onChange(
          { type: 'set' },
          new Date(2026, 0, 15),
        )
      })

      expect(queryByTestId('export-start-datepicker')).toBeNull()
      expect(getByTestId('export-start-date-input').props.value).toBe(
        '2026-01-15',
      )
    })

    it('leaves the date unchanged when the picker is dismissed with no selection', () => {
      Platform.OS = 'ios'
      const { getByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-start-date-input'))
      const before = getByTestId('export-start-date-input').props.value

      act(() => {
        getByTestId('export-start-datepicker').props.onChange(
          { type: 'dismissed' },
          undefined,
        )
      })

      expect(getByTestId('export-start-date-input').props.value).toBe(before)
    })

    it('pads single-digit months and days', () => {
      Platform.OS = 'ios'
      const { getByTestId } = renderCustomRange()
      fireEvent.press(getByTestId('export-start-date-input'))

      act(() => {
        getByTestId('export-start-datepicker').props.onChange(
          { type: 'set' },
          new Date(2026, 8, 7),
        )
      })

      expect(getByTestId('export-start-date-input').props.value).toBe(
        '2026-09-07',
      )
    })
  })

  describe('range filtering', () => {
    it('drops logs that fall outside the selected window', () => {
      const old = { toDate: () => new Date(2020, 0, 1) }
      const { getByTestId } = render(
        <ExportDataModal
          visible={true}
          onClose={mockOnClose}
          journalEntries={[{ id: 'j-old', note: 'old', date: old } as any]}
          weightLogs={[{ id: 'w-old', weight: 70, date: old } as any]}
          calorieLogs={[{ id: 'c-old', calories: 2000, date: old } as any]}
        />,
      )

      expect(getByTestId('summary-count-journal')).toHaveTextContent('0 items')
      expect(getByTestId('summary-count-weight')).toHaveTextContent('0 items')
      expect(getByTestId('summary-count-calories')).toHaveTextContent('0 items')
    })

    it('handles an entirely empty data set', () => {
      const { getByTestId } = render(
        <ExportDataModal
          visible={true}
          onClose={mockOnClose}
          journalEntries={[]}
          weightLogs={[]}
          calorieLogs={[]}
        />,
      )

      expect(getByTestId('summary-count-journal')).toHaveTextContent('0 items')
      expect(getByTestId('summary-count-supplements')).toHaveTextContent(
        '0 items',
      )
    })
  })
})
