import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Tag stored in notification data so reminder cleanup in notifications.ts
// can cancel its own notifications without killing a pending rest alert.
export const REST_END_NOTIFICATION_TYPE = 'rest-end'

let scheduledId: string | null = null
// Monotonic token so an in-flight schedule that lost the race to a newer
// schedule/cancel call doesn't resurrect a stale notification.
let opToken = 0

interface RestEndNotificationOptions {
  secondsFromNow: number
  exerciseName: string
  set: number
  totalSets: number
}

/**
 * Schedule a local notification for the moment the rest target is reached,
 * so the user gets a lock-screen alert even if Live Activities are disabled
 * or the phone is muted for voice cues. Replaces any previously scheduled
 * rest-end notification.
 */
export async function scheduleRestEndNotification({
  secondsFromNow,
  exerciseName,
  set,
  totalSets,
}: RestEndNotificationOptions) {
  if (Platform.OS === 'web') return
  const token = ++opToken

  await cancelPending()
  if (token !== opToken) return
  if (secondsFromNow <= 0) return

  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted' || token !== opToken) return

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Complete 💪',
        body: `Time for ${exerciseName} — Set ${set} of ${totalSets}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: REST_END_NOTIFICATION_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + secondsFromNow * 1000),
      },
    })

    if (token !== opToken) {
      // A newer schedule/cancel superseded this one while awaiting.
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      return
    }
    scheduledId = id
  } catch (error) {
    console.error('Failed to schedule rest-end notification:', error)
  }
}

export async function cancelRestEndNotification() {
  if (Platform.OS === 'web') return
  opToken++
  await cancelPending()
}

async function cancelPending() {
  if (!scheduledId) return
  const id = scheduledId
  scheduledId = null
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    // Already delivered or cancelled — nothing to do.
  }
}
