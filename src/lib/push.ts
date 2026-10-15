import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { registerPushToken, unregisterPushToken } from "@/lib/api"
import { readPushToken, writePushToken } from "@/lib/store"

// A notification received while the app is open is still shown, and carries the
// unread count to the icon.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
})

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  return (await Notifications.requestPermissionsAsync()).granted
}

/**
 * Asks for the permission, then registers this device's Expo push token with the
 * API so it receives "new items" notifications. Returns whether the device is
 * registered. Anything missing (permission refused, a simulator, no EAS project
 * configured in a build) simply means no push: never an error for the user.
 */
export async function registerForPush(
  userId: string,
  authToken: string,
  lang: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      // Android 13+ asks for the permission only once a channel exists.
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
    if (!(await ensurePermission())) return false

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) return false

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    await registerPushToken(userId, data, lang, authToken)
    await writePushToken(data)
    return true
  } catch {
    return false
  }
}

/** Stops the notifications for this device (switch turned off, or signing out). */
export async function unregisterFromPush(userId: string, authToken: string): Promise<void> {
  try {
    const pushToken = await readPushToken()
    if (pushToken) await unregisterPushToken(userId, pushToken, authToken)
    await writePushToken(null)
  } catch {
    /* the API drops a dead token by itself the next time it pushes */
  }
}

/** The unread count shown on the app icon. */
export async function setBadge(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count)
  } catch {
    /* no permission, or a launcher without badges */
  }
}
