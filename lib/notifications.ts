import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configura il comportamento delle notifiche quando l'app è in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rest-timer', {
      name: 'Timer recupero',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleRestTimerNotification(
  seconds: number,
  exerciseName: string,
  setLabel: string
): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    // Cancella notifiche precedenti del timer
    await cancelRestTimerNotification();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 Recupero completato!',
        body: `${exerciseName} · ${setLabel} — Pronto per la prossima serie!`,
        sound: 'default',
        data: { type: 'rest-timer' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: seconds,
      },
    });

    return id;
  } catch {
    return null;
  }
}

export async function cancelRestTimerNotification(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const restTimerNotifications = scheduled.filter(
      (n) => n.content.data?.type === 'rest-timer'
    );
    await Promise.all(
      restTimerNotifications.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {}
}