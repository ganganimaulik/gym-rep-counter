import * as Notifications from 'expo-notifications'
import { detectSleepWindow } from './sleepDetection'
import { WeightLog, CalorieLog, JournalEntry, WorkoutSet } from '../declarations'
import { Settings } from '../hooks/useData'

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
    console.log('Notification permissions not granted')
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

  // 6. Schedule future notifications
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
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: candidateDate },
        })
        scheduledCount++
      } catch (err) {
        console.error('Error scheduling notification', err)
      }
    }

    offsetHours += 4
  }

  console.log(`Successfully scheduled ${scheduledCount} notifications.`)
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
