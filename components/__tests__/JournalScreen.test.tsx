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
  Download: () => null,
  Copy: () => null,
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

  test('opens export modal when export header button is pressed', async () => {
    const { getByTestId, getByText } = render(
      <JournalScreen user={null} visible={true} dataHook={mockDataHook} />,
    )

    const exportBtn = getByTestId('export-journal-button')
    fireEvent.press(exportBtn)

    expect(getByText('EXPORT DATA')).toBeTruthy()
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

    // Panel should be visible (Fish Oil is still untaken)
    expect(getByTestId('supplement-status-panel')).toBeTruthy()

    // Creatine was already taken — it should NOT appear in the panel
    // (the panel only lists untaken supplements)
    expect(queryByTestId('supplement-status-creatine')).toBeNull()

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

  test('hides the panel once all due supplements have been taken today', async () => {
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
    }

    const { queryByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // The only scheduled supplement was already taken, so the panel — which
    // lists only untaken supplements — should not render at all.
    expect(queryByTestId('supplement-status-panel')).toBeNull()
    expect(queryByTestId('supplement-status-creatine')).toBeNull()
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

  test('displays untaken scheduled supplements for that day first in popular supplements', async () => {
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Alpha NonScheduled', defaultDosage: '1 tab' },
          {
            name: 'Beta ScheduledUntaken',
            defaultDosage: '5g',
            schedule: 'daily',
            scheduleActivatedDate: '2020-01-01',
          },
        ],
      },
    }

    const { getByTestId, getByPlaceholderText, getAllByText, getAllByTestId } =
      render(<JournalScreen user={null} visible={true} dataHook={dataHook} />)

    await act(async () => {
      await Promise.resolve()
    })

    // Open add journal note modal
    const addNoteBtn = getByTestId('add-journal-note-button')
    fireEvent.press(addNoteBtn)

    // Focus search input to open popular supplements suggestions
    const searchInput = getByPlaceholderText('Search/Add Supp...')
    fireEvent(searchInput, 'focus')

    // Get all supplement items rendered in popular supplements
    const betaItem = getAllByText(/Beta ScheduledUntaken/)[0]
    const alphaItem = getAllByText(/Alpha NonScheduled/)[0]

    expect(betaItem).toBeTruthy()
    expect(alphaItem).toBeTruthy()

    // Beta (untaken scheduled supplement) sorts ahead of Alpha (non-scheduled).
    // Each chip carries a remove-suggestion-<name> testID, so the rendered order
    // of those testIDs is the rendered order of the list.
    const order = getAllByTestId(/^remove-suggestion-/).map(
      (node) => node.props.testID,
    )
    expect(order).toEqual([
      'remove-suggestion-Beta ScheduledUntaken',
      'remove-suggestion-Alpha NonScheduled',
    ])
  })

  test('keeps scheduled supplements in place once they have been taken that day', async () => {
    const takenDate = new Date()
    const dataHook: any = {
      ...mockDataHook,
      settings: {
        supplementSuggestions: [
          { name: 'Alpha NonScheduled', defaultDosage: '1 tab' },
          {
            name: 'Beta ScheduledUntaken',
            defaultDosage: '5g',
            schedule: 'daily',
            scheduleActivatedDate: '2020-01-01',
          },
        ],
      },
      journalEntries: [
        {
          id: 'entry-1',
          date: {
            toDate: () => takenDate,
            toMillis: () => takenDate.getTime(),
          },
          supplements: [{ name: 'Beta ScheduledUntaken', dosage: '5g' }],
        },
      ],
    }

    const { getByTestId, getByPlaceholderText, getAllByTestId } = render(
      <JournalScreen user={null} visible={true} dataHook={dataHook} />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.press(getByTestId('add-journal-note-button'))
    fireEvent(getByPlaceholderText('Search/Add Supp...'), 'focus')

    // Beta is no longer "forgotten", so the original declaration order stands.
    const order = getAllByTestId(/^remove-suggestion-/).map(
      (node) => node.props.testID,
    )
    expect(order).toEqual([
      'remove-suggestion-Alpha NonScheduled',
      'remove-suggestion-Beta ScheduledUntaken',
    ])
  })

  describe('journal-day rollover (dayRolloverHour)', () => {
    // Freeze "now" at 1 AM local. With a 7 AM wake-up boundary the journal
    // still counts this as yesterday.
    const pad = (n: number) => n.toString().padStart(2, '0')
    const localKey = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    const realDate = Date
    let nowAt1AM: Date
    let calendarTodayKey: string
    let journalTodayKey: string

    const makeTs = (d: Date): any => ({
      toDate: () => d,
      toMillis: () => d.getTime(),
    })

    beforeEach(() => {
      nowAt1AM = new Date()
      nowAt1AM.setHours(1, 0, 0, 0)
      const journalDay = new Date(nowAt1AM)
      journalDay.setDate(journalDay.getDate() - 1)
      calendarTodayKey = localKey(nowAt1AM)
      journalTodayKey = localKey(journalDay)

      jest.useFakeTimers()
      jest.setSystemTime(nowAt1AM)
    })

    afterEach(() => {
      jest.useRealTimers()
      global.Date = realDate
    })

    test("status panel shows the previous day's supplements after midnight", async () => {
      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
          ],
        },
        journalEntries: [],
      }

      const { getByTestId } = render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      // Creatine is due daily and untaken for the current journal day
      // (yesterday) → panel visible with the badge.
      expect(getByTestId('supplement-status-panel')).toBeTruthy()
      expect(getByTestId('supplement-status-creatine')).toBeTruthy()
      expect(getByTestId('journal-reminder-badge')).toBeTruthy()
    })

    test("toggling a supplement after midnight appends to the previous day's entry", async () => {
      const mockUpdateJournalEntry = jest.fn().mockResolvedValue(undefined)
      const mockAddJournalEntry = jest.fn().mockResolvedValue(undefined)
      // Entry created yesterday evening — calendar-wise "yesterday", but it
      // is the current journal day at 1 AM.
      const yesterdayEvening = new Date(nowAt1AM)
      yesterdayEvening.setDate(yesterdayEvening.getDate() - 1)
      yesterdayEvening.setHours(22, 0, 0, 0)

      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
          ],
        },
        journalEntries: [
          {
            id: 'evening-entry',
            note: 'Evening notes',
            date: makeTs(yesterdayEvening),
            supplements: [],
          },
        ],
        updateJournalEntry: mockUpdateJournalEntry,
        addJournalEntry: mockAddJournalEntry,
      }

      const { getByTestId } = render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      fireEvent.press(getByTestId('supplement-status-creatine'))

      expect(mockUpdateJournalEntry).toHaveBeenCalledWith(
        'evening-entry',
        'Evening notes',
        yesterdayEvening,
        null,
        [{ name: 'Creatine', dosage: '5g' }],
      )
      expect(mockAddJournalEntry).not.toHaveBeenCalled()
    })

    test("an entry logged after midnight is grouped under the previous day's section", async () => {
      const dataHook: any = {
        ...mockDataHook,
        settings: { supplementSuggestions: [] },
        journalEntries: [
          {
            id: 'late-entry',
            note: 'Logged at 1 AM',
            date: makeTs(nowAt1AM),
            supplements: [],
          },
        ],
      }

      const { getByText, queryByText } = render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      const journalDay = new Date(nowAt1AM)
      journalDay.setDate(journalDay.getDate() - 1)
      const expectedHeader = journalDay.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      const unexpectedHeader = nowAt1AM.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

      expect(getByText(expectedHeader)).toBeTruthy()
      expect(queryByText(unexpectedHeader)).toBeNull()
    })

    test('a past section reports its own journal day, not the day before', async () => {
      // "Now" is 12:00 on Aug 27, so journal-day today is 2026-08-27 and both
      // sections below are in the past. Creatine was taken on journal-day
      // Aug 25 and missed on journal-day Aug 26.
      jest.setSystemTime(new Date(2026, 7, 27, 12, 0))

      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            {
              name: 'Creatine',
              defaultDosage: '5g',
              schedule: 'daily',
              scheduleActivatedDate: '2020-01-01',
            },
          ],
        },
        journalEntries: [
          {
            id: 'aug25',
            note: 'took it',
            date: makeTs(new Date(2026, 7, 25, 20, 0)),
            supplements: [{ name: 'Creatine', dosage: '5g' }],
          },
          {
            id: 'aug26',
            note: 'forgot',
            date: makeTs(new Date(2026, 7, 26, 20, 0)),
            supplements: [],
          },
        ],
      }

      const { queryByTestId } = render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      // Taken on Aug 25 → no footer. Rebuilding the section key at midnight
      // would look at Aug 24 (nothing taken) and wrongly flag it.
      expect(queryByTestId('missed-supplements-2026-08-25')).toBeNull()
      // Missed on Aug 26 → footer. Rebuilding at midnight would look at
      // Aug 25, find the dose, and wrongly suppress it.
      expect(queryByTestId('missed-supplements-2026-08-26')).toBeTruthy()
    })

    test('the schedule-activation migration stamps the journal-day key', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined)
      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            // Scheduled but never stamped → triggers the migration effect.
            { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
          ],
        },
        journalEntries: [],
        saveSettings: mockSave,
      }

      render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockSave).toHaveBeenCalled()
      const saved = mockSave.mock.calls[0][0]
      // At 1 AM the journal day is still yesterday. Stamping the calendar date
      // would gate the supplement off for the rest of the journal day.
      expect(saved.supplementSuggestions[0].scheduleActivatedDate).toBe(
        journalTodayKey,
      )
      expect(saved.supplementSuggestions[0].scheduleActivatedDate).not.toBe(
        calendarTodayKey,
      )
    })

    test('the status panel advances to the new journal day when the tab is reopened', async () => {
      // Mounted at 23:00 on Aug 26 (journal day Aug 26) while on another tab,
      // with Creatine already taken for that journal day.
      jest.setSystemTime(new Date(2026, 7, 26, 23, 0))

      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            {
              name: 'Creatine',
              defaultDosage: '5g',
              schedule: 'daily',
              scheduleActivatedDate: '2020-01-01',
            },
          ],
        },
        journalEntries: [
          {
            id: 'aug26',
            note: 'took it',
            date: makeTs(new Date(2026, 7, 26, 20, 0)),
            supplements: [{ name: 'Creatine', dosage: '5g' }],
          },
        ],
      }

      const { rerender, queryByTestId } = render(
        <JournalScreen
          user={null}
          visible={false}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      // The journal day has rolled over to Aug 27 — Creatine is untaken again.
      jest.setSystemTime(new Date(2026, 7, 27, 8, 0))

      rerender(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      // A "now" frozen at mount would still report journal day Aug 26, where
      // Creatine was taken, and hide the panel.
      expect(queryByTestId('supplement-status-panel')).toBeTruthy()
      expect(queryByTestId('supplement-status-creatine')).toBeTruthy()
    })

    test('the journal-current day does not show a missed-supplements footer after midnight', async () => {
      // Entry from yesterday evening (current journal day) with nothing taken.
      const yesterdayEvening = new Date(nowAt1AM)
      yesterdayEvening.setDate(yesterdayEvening.getDate() - 1)
      yesterdayEvening.setHours(22, 0, 0, 0)

      const dataHook: any = {
        ...mockDataHook,
        settings: {
          supplementSuggestions: [
            {
              name: 'Creatine',
              defaultDosage: '5g',
              schedule: 'daily',
              scheduleActivatedDate: '2020-01-01',
            },
          ],
        },
        journalEntries: [
          {
            id: 'evening-entry',
            note: 'Evening notes',
            date: makeTs(yesterdayEvening),
            supplements: [],
          },
        ],
      }

      const { queryByTestId } = render(
        <JournalScreen
          user={null}
          visible={true}
          dataHook={dataHook}
          dayRolloverHour={7}
        />,
      )

      await act(async () => {
        await Promise.resolve()
      })

      // The entry's journal-day section is yesterday's key — it must NOT be
      // flagged as missed while still "today" in journal terms, and there is
      // no section under the calendar-day key at all.
      expect(queryByTestId(`missed-supplements-${journalTodayKey}`)).toBeNull()
      expect(queryByTestId(`missed-supplements-${calendarTodayKey}`)).toBeNull()
    })
  })
})
