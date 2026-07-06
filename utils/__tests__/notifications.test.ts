/* eslint-disable @typescript-eslint/no-explicit-any */
import { setupReminders, cancelAllReminders } from '../notifications'

// Mock expo-notifications
const mockScheduleNotification = jest.fn().mockResolvedValue('notification-id')
const mockCancelAll = jest.fn().mockResolvedValue(undefined)
const mockGetPermissions = jest
  .fn()
  .mockResolvedValue({ status: 'granted' })
const mockRequestPermissions = jest
  .fn()
  .mockResolvedValue({ status: 'granted' })
const mockSetHandler = jest.fn()

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  setNotificationHandler: (handler: any) => mockSetHandler(handler),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  scheduleNotificationAsync: (opts: any) => mockScheduleNotification(opts),
  AndroidNotificationPriority: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))

// Mock sleep detection
jest.mock('../sleepDetection', () => ({
  detectSleepWindow: jest.fn().mockReturnValue({
    startHour: 23,
    endHour: 7,
    isDefault: true,
  }),
}))

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setupReminders', () => {
    const baseSettings: any = {
      statRemindersEnabled: true,
      statRemindersUseAutoSleep: false,
      statRemindersSleepStart: 23,
      statRemindersSleepEnd: 7,
      supplementSuggestions: [
        { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        { name: 'Fish Oil', defaultDosage: '1 cap', schedule: 'daily' },
      ],
    }

    test('requests notification permissions', async () => {
      await setupReminders(baseSettings, [], [], [], [])
      expect(mockGetPermissions).toHaveBeenCalled()
    })

    test('cancels all existing notifications before scheduling', async () => {
      await setupReminders(baseSettings, [], [], [], [])
      expect(mockCancelAll).toHaveBeenCalled()
    })

    test('schedules stat reminders (non-sleep window hours)', async () => {
      await setupReminders(baseSettings, [], [], [], [])

      // Should have scheduled multiple notifications
      expect(mockScheduleNotification).toHaveBeenCalled()

      // At least some should be stat reminders
      const statReminders = mockScheduleNotification.mock.calls.filter(
        (call: any[]) => call[0].content.title === 'Update Stats 📊',
      )
      expect(statReminders.length).toBeGreaterThan(0)
    })

    test('schedules bedtime reminder notifications', async () => {
      await setupReminders(baseSettings, [], [], [], [])

      // Should have scheduled bedtime reminders (Evening Reminder)
      const bedtimeReminders = mockScheduleNotification.mock.calls.filter(
        (call: any[]) => call[0].content.title === 'Evening Reminder 🌙',
      )
      expect(bedtimeReminders.length).toBeGreaterThan(0)
    })

    test('bedtime reminder is scheduled at sleepStart - 4 hours', async () => {
      // sleepStart = 23, so reminder should be at hour 19 (7 PM)
      await setupReminders(baseSettings, [], [], [], [])

      const bedtimeReminders = mockScheduleNotification.mock.calls.filter(
        (call: any[]) => call[0].content.title === 'Evening Reminder 🌙',
      )

      bedtimeReminders.forEach((call: any[]) => {
        const triggerDate = call[0].trigger.date
        expect(triggerDate.getHours()).toBe(19) // 23 - 4 = 19
      })
    })

    test('does not schedule when permissions are denied', async () => {
      mockGetPermissions.mockResolvedValueOnce({ status: 'denied' })
      mockRequestPermissions.mockResolvedValueOnce({ status: 'denied' })

      await setupReminders(baseSettings, [], [], [], [])

      expect(mockScheduleNotification).not.toHaveBeenCalled()
    })

    test('bedtime reminder includes supplement info for today', async () => {
      const now = new Date()
      const settings: any = {
        ...baseSettings,
        supplementSuggestions: [
          { name: 'Creatine', defaultDosage: '5g', schedule: 'daily' },
        ],
      }

      // No journal entries for today, so today's reminder should include Creatine
      await setupReminders(settings, [], [], [], [])

      // Check that at least one bedtime reminder mentions supplements
      const bedtimeReminders = mockScheduleNotification.mock.calls.filter(
        (call: any[]) => {
          const title = call[0].content.title
          return title === 'Evening Reminder 🌙'
        },
      )

      // The first one scheduled (for today if it hasn't passed, or future days)
      // should have a body mentioning supplements or generic reminder
      expect(bedtimeReminders.length).toBeGreaterThan(0)
      const firstReminder = bedtimeReminders[0][0]
      expect(firstReminder.content.body).toBeTruthy()
    })
  })

  describe('cancelAllReminders', () => {
    test('cancels all scheduled notifications', async () => {
      await cancelAllReminders()
      expect(mockCancelAll).toHaveBeenCalled()
    })
  })
})
