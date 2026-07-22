import {
  toJsDate,
  getDateRangeBounds,
  filterLogsByDateRange,
  formatLogsForExport,
  copyLogsToClipboard,
} from '../exportUtils'
import * as Clipboard from 'expo-clipboard'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}))

describe('exportUtils', () => {
  const fixedNow = new Date(2026, 6, 23, 12, 0, 0) // July 23, 2026

  describe('toJsDate', () => {
    test('handles null/undefined', () => {
      expect(toJsDate(null)).toBeNull()
      expect(toJsDate(undefined)).toBeNull()
    })

    test('handles Date instance', () => {
      const d = new Date()
      expect(toJsDate(d)).toBe(d)
    })

    test('handles Firestore timestamp-like object with toDate()', () => {
      const d = new Date(2026, 5, 15)
      const mockTimestamp = { toDate: () => d }
      expect(toJsDate(mockTimestamp)).toBe(d)
    })

    test('handles serialized timestamp object with seconds', () => {
      const seconds = 1700000000
      const result = toJsDate({ seconds, nanoseconds: 0 })
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBe(seconds * 1000)
    })

    test('handles date string', () => {
      const iso = '2026-07-01T10:00:00.000Z'
      const result = toJsDate(iso)
      expect(result).toBeInstanceOf(Date)
      expect(result?.toISOString()).toBe(iso)
    })
  })

  describe('getDateRangeBounds', () => {
    test('calculates 1m bounds accurately', () => {
      const bounds = getDateRangeBounds('1m', null, null, fixedNow)
      expect(bounds.endDate.getFullYear()).toBe(2026)
      expect(bounds.endDate.getMonth()).toBe(6)
      expect(bounds.endDate.getDate()).toBe(23)
      expect(bounds.endDate.getHours()).toBe(23)
      expect(bounds.endDate.getMinutes()).toBe(59)

      // 1 month before July is June
      expect(bounds.startDate.getMonth()).toBe(5)
      expect(bounds.startDate.getHours()).toBe(0)
    })

    test('calculates 3m bounds accurately', () => {
      const bounds = getDateRangeBounds('3m', null, null, fixedNow)
      // 3 months before July is April (index 3)
      expect(bounds.startDate.getMonth()).toBe(3)
    })

    test('calculates 6m bounds accurately', () => {
      const bounds = getDateRangeBounds('6m', null, null, fixedNow)
      // 6 months before July is January (index 0)
      expect(bounds.startDate.getMonth()).toBe(0)
    })

    test('calculates custom bounds accurately', () => {
      const customStart = new Date(2026, 0, 1)
      const customEnd = new Date(2026, 0, 15)
      const bounds = getDateRangeBounds(
        'custom',
        customStart,
        customEnd,
        fixedNow,
      )
      expect(bounds.startDate.getDate()).toBe(1)
      expect(bounds.endDate.getDate()).toBe(15)
      expect(bounds.endDate.getHours()).toBe(23)
    })
  })

  describe('filterLogsByDateRange', () => {
    const bounds = {
      startDate: new Date(2026, 6, 1, 0, 0, 0),
      endDate: new Date(2026, 6, 31, 23, 59, 59),
    }

    const journalEntries: any[] = [
      {
        id: '1',
        note: 'Inside range note',
        date: { toDate: () => new Date(2026, 6, 10, 10, 0) },
        supplements: [{ name: 'Creatine', dosage: '5g' }],
      },
      {
        id: '2',
        note: 'Outside range note',
        date: { toDate: () => new Date(2026, 5, 1, 10, 0) },
      },
    ]

    const weightLogs: any[] = [
      {
        id: 'w1',
        weight: 75,
        date: { toDate: () => new Date(2026, 6, 5, 8, 0) },
      },
      {
        id: 'w2',
        weight: 76,
        date: { toDate: () => new Date(2026, 4, 1, 8, 0) },
      },
    ]

    const calorieLogs: any[] = [
      {
        id: 'c1',
        calories: 2500,
        date: { toDate: () => new Date(2026, 6, 5, 20, 0) },
      },
    ]

    test('filters logs within date range', () => {
      const result = filterLogsByDateRange(
        journalEntries,
        weightLogs,
        calorieLogs,
        bounds,
      )

      expect(result.journalEntries).toHaveLength(1)
      expect(result.journalEntries[0].id).toBe('1')
      expect(result.weightLogs).toHaveLength(1)
      expect(result.weightLogs[0].id).toBe('w1')
      expect(result.calorieLogs).toHaveLength(1)
      expect(result.supplements).toHaveLength(1)
      expect(result.supplements[0].supplement.name).toBe('Creatine')
    })
  })

  describe('formatLogsForExport', () => {
    test('formats logs cleanly into text report', () => {
      const bounds = {
        startDate: new Date(2026, 6, 1, 0, 0, 0),
        endDate: new Date(2026, 6, 31, 23, 59, 59),
      }

      const filteredData = {
        journalEntries: [
          {
            id: '1',
            note: 'Felt strong today',
            date: { toDate: () => new Date(2026, 6, 10, 10, 0) },
            supplements: [{ name: 'Creatine', dosage: '5g' }],
          },
        ],
        weightLogs: [
          {
            id: 'w1',
            weight: 75.5,
            date: { toDate: () => new Date(2026, 6, 10, 8, 0) },
          },
        ],
        calorieLogs: [
          {
            id: 'c1',
            calories: 2600,
            date: { toDate: () => new Date(2026, 6, 10, 20, 0) },
          },
        ],
        supplements: [
          {
            date: new Date(2026, 6, 10, 10, 0),
            supplement: { name: 'Creatine', dosage: '5g' },
          },
        ],
      }

      const output = formatLogsForExport(filteredData as any, bounds)
      expect(output).toContain('HEALTH & JOURNAL EXPORT')
      expect(output).toContain('--- WEIGHT LOGS (1) ---')
      expect(output).toContain('75.5 kg')
      expect(output).toContain('--- CALORIE LOGS (1) ---')
      expect(output).toContain('2600 kcal')
      expect(output).toContain('--- JOURNAL & SUPPLEMENT LOGS (1) ---')
      expect(output).toContain('Felt strong today')
      expect(output).toContain('Supplements: Creatine (5g)')
    })
  })

  describe('copyLogsToClipboard', () => {
    test('calls Clipboard.setStringAsync', async () => {
      const success = await copyLogsToClipboard('Sample text')
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Sample text')
      expect(success).toBe(true)
    })
  })
})
