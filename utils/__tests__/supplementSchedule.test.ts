import {
  isSupplementDueOnDate,
  getSupplementsDueToday,
  getSupplementsTakenOnDate,
  getSupplementIntakeCountOnDate,
  getUntakenSupplements,
  hasJournalEntryForDate,
  buildBedtimeReminderBody,
  buildSupplementReminderSignature,
  getRequiredIntakeCount,
  getLocalDateKey,
  getJournalDayDate,
  getJournalDateKey,
  journalDayKeyToDate,
  SupplementSuggestion,
} from '../supplementSchedule'
import type { JournalEntry } from '../../declarations'

// Helper to create a mock Firestore Timestamp-like object
const makeTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
})

describe('supplementSchedule', () => {
  describe('isSupplementDueOnDate', () => {
    test('returns false for schedule "none"', () => {
      const supp: SupplementSuggestion = {
        name: 'Creatine',
        defaultDosage: '5g',
        schedule: 'none',
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(false)
    })

    test('returns false when schedule is undefined (defaults to none)', () => {
      const supp: SupplementSuggestion = {
        name: 'Creatine',
        defaultDosage: '5g',
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(false)
    })

    test('returns true for schedule "daily" on any day', () => {
      const supp: SupplementSuggestion = {
        name: 'Creatine',
        defaultDosage: '5g',
        schedule: 'daily',
      }
      // Monday
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(true)
      // Sunday
      expect(isSupplementDueOnDate(supp, new Date('2026-07-05'))).toBe(true)
      // Saturday
      expect(isSupplementDueOnDate(supp, new Date('2026-07-04'))).toBe(true)
    })

    test('returns true for schedule "twice_daily" on any day', () => {
      const supp: SupplementSuggestion = {
        name: 'Omega 3',
        defaultDosage: '1 cap',
        schedule: 'twice_daily',
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(true)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-05'))).toBe(true)
    })

    test('returns true for specific_days only on matching days', () => {
      const supp: SupplementSuggestion = {
        name: 'Fish Oil',
        defaultDosage: '1 cap',
        schedule: 'specific_days',
        scheduleDays: [0, 3], // Sunday and Wednesday
      }
      // Sunday July 5, 2026
      expect(isSupplementDueOnDate(supp, new Date('2026-07-05'))).toBe(true)
      // Wednesday July 8, 2026
      expect(isSupplementDueOnDate(supp, new Date('2026-07-08'))).toBe(true)
      // Monday July 6, 2026
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(false)
      // Tuesday July 7, 2026
      expect(isSupplementDueOnDate(supp, new Date('2026-07-07'))).toBe(false)
    })

    test('returns false for specific_days with empty scheduleDays', () => {
      const supp: SupplementSuggestion = {
        name: 'Fish Oil',
        defaultDosage: '1 cap',
        schedule: 'specific_days',
        scheduleDays: [],
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(false)
    })

    test('returns true for every_other_day on even-offset days from anchor (no journal entries)', () => {
      const supp: SupplementSuggestion = {
        name: 'Zinc',
        defaultDosage: '50mg',
        schedule: 'every_other_day',
        scheduleStartDate: '2026-07-06', // Anchor: Monday
      }
      // No journal entries passed = uses anchor fallback
      // Same day as anchor (offset 0, even)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(true)
      // Day after anchor (offset 1, odd)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-07'))).toBe(false)
      // Two days after (offset 2, even)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-08'))).toBe(true)
    })

    test('returns false for every_other_day if taken yesterday (journal-based)', () => {
      const supp: SupplementSuggestion = {
        name: 'Test e',
        defaultDosage: '150mg',
        schedule: 'every_other_day',
        scheduleStartDate: '2026-07-04',
      }
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 10, 0)) as any,
          supplements: [{ name: 'Test e', dosage: '150mg' }],
        },
      ]
      // Taken yesterday (July 5), so NOT due today (July 6)
      expect(isSupplementDueOnDate(supp, new Date(2026, 6, 6), entries)).toBe(
        false,
      )
    })

    test('returns true for every_other_day if NOT taken yesterday (journal-based)', () => {
      const supp: SupplementSuggestion = {
        name: 'Test e',
        defaultDosage: '150mg',
        schedule: 'every_other_day',
        scheduleStartDate: '2026-07-04',
      }
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Two days ago',
          date: makeTimestamp(new Date(2026, 6, 4, 10, 0)) as any,
          supplements: [{ name: 'Test e', dosage: '150mg' }],
        },
      ]
      // Taken on July 4, NOT taken on July 5 → due on July 6
      expect(isSupplementDueOnDate(supp, new Date(2026, 6, 6), entries)).toBe(
        true,
      )
    })

    test('returns true for every_other_day with no anchor and no entries (assume due)', () => {
      const supp: SupplementSuggestion = {
        name: 'Zinc',
        defaultDosage: '50mg',
        schedule: 'every_other_day',
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(true)
    })

    test('returns false for every_other_day before anchor date (no entries)', () => {
      const supp: SupplementSuggestion = {
        name: 'Zinc',
        defaultDosage: '50mg',
        schedule: 'every_other_day',
        scheduleStartDate: '2026-07-06',
      }
      expect(isSupplementDueOnDate(supp, new Date('2026-07-05'))).toBe(false)
    })

    test('returns false for daily schedule on dates before scheduleActivatedDate', () => {
      const supp: SupplementSuggestion = {
        name: 'Creatine',
        defaultDosage: '5g',
        schedule: 'daily',
        scheduleActivatedDate: '2026-07-10',
      }
      // Before activation date
      expect(isSupplementDueOnDate(supp, new Date('2026-07-09'))).toBe(false)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-01'))).toBe(false)
      // On activation date
      expect(isSupplementDueOnDate(supp, new Date('2026-07-10'))).toBe(true)
      // After activation date
      expect(isSupplementDueOnDate(supp, new Date('2026-07-11'))).toBe(true)
    })

    test('returns false for specific_days schedule on dates before scheduleActivatedDate', () => {
      const supp: SupplementSuggestion = {
        name: 'Fish Oil',
        defaultDosage: '1 cap',
        schedule: 'specific_days',
        scheduleDays: [0, 3], // Sunday and Wednesday
        scheduleActivatedDate: '2026-07-08', // Activated on Wed July 8
      }
      // Sunday July 5 is before activation — should be false even though it's a scheduled day
      expect(isSupplementDueOnDate(supp, new Date('2026-07-05'))).toBe(false)
      // Wednesday July 8 is the activation date and a scheduled day — should be true
      expect(isSupplementDueOnDate(supp, new Date('2026-07-08'))).toBe(true)
    })

    test('returns false for every_other_day schedule on dates before scheduleActivatedDate', () => {
      const supp: SupplementSuggestion = {
        name: 'Zinc',
        defaultDosage: '50mg',
        schedule: 'every_other_day',
        scheduleStartDate: '2026-07-06',
        scheduleActivatedDate: '2026-07-08',
      }
      // July 6 is the anchor but before activation — should be false
      expect(isSupplementDueOnDate(supp, new Date('2026-07-06'))).toBe(false)
      // July 8 is on activation date and even offset from anchor — should be true
      expect(isSupplementDueOnDate(supp, new Date('2026-07-08'))).toBe(true)
    })

    test('daily schedule works normally when no scheduleActivatedDate is set', () => {
      const supp: SupplementSuggestion = {
        name: 'Creatine',
        defaultDosage: '5g',
        schedule: 'daily',
      }
      // Should be due on any date (backwards compatible)
      expect(isSupplementDueOnDate(supp, new Date('2026-07-01'))).toBe(true)
      expect(isSupplementDueOnDate(supp, new Date('2020-01-01'))).toBe(true)
    })
  })

  describe('getSupplementsDueToday', () => {
    test('returns only supplements that are due on the given date', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        {
          name: 'Fish Oil',
          defaultDosage: '1 cap',
          schedule: 'specific_days',
          scheduleDays: [1], // Monday only
        },
        { name: 'Whey', defaultDosage: '1 scoop' }, // no schedule (none)
        {
          name: 'Zinc',
          defaultDosage: '50mg',
          schedule: 'every_other_day',
          scheduleStartDate: '2026-07-06',
        },
      ]

      // Monday July 6, 2026 (day 1) — no entries passed, uses anchor fallback for Zinc
      const monday = new Date('2026-07-06')
      const result = getSupplementsDueToday(suggestions, monday)
      expect(result.map((s) => s.name)).toEqual([
        'Creatine',
        'Fish Oil',
        'Zinc',
      ])
    })

    test('excludes every_other_day supplements taken yesterday when entries provided', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        {
          name: 'Test e',
          defaultDosage: '150mg',
          schedule: 'every_other_day',
          scheduleStartDate: '2026-07-04',
        },
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 10, 0)) as any,
          supplements: [{ name: 'Test e', dosage: '150mg' }],
        },
      ]
      // July 6: Creatine due (daily), Test e NOT due (taken yesterday)
      const result = getSupplementsDueToday(
        suggestions,
        new Date(2026, 6, 6),
        entries,
      )
      expect(result.map((s) => s.name)).toEqual(['Creatine'])
    })

    test('returns empty array when no supplements have schedules', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g' },
        { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'none' },
      ]
      const result = getSupplementsDueToday(suggestions, new Date('2026-07-06'))
      expect(result).toEqual([])
    })
  })

  describe('getSupplementsTakenOnDate', () => {
    test('returns supplement names taken on the given date', () => {
      const date = new Date(2026, 6, 6) // July 6, 2026
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Morning entry',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [
            { name: 'Creatine', dosage: '5g' },
            { name: 'Fish Oil', dosage: '1 cap' },
          ],
        },
        {
          id: '2',
          note: 'Evening entry',
          date: makeTimestamp(new Date(2026, 6, 6, 20, 0)) as any,
          supplements: [{ name: 'Zinc', dosage: '50mg' }],
        },
        {
          id: '3',
          note: 'Yesterday entry',
          date: makeTimestamp(new Date(2026, 6, 5, 10, 0)) as any,
          supplements: [{ name: 'Magnesium', dosage: '400mg' }],
        },
      ]

      const result = getSupplementsTakenOnDate(entries, date)
      expect(result).toEqual(
        expect.arrayContaining(['creatine', 'fish oil', 'zinc']),
      )
      expect(result).not.toContain('magnesium')
    })

    test('returns empty array when no journal entries exist', () => {
      const result = getSupplementsTakenOnDate([], new Date(2026, 6, 6))
      expect(result).toEqual([])
    })

    test('handles entries without supplements', () => {
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'No supps today',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
        },
      ]
      const result = getSupplementsTakenOnDate(entries, new Date(2026, 6, 6))
      expect(result).toEqual([])
    })
  })

  describe('getSupplementIntakeCountOnDate', () => {
    test('returns exact count of supplement logs on given date', () => {
      const date = new Date(2026, 6, 6)
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Dose 1',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Protein', dosage: '1 scoop' }],
        },
        {
          id: '2',
          note: 'Dose 2',
          date: makeTimestamp(new Date(2026, 6, 6, 18, 0)) as any,
          supplements: [{ name: 'Protein', dosage: '1 scoop' }],
        },
      ]
      expect(getSupplementIntakeCountOnDate('Protein', date, entries)).toBe(2)
      expect(getSupplementIntakeCountOnDate('Creatine', date, entries)).toBe(0)
    })

    test('counts multiple supplements within a single journal entry', () => {
      const date = new Date(2026, 6, 6)
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Both doses',
          date: makeTimestamp(new Date(2026, 6, 6, 12, 0)) as any,
          supplements: [
            { name: 'Protein', dosage: '1 scoop' },
            { name: 'Protein', dosage: '1 scoop' },
            { name: 'Creatine', dosage: '5g' },
          ],
        },
      ]
      expect(getSupplementIntakeCountOnDate('Protein', date, entries)).toBe(2)
      expect(getSupplementIntakeCountOnDate('Creatine', date, entries)).toBe(1)
    })
  })

  describe('getRequiredIntakeCount', () => {
    test('returns 2 for twice_daily schedule', () => {
      expect(getRequiredIntakeCount('twice_daily')).toBe(2)
    })

    test('returns 1 for daily schedule', () => {
      expect(getRequiredIntakeCount('daily')).toBe(1)
    })

    test('returns 1 for specific_days schedule', () => {
      expect(getRequiredIntakeCount('specific_days')).toBe(1)
    })

    test('returns 1 for every_other_day schedule', () => {
      expect(getRequiredIntakeCount('every_other_day')).toBe(1)
    })

    test('returns 1 for none schedule', () => {
      expect(getRequiredIntakeCount('none')).toBe(1)
    })

    test('returns 1 for undefined schedule', () => {
      expect(getRequiredIntakeCount(undefined)).toBe(1)
    })
  })

  describe('getUntakenSupplements', () => {
    test('requires 2 intakes for twice_daily supplement before marking complete', () => {
      const dueSupps: SupplementSuggestion[] = [
        { name: 'Protein', defaultDosage: '1 scoop', schedule: 'twice_daily' },
      ]
      const date = new Date(2026, 6, 6)
      const entry1: JournalEntry[] = [
        {
          id: '1',
          note: 'Dose 1',
          date: makeTimestamp(date) as any,
          supplements: [{ name: 'Protein', dosage: '1 scoop' }],
        },
      ]
      // Taken 1 out of 2 times -> still untaken
      expect(
        getUntakenSupplements(dueSupps, entry1, date).map((s) => s.name),
      ).toEqual(['Protein'])

      const entry2: JournalEntry[] = [
        {
          id: '1',
          note: 'Dose 1',
          date: makeTimestamp(date) as any,
          supplements: [
            { name: 'Protein', dosage: '1 scoop' },
            { name: 'Protein', dosage: '1 scoop' },
          ],
        },
      ]
      // Taken 2 out of 2 times -> complete (not untaken)
      expect(getUntakenSupplements(dueSupps, entry2, date)).toEqual([])
    })
    test('returns supplements that are due but not taken', () => {
      const dueSupps: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'daily' },
        { name: 'Zinc', defaultDosage: '50mg', schedule: 'daily' },
      ]

      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Morning',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      const result = getUntakenSupplements(
        dueSupps,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result.map((s) => s.name)).toEqual(['Fish Oil', 'Zinc'])
    })

    test('returns empty array when all supplements are taken', () => {
      const dueSupps: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
      ]

      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Morning',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      const result = getUntakenSupplements(
        dueSupps,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).toEqual([])
    })

    test('is case-insensitive when matching supplement names', () => {
      const dueSupps: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
      ]

      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Morning',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'creatine', dosage: '5g' }],
        },
      ]

      const result = getUntakenSupplements(
        dueSupps,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).toEqual([])
    })
  })

  describe('hasJournalEntryForDate', () => {
    test('returns true when entry exists for the date', () => {
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Today entry',
          date: makeTimestamp(new Date(2026, 6, 6, 14, 30)) as any,
        },
      ]
      expect(hasJournalEntryForDate(entries, new Date(2026, 6, 6))).toBe(true)
    })

    test('returns false when no entry exists for the date', () => {
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday entry',
          date: makeTimestamp(new Date(2026, 6, 5, 14, 30)) as any,
        },
      ]
      expect(hasJournalEntryForDate(entries, new Date(2026, 6, 6))).toBe(false)
    })

    test('returns false for empty entries', () => {
      expect(hasJournalEntryForDate([], new Date(2026, 6, 6))).toBe(false)
    })
  })

  describe('buildBedtimeReminderBody', () => {
    test('returns null when all supplements taken and journal exists', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Done',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).toBeNull()
    })

    test('includes missing supplements in body', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'daily' },
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Partial',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Evening Reminder 🌙')
      expect(result!.body).toContain('Fish Oil')
      expect(result!.body).not.toContain('Creatine')
    })

    test('includes journal reminder when no entry exists', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).not.toBeNull()
      expect(result!.body).toContain("Don't forget your journal entry")
      expect(result!.body).toContain('Creatine')
    })

    test('returns journal-only reminder when no supplements are scheduled', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g' }, // no schedule
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        [],
        new Date(2026, 6, 6),
      )
      expect(result).not.toBeNull()
      expect(result!.body).toContain("Don't forget your journal entry")
      expect(result!.body).not.toContain('Missing')
    })

    test('returns null when no supplements scheduled and journal exists', () => {
      const suggestions: SupplementSuggestion[] = [
        { name: 'Creatine', defaultDosage: '5g' }, // no schedule
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Entry',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
        },
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).toBeNull()
    })

    test('uses last-taken logic for every_other_day, matching the on-screen chips', () => {
      const suggestions: SupplementSuggestion[] = [
        {
          name: 'Test E',
          defaultDosage: '250mg',
          schedule: 'every_other_day',
          // Anchor says due on the 6th; the journal says it was taken on the 5th.
          scheduleStartDate: '2026-07-06',
        },
      ]
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 9, 0)) as any,
          supplements: [{ name: 'Test E', dosage: '250mg' }],
        },
        {
          id: '2',
          note: 'Today',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
        },
      ]

      const result = buildBedtimeReminderBody(
        suggestions,
        entries,
        new Date(2026, 6, 6),
      )
      expect(result).toBeNull()
    })
  })

  describe('buildBedtimeReminderBody with rollover', () => {
    // A dose logged at 1 AM Tuesday belongs to journal day Monday. The evening
    // reminder for Tuesday must therefore still list it as missing — with a
    // calendar-day boundary it counted as "taken today" and the reminder went
    // silent while the journal screen still showed it as missing.
    const doseAt1AMTuesday: JournalEntry = {
      id: '1',
      note: 'Late dose',
      date: makeTimestamp(new Date(2026, 6, 7, 1, 0)) as any,
      supplements: [{ name: 'Creatine', dosage: '5g' }],
    }
    const suggestions: SupplementSuggestion[] = [
      { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
    ]

    test("Tuesday evening still reports the dose missing when it belongs to Monday's journal day", () => {
      const result = buildBedtimeReminderBody(
        suggestions,
        [doseAt1AMTuesday],
        new Date(2026, 6, 7, 19, 0),
        7,
      )
      expect(result?.body).toContain('Creatine')
    })

    test('the calendar-day default counts the 1 AM dose toward Tuesday', () => {
      const result = buildBedtimeReminderBody(
        suggestions,
        [doseAt1AMTuesday],
        new Date(2026, 6, 7, 19, 0),
      )
      expect(result?.body ?? '').not.toContain('Creatine')
    })

    test("Monday evening does not yet know about Monday's later 1 AM dose", () => {
      // Sanity check on attribution: at Monday 19:00 the dose has not happened
      // yet, so it is still missing for journal day Monday.
      const result = buildBedtimeReminderBody(
        suggestions,
        [],
        new Date(2026, 6, 6, 19, 0),
        7,
      )
      expect(result?.body).toContain('Creatine')
    })
  })

  describe('buildSupplementReminderSignature', () => {
    const today = new Date(2026, 6, 6)

    test('changes when a supplement is added to an existing entry', () => {
      const before: JournalEntry[] = [
        {
          id: '1',
          note: 'Logged supplements',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]
      const after: JournalEntry[] = [
        {
          ...before[0],
          supplements: [
            { name: 'Creatine', dosage: '5g' },
            { name: 'Magnesium', dosage: '400mg' },
          ],
        },
      ]

      expect(before.length).toBe(after.length)
      expect(buildSupplementReminderSignature(before, today)).not.toBe(
        buildSupplementReminderSignature(after, today),
      )
    })

    test('changes when a second dose of the same supplement is logged', () => {
      const once: JournalEntry[] = [
        {
          id: '1',
          note: 'Logged supplements',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]
      const twice: JournalEntry[] = [
        {
          ...once[0],
          supplements: [
            { name: 'Creatine', dosage: '5g' },
            { name: 'Creatine', dosage: '5g' },
          ],
        },
      ]

      expect(buildSupplementReminderSignature(once, today)).not.toBe(
        buildSupplementReminderSignature(twice, today),
      )
    })

    test('changes when the day gains its first journal entry', () => {
      const entry: JournalEntry[] = [
        {
          id: '1',
          note: 'Entry',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
        },
      ]

      expect(buildSupplementReminderSignature([], today)).not.toBe(
        buildSupplementReminderSignature(entry, today),
      )
    })

    test('tracks yesterday, which every_other_day is decided from', () => {
      const before: JournalEntry[] = [
        {
          id: '1',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 9, 0)) as any,
          supplements: [],
        },
      ]
      const after: JournalEntry[] = [
        {
          ...before[0],
          supplements: [{ name: 'Test E', dosage: '250mg' }],
        },
      ]

      expect(buildSupplementReminderSignature(before, today)).not.toBe(
        buildSupplementReminderSignature(after, today),
      )
    })

    test('ignores entries outside today and yesterday', () => {
      const entries: JournalEntry[] = [
        {
          id: '1',
          note: 'Last week',
          date: makeTimestamp(new Date(2026, 5, 30, 9, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]

      expect(buildSupplementReminderSignature(entries, today)).toBe('')
    })

    test('is stable across re-sorting and entry object identity', () => {
      const a: JournalEntry[] = [
        {
          id: '1',
          note: 'Today',
          date: makeTimestamp(new Date(2026, 6, 6, 9, 0)) as any,
          supplements: [
            { name: 'Magnesium', dosage: '400mg' },
            { name: 'Creatine', dosage: '5g' },
          ],
        },
        {
          id: '2',
          note: 'Yesterday',
          date: makeTimestamp(new Date(2026, 6, 5, 9, 0)) as any,
          supplements: [],
        },
      ]
      const b: JournalEntry[] = [
        { ...a[1], supplements: [] },
        {
          ...a[0],
          supplements: [
            { name: 'Creatine', dosage: '5g' },
            { name: 'Magnesium', dosage: '400mg' },
          ],
        },
      ]

      expect(buildSupplementReminderSignature(a, today)).toBe(
        buildSupplementReminderSignature(b, today),
      )
    })

    test('skips entries with a malformed date', () => {
      const entries: JournalEntry[] = [
        { id: '1', note: 'Broken', date: undefined as any },
      ]
      expect(buildSupplementReminderSignature(entries, today)).toBe('')
    })
  })

  describe('buildSupplementReminderSignature with rollover', () => {
    test('a 1 AM dose is keyed to the previous journal day', () => {
      const entries: JournalEntry[] = [
        {
          id: 'e1',
          note: 'Late dose',
          date: makeTimestamp(new Date(2026, 6, 7, 1, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        },
      ]
      const withRollover = buildSupplementReminderSignature(
        entries,
        new Date(2026, 6, 7, 19, 0),
        7,
      )
      const calendarDay = buildSupplementReminderSignature(
        entries,
        new Date(2026, 6, 7, 19, 0),
      )
      expect(withRollover).toContain('2026-07-06#e1')
      expect(calendarDay).toContain('2026-07-07#e1')
      expect(withRollover).not.toBe(calendarDay)
    })
  })

  describe('journal-day rollover (dayRolloverHour)', () => {
    // 1 AM on Tuesday, July 7 2026 — with a 7 AM wake-up boundary this is
    // still journal-day Monday, July 6.
    const tuesdayAt1AM = new Date(2026, 6, 7, 1, 0)
    const mondayKey = '2026-07-06'
    const tuesdayKey = '2026-07-07'

    describe('getJournalDayDate', () => {
      test('shifts times before the rollover hour to the previous day', () => {
        const adjusted = getJournalDayDate(tuesdayAt1AM, 7)
        expect(adjusted.getDate()).toBe(6)
        // Anchored to the rollover hour, not the original time-of-day. This is
        // what keeps the result out of the "before the rollover" range.
        expect(adjusted.getHours()).toBe(7)
      })

      test('is idempotent — re-applying it never shifts a second time', () => {
        for (const rolloverHour of [0, 1, 7, 12, 13, 22, 23]) {
          const once = getJournalDayDate(tuesdayAt1AM, rolloverHour)
          const twice = getJournalDayDate(once, rolloverHour)
          expect(getLocalDateKey(twice)).toBe(getLocalDateKey(once))
          expect(getJournalDateKey(once, rolloverHour)).toBe(
            getJournalDateKey(tuesdayAt1AM, rolloverHour),
          )
        }
      })

      test('stepping back one day from the result lands on the previous journal day', () => {
        // This is exactly the arithmetic the every_other_day branch performs.
        const yesterday = getJournalDayDate(tuesdayAt1AM, 7)
        yesterday.setDate(yesterday.getDate() - 1)
        expect(getJournalDateKey(yesterday, 7)).toBe('2026-07-05')
      })

      test('leaves times at or after the rollover hour untouched', () => {
        expect(getJournalDayDate(new Date(2026, 6, 7, 7, 0), 7).getDate()).toBe(
          7,
        )
        expect(
          getJournalDayDate(new Date(2026, 6, 7, 23, 30), 7).getDate(),
        ).toBe(7)
      })

      test('rolloverHour 0 never shifts (calendar-day boundary)', () => {
        expect(getJournalDayDate(tuesdayAt1AM, 0).getDate()).toBe(7)
      })

      test('crosses a month boundary', () => {
        const aug1At2AM = new Date(2026, 7, 1, 2, 0)
        const adjusted = getJournalDayDate(aug1At2AM, 7)
        expect(adjusted.getMonth()).toBe(6) // July
        expect(adjusted.getDate()).toBe(31)
      })

      test('crosses a year boundary', () => {
        const jan1At3AM = new Date(2027, 0, 1, 3, 0)
        const adjusted = getJournalDayDate(jan1At3AM, 7)
        expect(adjusted.getFullYear()).toBe(2026)
        expect(adjusted.getMonth()).toBe(11)
        expect(adjusted.getDate()).toBe(31)
      })

      test('does not mutate the input date', () => {
        const input = new Date(2026, 6, 7, 1, 0)
        getJournalDayDate(input, 7)
        expect(input.getDate()).toBe(7)
      })
    })

    describe('getJournalDateKey', () => {
      test('maps pre-rollover times to the previous day key', () => {
        expect(getJournalDateKey(tuesdayAt1AM, 7)).toBe(mondayKey)
      })

      test('maps post-rollover times to the same-day key', () => {
        expect(getJournalDateKey(new Date(2026, 6, 7, 10, 0), 7)).toBe(
          tuesdayKey,
        )
      })

      test('keeps the zero-padded YYYY-MM-DD format', () => {
        expect(getJournalDateKey(new Date(2026, 0, 5, 1, 0), 7)).toBe(
          '2026-01-04',
        )
      })
    })

    describe('journalDayKeyToDate', () => {
      test('round-trips a journal-day key for every rollover hour', () => {
        for (const rolloverHour of [0, 1, 7, 12, 13, 22, 23]) {
          const rebuilt = journalDayKeyToDate(mondayKey, rolloverHour)
          expect(getJournalDateKey(rebuilt, rolloverHour)).toBe(mondayKey)
        }
      })

      test('preserves the calendar date it names', () => {
        const rebuilt = journalDayKeyToDate('2026-07-06', 7)
        expect(rebuilt.getFullYear()).toBe(2026)
        expect(rebuilt.getMonth()).toBe(6)
        expect(rebuilt.getDate()).toBe(6)
      })

      test('a midnight rebuild would land on the previous journal day', () => {
        // Guards the bug this helper exists to prevent: rebuilding a key as
        // new Date(y, m, d) puts it before the rollover, so it shifts again.
        expect(getJournalDateKey(new Date(2026, 6, 6), 7)).toBe('2026-07-05')
        expect(getJournalDateKey(journalDayKeyToDate('2026-07-06', 7), 7)).toBe(
          '2026-07-06',
        )
      })
    })

    describe('entry attribution', () => {
      // Entry logged at 1 AM Tuesday belongs to journal-day Monday.
      const entryAt1AM: JournalEntry = {
        id: '1',
        note: 'Late night log',
        date: makeTimestamp(tuesdayAt1AM) as any,
        supplements: [{ name: 'Creatine', dosage: '5g' }],
      }

      test('getSupplementIntakeCountOnDate counts pre-rollover entries toward the previous day', () => {
        expect(
          getSupplementIntakeCountOnDate(
            'Creatine',
            new Date(2026, 6, 6, 12, 0),
            [entryAt1AM],
            7,
          ),
        ).toBe(1)
        expect(
          getSupplementIntakeCountOnDate(
            'Creatine',
            new Date(2026, 6, 7, 12, 0),
            [entryAt1AM],
            7,
          ),
        ).toBe(0)
      })

      test('hasJournalEntryForDate finds a pre-rollover entry on the previous day', () => {
        expect(
          hasJournalEntryForDate([entryAt1AM], new Date(2026, 6, 6, 12, 0), 7),
        ).toBe(true)
        expect(
          hasJournalEntryForDate([entryAt1AM], new Date(2026, 6, 7, 12, 0), 7),
        ).toBe(false)
      })

      test('a late-night query attributes the entry to its own journal day', () => {
        // Asking at 1 AM Tuesday "was this taken today?" must see the entry.
        expect(
          getSupplementIntakeCountOnDate(
            'Creatine',
            tuesdayAt1AM,
            [entryAt1AM],
            7,
          ),
        ).toBe(1)
        expect(hasJournalEntryForDate([entryAt1AM], tuesdayAt1AM, 7)).toBe(true)
      })

      test('getUntakenSupplements treats a pre-rollover dose as taken for the current journal day', () => {
        const due: SupplementSuggestion[] = [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ]
        // entryAt1AM (Tuesday 1 AM) is the same journal day as the query.
        expect(
          getUntakenSupplements(due, [entryAt1AM], tuesdayAt1AM, 7),
        ).toEqual([])
      })

      test('getSupplementsTakenOnDate attributes pre-rollover entries to the previous day', () => {
        expect(
          getSupplementsTakenOnDate(
            [entryAt1AM],
            new Date(2026, 6, 6, 12, 0),
            7,
          ),
        ).toEqual(['creatine'])
        expect(
          getSupplementsTakenOnDate(
            [entryAt1AM],
            new Date(2026, 6, 7, 12, 0),
            7,
          ),
        ).toEqual([])
      })
    })

    describe('isSupplementDueOnDate with rollover', () => {
      test('specific_days uses the journal-day weekday', () => {
        // Monday = weekday 1. At 1 AM Tuesday it is still journal-day Monday.
        const supp: SupplementSuggestion = {
          name: 'Creatine',
          defaultDosage: '5g',
          schedule: 'specific_days',
          scheduleDays: [1],
        }
        expect(isSupplementDueOnDate(supp, tuesdayAt1AM, [], 7)).toBe(true)
        // Without rollover it would be Tuesday (weekday 2) → not due.
        expect(isSupplementDueOnDate(supp, tuesdayAt1AM, [], 0)).toBe(false)
      })

      test('every_other_day compares against the previous journal day', () => {
        const supp: SupplementSuggestion = {
          name: 'Creatine',
          defaultDosage: '5g',
          schedule: 'every_other_day',
        }
        // Taken at 1 AM Tuesday = journal-day Monday. Asking at 9 AM Tuesday
        // (journal-day Tuesday): taken "yesterday" → not due.
        const takenEntry: JournalEntry = {
          id: '1',
          note: 'dose',
          date: makeTimestamp(tuesdayAt1AM) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        }
        expect(
          isSupplementDueOnDate(
            supp,
            new Date(2026, 6, 7, 9, 0),
            [takenEntry],
            7,
          ),
        ).toBe(false)
        // With calendar-day keys the entry is "today", so it would look due.
        expect(
          isSupplementDueOnDate(
            supp,
            new Date(2026, 6, 7, 9, 0),
            [takenEntry],
            0,
          ),
        ).toBe(true)
      })

      test('every_other_day queried before the rollover hour compares against the previous journal day', () => {
        const supp: SupplementSuggestion = {
          name: 'Creatine',
          defaultDosage: '5g',
          schedule: 'every_other_day',
        }
        // Asking at 1 AM Tuesday = journal-day Monday, so "yesterday" is
        // journal-day Sunday July 5. A dose logged Sunday evening means it is
        // NOT due. Before the anchor fix this compared against July 4 and
        // wrongly reported the supplement as due.
        const takenSunday: JournalEntry = {
          id: '1',
          note: 'dose',
          date: makeTimestamp(new Date(2026, 6, 5, 20, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        }
        expect(
          isSupplementDueOnDate(supp, tuesdayAt1AM, [takenSunday], 7),
        ).toBe(false)

        // A dose two journal days back must not suppress it.
        const takenSaturday: JournalEntry = {
          id: '2',
          note: 'dose',
          date: makeTimestamp(new Date(2026, 6, 4, 20, 0)) as any,
          supplements: [{ name: 'Creatine', dosage: '5g' }],
        }
        expect(
          isSupplementDueOnDate(supp, tuesdayAt1AM, [takenSaturday], 7),
        ).toBe(true)
      })

      test('scheduleActivatedDate gate uses the journal-day key', () => {
        const supp: SupplementSuggestion = {
          name: 'Creatine',
          defaultDosage: '5g',
          schedule: 'daily',
          scheduleActivatedDate: tuesdayKey,
        }
        // 1 AM Tuesday is still journal-day Monday, before activation.
        expect(isSupplementDueOnDate(supp, tuesdayAt1AM, [], 7)).toBe(false)
        // After wake-up it is journal-day Tuesday → due.
        expect(
          isSupplementDueOnDate(supp, new Date(2026, 6, 7, 9, 0), [], 7),
        ).toBe(true)
      })
    })
  })
})
