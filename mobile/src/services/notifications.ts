import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Local (on-device) scheduled reminder notification. Does not require a
 * push token, EAS project, or network access — fires from the device's own
 * OS scheduler at the given date.
 */
export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  dueDate: string,
): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const date = new Date(dueDate);
  if (date.getTime() <= Date.now()) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Pet reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return Notifications.scheduleNotificationAsync({
    identifier: reminderId,
    content: {
      title: 'PetOLife reminder',
      body: title,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderId);
}
