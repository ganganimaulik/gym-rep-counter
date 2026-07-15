import { Platform } from 'react-native'
import {
  scheduleRestEndNotification,
  cancelRestEndNotification,
  REST_END_NOTIFICATION_TYPE,
} from '../restNotification'

const mockScheduleNotification = jest.fn().mockResolvedValue('rest-notif-1')
const mockCancelScheduled = jest.fn().mockResolvedValue(undefined)
const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' })

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  cancelScheduledNotificationAsync: (id: string) => mockCancelScheduled(id),
  scheduleNotificationAsync: (opts: any) => mockScheduleNotification(opts),
  AndroidNotificationPriority: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))

const baseOptions = {
  secondsFromNow: 90,
  exerciseName: 'Bench Press',
  set: 3,
  totalSets: 4,
}

describe('restNotification', () => {
  let originalOS: string

  beforeEach(async () => {
    // Reset module-level scheduled id between tests
    await cancelRestEndNotification()
    jest.clearAllMocks()
    mockScheduleNotification.mockResolvedValue('rest-notif-1')
    mockGetPermissions.mockResolvedValue({ status: 'granted' })
    originalOS = Platform.OS
  })

  afterEach(() => {
    Platform.OS = originalOS as any
  })

  test('schedules a tagged notification at the rest target time', async () => {
    const before = Date.now()
    await scheduleRestEndNotification(baseOptions)

    expect(mockScheduleNotification).toHaveBeenCalledTimes(1)
    const opts = mockScheduleNotification.mock.calls[0][0]
    expect(opts.content.data.type).toBe(REST_END_NOTIFICATION_TYPE)
    expect(opts.content.body).toContain('Bench Press')
    expect(opts.content.body).toContain('Set 3 of 4')

    const triggerTime = opts.trigger.date.getTime()
    expect(triggerTime).toBeGreaterThanOrEqual(before + 90 * 1000)
    expect(triggerTime).toBeLessThanOrEqual(Date.now() + 90 * 1000)
  })

  test('does not schedule when the rest target has already passed', async () => {
    await scheduleRestEndNotification({ ...baseOptions, secondsFromNow: -5 })
    expect(mockScheduleNotification).not.toHaveBeenCalled()
  })

  test('does not schedule without notification permission', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied' })
    await scheduleRestEndNotification(baseOptions)
    expect(mockScheduleNotification).not.toHaveBeenCalled()
  })

  test('replaces a previously scheduled notification', async () => {
    await scheduleRestEndNotification(baseOptions)
    await scheduleRestEndNotification({ ...baseOptions, set: 4 })

    expect(mockCancelScheduled).toHaveBeenCalledWith('rest-notif-1')
    expect(mockScheduleNotification).toHaveBeenCalledTimes(2)
  })

  test('cancelRestEndNotification cancels the pending notification', async () => {
    await scheduleRestEndNotification(baseOptions)
    await cancelRestEndNotification()
    expect(mockCancelScheduled).toHaveBeenCalledWith('rest-notif-1')
  })

  test('cancelRestEndNotification is a no-op when nothing is scheduled', async () => {
    await cancelRestEndNotification()
    expect(mockCancelScheduled).not.toHaveBeenCalled()
  })

  test('no-ops on web', async () => {
    Platform.OS = 'web' as any
    await scheduleRestEndNotification(baseOptions)
    expect(mockScheduleNotification).not.toHaveBeenCalled()
  })
})
