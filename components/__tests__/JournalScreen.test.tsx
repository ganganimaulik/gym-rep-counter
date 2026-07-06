/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert, Platform } from 'react-native'
import JournalScreen from '../JournalScreen'

// Mock Lucide icons
jest.mock('lucide-react-native', () => ({
  Pencil: () => null,
  Trash2: () => null,
  Plus: () => null,
  X: () => null,
  Scale: () => null,
  Flame: () => null,
  Check: () => null,
  AlertTriangle: () => null,
  Calendar: () => null,
}))

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker')

describe('JournalScreen', () => {
  const mockSaveSettings = jest.fn().mockResolvedValue(undefined)
  const mockFetchJournalEntries = jest.fn().mockResolvedValue([])

  const mockDataHook: any = {
    settings: {
      supplementSuggestions: [
        { name: 'Creatine', defaultDosage: '5g' },
        { name: 'Whey Protein', defaultDosage: '1 scoop' },
      ],
    },
    weightLogs: [],
    calorieLogs: [],
    journalEntries: [],
    fetchJournalEntries: mockFetchJournalEntries,
    saveSettings: mockSaveSettings,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    window.confirm = jest.fn()
  })

  test('prompts for confirmation before removing a popular supplement suggestion on native', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')

    const { getByPlaceholderText, getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Open Add Note Modal
    const addNoteBtn = getByTestId('add-journal-note-button')
    fireEvent.press(addNoteBtn)

    // Open suggestion box by focusing search input
    const searchInput = getByPlaceholderText('Search/Add Supp...')
    fireEvent(searchInput, 'focus')

    // Find delete button for Creatine
    const removeBtn = getByTestId('remove-suggestion-Creatine')
    expect(removeBtn).toBeTruthy()

    fireEvent.press(removeBtn)

    // Verify Alert.alert was called with confirmation title and message
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Supplement',
      'Are you sure you want to delete "Creatine" from popular supplements?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ]),
    )

    // Trigger the onPress of the Delete button in Alert
    const buttons = alertSpy.mock.calls[0][2]
    const deleteBtn = buttons?.find((b) => b.text === 'Delete')
    deleteBtn?.onPress?.()

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          supplementSuggestions: [
            { name: 'Whey Protein', defaultDosage: '1 scoop' },
          ],
        }),
        null,
      )
    })
  })

  test('prompts window.confirm on web before removing a supplement suggestion', async () => {
    const originalOS = Platform.OS
    Platform.OS = 'web'
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    const { getByPlaceholderText, getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const addNoteBtn = getByTestId('add-journal-note-button')
    fireEvent.press(addNoteBtn)

    const searchInput = getByPlaceholderText('Search/Add Supp...')
    fireEvent(searchInput, 'focus')

    const removeBtn = getByTestId('remove-suggestion-Creatine')
    fireEvent.press(removeBtn)

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete "Creatine" from popular supplements?',
    )

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          supplementSuggestions: [
            { name: 'Whey Protein', defaultDosage: '1 scoop' },
          ],
        }),
        null,
      )
    })

    confirmSpy.mockRestore()
    Platform.OS = originalOS
  })

  test('updates popular supplement with latest dosage when added via + button', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const addNoteBtn = getByTestId('add-journal-note-button')
    fireEvent.press(addNoteBtn)

    const searchInput = getByPlaceholderText('Search/Add Supp...')
    const dosageInput = getByPlaceholderText('Dosage')
    const addSuppBtn = getByTestId('add-supplement-button')

    fireEvent.changeText(searchInput, 'Creatine')
    fireEvent.changeText(dosageInput, '10g')
    fireEvent.press(addSuppBtn)

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          supplementSuggestions: [
            { name: 'Creatine', defaultDosage: '10g' },
            { name: 'Whey Protein', defaultDosage: '1 scoop' },
          ],
        }),
        null,
      )
    })
  })

  test('adds new supplement with dosage to popular supplements when added', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const addNoteBtn = getByTestId('add-journal-note-button')
    fireEvent.press(addNoteBtn)

    const searchInput = getByPlaceholderText('Search/Add Supp...')
    const dosageInput = getByPlaceholderText('Dosage')
    const addSuppBtn = getByTestId('add-supplement-button')

    fireEvent.changeText(searchInput, 'Ashwagandha')
    fireEvent.changeText(dosageInput, '600mg')
    fireEvent.press(addSuppBtn)

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          supplementSuggestions: [
            { name: 'Creatine', defaultDosage: '5g' },
            { name: 'Whey Protein', defaultDosage: '1 scoop' },
            { name: 'Ashwagandha', defaultDosage: '600mg' },
          ],
        }),
        null,
      )
    })
  })

  test('shows supplement status panel when supplements are due today', async () => {
    const today = new Date()
    const mockTimestamp = {
      toDate: () => today,
      toMillis: () => today.getTime(),
      seconds: Math.floor(today.getTime() / 1000),
      nanoseconds: 0,
    }

    const dataHookWithScheduled: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
          { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'daily' },
        ],
      },
      journalEntries: [
        {
          id: '1',
          note: 'Morning',
          date: mockTimestamp,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ],
    }

    const { getByTestId, queryByTestId } = render(
      <JournalScreen
        user={null}
        visible={true}
        dataHook={dataHookWithScheduled}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Panel should be visible
    expect(getByTestId('supplement-status-panel')).toBeTruthy()

    // Creatine should be shown (taken)
    expect(getByTestId('supplement-status-creatine')).toBeTruthy()

    // Fish Oil should be shown (untaken)
    expect(getByTestId('supplement-status-fish-oil')).toBeTruthy()
  })

  test('does not show supplement status panel when no supplements are scheduled', async () => {
    const { queryByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Panel should not be visible since no supplements have schedules
    expect(queryByTestId('supplement-status-panel')).toBeNull()
  })

  test('shows journal reminder badge when no journal entry exists today', async () => {
    const dataHookWithScheduledNoJournal: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ],
      },
      journalEntries: [], // No journal entries today
    }

    const { getByTestId } = render(
      <JournalScreen
        user={null}
        visible={true}
        dataHook={dataHookWithScheduledNoJournal}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(getByTestId('journal-reminder-badge')).toBeTruthy()
  })
})
