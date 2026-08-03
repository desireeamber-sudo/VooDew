// Wraps expo-notifications so screens don't need to know about permission
// requests, handler config, or trigger formatting.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedules a local reminder for a specific future date/time.
 * @param {string} title
 * @param {string} body
 * @param {Date} date
 * @returns {Promise<string|null>} the OS notification identifier, or null if permission was denied
 */
export async function scheduleLocalReminder(title, body, date) {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "VooDew reminders",
      importance: Notifications.AndroidImportance.HIGH
    });
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: date
  });

  return identifier;
}

export async function cancelLocalReminder(identifier) {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}
