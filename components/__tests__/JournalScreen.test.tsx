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

    const { getByTestId } = render(
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

  test('toggles supplement as taken (creates entry) when not taken and no entry exists', async () => {
    const mockAddJournalEntry = jest.fn().mockResolvedValue(undefined)
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ],
      },
      journalEntries: [],
      addJournalEntry: mockAddJournalEntry,
    }

    const { getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const badge = getByTestId('supplement-status-creatine')
    fireEvent.press(badge)

    expect(mockAddJournalEntry).toHaveBeenCalledWith(
      'Logged supplements',
      expect.any(Date),
      null,
      [{ name: 'Creatine', dosage: '5g' }],
    )
  })

  test('toggles supplement as taken (updates entry) when not taken and entry exists', async () => {
    const mockUpdateJournalEntry = jest.fn().mockResolvedValue(undefined)
    const today = new Date()
    const mockTimestamp: any = {
      toDate: () => today,
      toMillis: () => today.getTime(),
    }
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ],
      },
      journalEntries: [
        {
          id: 'existing-entry-id',
          note: 'My morning notes',
          date: mockTimestamp,
          supplements: [],
        },
      ],
      updateJournalEntry: mockUpdateJournalEntry,
    }

    const { getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const badge = getByTestId('supplement-status-creatine')
    fireEvent.press(badge)

    expect(mockUpdateJournalEntry).toHaveBeenCalledWith(
      'existing-entry-id',
      'My morning notes',
      expect.any(Date),
      null,
      [{ name: 'Creatine', dosage: '5g' }],
    )
  })

  test('toggles supplement as untaken (removes from entry) when already taken', async () => {
    const mockUpdateJournalEntry = jest.fn().mockResolvedValue(undefined)
    const today = new Date()
    const mockTimestamp: any = {
      toDate: () => today,
      toMillis: () => today.getTime(),
    }
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ],
      },
      journalEntries: [
        {
          id: 'existing-entry-id',
          note: 'My morning notes',
          date: mockTimestamp,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ],
      updateJournalEntry: mockUpdateJournalEntry,
    }

    const { getByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const badge = getByTestId('supplement-status-creatine')
    fireEvent.press(badge)

    expect(mockUpdateJournalEntry).toHaveBeenCalledWith(
      'existing-entry-id',
      'My morning notes',
      expect.any(Date),
      null,
      [],
    )
  })

  test('shows missed supplements section footer for a day with untaken scheduled supplements', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1) // yesterday
    const dateKey = `${pastDate.getFullYear()}-${(pastDate.getMonth() + 1).toString().padStart(2, '0')}-${pastDate.getDate().toString().padStart(2, '0')}`
    const activatedDate = '2020-01-01' // activated long ago
    const mockTimestamp: any = {
      toDate: () => pastDate,
      toMillis: () => pastDate.getTime(),
    }

    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          {
            name: 'Creatine',
            defaultDosage: '5g',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
          {
            name: 'Fish Oil',
            defaultDosage: '1 cap',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
          {
            name: 'Vitamin D',
            defaultDosage: '2000 IU',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
        ],
      },
      journalEntries: [
        {
          id: 'past-entry',
          note: 'Yesterday workout',
          date: mockTimestamp,
          supplements: [{ name: 'Creatine', dosage: '5g' }], // Only took Creatine
        },
      ],
    }

    const { getByTestId, getAllByText } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Missed supplements section should appear
    expect(getByTestId(`missed-supplements-${dateKey}`)).toBeTruthy()
    // Should show missed Fish Oil and Vitamin D (may appear in Today panel too)
    expect(getAllByText('Fish Oil').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Vitamin D').length).toBeGreaterThanOrEqual(1)
  })

  test('does not show missed supplements section when all scheduled supplements were taken', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1) // yesterday
    const dateKey = `${pastDate.getFullYear()}-${(pastDate.getMonth() + 1).toString().padStart(2, '0')}-${pastDate.getDate().toString().padStart(2, '0')}`
    const activatedDate = '2020-01-01' // activated long ago
    const mockTimestamp: any = {
      toDate: () => pastDate,
      toMillis: () => pastDate.getTime(),
    }

    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          {
            name: 'Creatine',
            defaultDosage: '5g',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
          {
            name: 'Fish Oil',
            defaultDosage: '1 cap',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
        ],
      },
      journalEntries: [
        {
          id: 'past-entry',
          note: 'All supps taken',
          date: mockTimestamp,
          supplements: [
            { name: 'Creatine', dosage: '5g' },
            { name: 'Fish Oil', dosage: '1 cap' },
          ],
        },
      ],
    }

    const { queryByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Missed supplements section should NOT appear
    expect(queryByTestId(`missed-supplements-${dateKey}`)).toBeNull()
  })

  test('does not show missed supplements for dates before scheduleActivatedDate', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 3) // 3 days ago
    const dateKey = `${pastDate.getFullYear()}-${(pastDate.getMonth() + 1).toString().padStart(2, '0')}-${pastDate.getDate().toString().padStart(2, '0')}`
    // Activation date is yesterday — the entry from 3 days ago should not show missed
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const activatedDate = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`
    const mockTimestamp: any = {
      toDate: () => pastDate,
      toMillis: () => pastDate.getTime(),
    }

    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          {
            name: 'Creatine',
            defaultDosage: '5g',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
          {
            name: 'Fish Oil',
            defaultDosage: '1 cap',
            schedule: 'daily',
            scheduleActivatedDate: activatedDate,
          },
        ],
      },
      journalEntries: [
        {
          id: 'old-entry',
          note: 'Entry from 3 days ago',
          date: mockTimestamp,
          supplements: [], // No supplements taken, but schedule wasn't active yet
        },
      ],
    }

    const { queryByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Missed supplements section should NOT appear because schedule was activated after this date
    expect(queryByTestId(`missed-supplements-${dateKey}`)).toBeNull()
  })

  test('migrates existing scheduled supplements without scheduleActivatedDate on mount', async () => {
    const migrationSaveSettings = jest.fn().mockResolvedValue(undefined)
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' }, // no scheduleActivatedDate
          { name: 'Fish Oil', defaultDosage: '1 cap' }, // not scheduled, no migration needed
        ],
      },
      saveSettings: migrationSaveSettings,
    }

    render(<JournalScreen user={null} visible={true} dataHook={dataHook} />)

    await act(async () => {
      await Promise.resolve()
    })

    // Migration should have fired saveSettings with scheduleActivatedDate set to today
    expect(migrationSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        supplementSuggestions: expect.arrayContaining([
          expect.objectContaining({
            name: 'Creatine',
            schedule: 'daily',
            scheduleActivatedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          }),
          expect.objectContaining({
            name: 'Fish Oil',
          }),
        ]),
      }),
      null,
    )

    // Fish Oil should NOT have scheduleActivatedDate
    const savedSuggestions =
      migrationSaveSettings.mock.calls[0][0].supplementSuggestions
    const fishOil = savedSuggestions.find((s: any) => s.name === 'Fish Oil')
    expect(fishOil.scheduleActivatedDate).toBeUndefined()
  })
})
