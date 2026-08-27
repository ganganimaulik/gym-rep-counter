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
})
