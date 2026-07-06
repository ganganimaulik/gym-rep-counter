import * as Notifications from 'expo-notifications'
import { detectSleepWindow } from './sleepDetection'
import {
  WeightLog,
  CalorieLog,
  JournalEntry,
  WorkoutSet,
} from '../declarations'
import { Settings } from '../hooks/useData'
import { buildBedtimeReminderBody } from './supplementSchedule'

export async function setupReminders(
  settings: Settings,
  weightLogs: WeightLog[],
  calorieLogs: CalorieLog[],
  journalEntries: JournalEntry[],
  workoutHistory: WorkoutSet[],
) {
  // 1. Check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return
  }

  // 2. Configure foreground handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  // 3. Cancel existing notifications
  await Notifications.cancelAllScheduledNotificationsAsync()

  // 4. Get sleep window
  let sleepStart = settings.statRemindersSleepStart ?? 23
  let sleepEnd = settings.statRemindersSleepEnd ?? 7

  if (settings.statRemindersUseAutoSleep ?? true) {
    const sleepWindow = detectSleepWindow(
      weightLogs,
      calorieLogs,
      journalEntries,
      workoutHistory,
    )
    sleepStart = sleepWindow.startHour
    sleepEnd = sleepWindow.endHour
  }

  const isInSleepWindow = (date: Date) => {
    const hour = date.getHours()
    if (sleepStart <= sleepEnd) {
      return hour >= sleepStart && hour < sleepEnd
    } else {
      // Wrap-around case (e.g. 23:00 to 07:00)
      return hour >= sleepStart || hour < sleepEnd
    }
  }

  // 5. Find the last time the user logged stats
  let lastLogTime = 0
  const getLogTime = (dateField: any) => {
    if (!dateField) return 0
    return typeof dateField.toMillis === 'function'
      ? dateField.toMillis()
      : dateField.seconds
        ? dateField.seconds * 1000
        : new Date(dateField).getTime()
  }

  weightLogs.forEach((l) => {
    lastLogTime = Math.max(lastLogTime, getLogTime(l.date))
  })
  calorieLogs.forEach((l) => {
    lastLogTime = Math.max(lastLogTime, getLogTime(l.date))
  })
  journalEntries.forEach((l) => {
    lastLogTime = Math.max(lastLogTime, getLogTime(l.date))
  })
  workoutHistory.forEach((l) => {
    lastLogTime = Math.max(lastLogTime, getLogTime(l.date || l.startTime))
  })

  // 6. Schedule future stat reminder notifications
  const now = Date.now()
  let baseTime = now
  if (lastLogTime > 0 && now - lastLogTime < 4 * 60 * 60 * 1000) {
    baseTime = lastLogTime
  }

  let scheduledCount = 0
  const targetCount = 48 // Schedule 48 notifications (approx 8-10 waking days)
  let offsetHours = 4

  while (scheduledCount < targetCount && offsetHours < 240) {
    const candidateDate = new Date(baseTime + offsetHours * 60 * 60 * 1000)

    if (!isInSleepWindow(candidateDate)) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Update Stats 📊',
            body: 'Keep up the great work! Take a moment to log your weight, calories, or journal entries for today.',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: candidateDate,
          },
        })
        scheduledCount++
      } catch (err) {
        console.error('Error scheduling notification', err)
      }
    }

    offsetHours += 4
  }

  // 7. Schedule bedtime supplement/journal reminders
  await scheduleBedtimeReminders(
    sleepStart,
    settings.supplementSuggestions || [],
    journalEntries,
  )
}

/**
 * Schedule bedtime reminder notifications for the next 10 days.
 * Each notification fires 4 hours before the configured sleep start time
 * and includes untaken supplements and journal entry reminders.
 */
async function scheduleBedtimeReminders(
  sleepStartHour: number,
  supplementSuggestions: NonNullable<Settings['supplementSuggestions']>,
  journalEntries: JournalEntry[],
): Promise<number> {
  // If no supplements have schedules set, we still remind about journal entries
  const reminderHour = ((sleepStartHour - 4) + 24) % 24

  const now = new Date()
  let scheduledCount = 0
  const daysToSchedule = 10

  for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + dayOffset)
    targetDate.setHours(reminderHour, 0, 0, 0)

    // Skip if this time has already passed
    if (targetDate.getTime() <= now.getTime()) {
      continue
    }

    // Build the notification content for this specific day
    const reminderContent = buildBedtimeReminderBody(
      supplementSuggestions,
      journalEntries,
      targetDate,
    )

    // For future days beyond today, we can't know what supplements will
    // be taken, so just schedule a generic reminder
    const content =
      dayOffset === 0 && reminderContent
        ? {
            title: reminderContent.title,
            body: reminderContent.body,
          }
        : {
            title: 'Evening Reminder 🌙',
            body: '💊 Check your supplements & 📓 make a journal entry before bed!',
          }

    // Skip today's reminder if nothing to remind about
    if (dayOffset === 0 && !reminderContent) {
      continue
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...content,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      })
      scheduledCount++
    } catch (err) {
      console.error('Error scheduling bedtime reminder', err)
    }
  }

  return scheduledCount
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
