import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { registerForPush, unregisterFromPush, setBadge } from "../src/lib/push"
import { registerPushToken, unregisterPushToken } from "../src/lib/api"
import { readPushToken, writePushToken } from "../src/lib/store"

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}))
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "project-1" } } }, easConfig: undefined },
}))
jest.mock("../src/lib/api", () => ({
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}))
jest.mock("../src/lib/store", () => ({
  readPushToken: jest.fn(),
  writePushToken: jest.fn(),
}))

const notifications = Notifications as unknown as Record<string, jest.Mock>
const constants = Constants as unknown as {
  expoConfig?: { extra?: { eas?: { projectId?: string } } }
  easConfig?: { projectId?: string }
}

// Registered once, when the module is imported: grab it before the mocks are cleared.
const foregroundHandler = notifications.setNotificationHandler.mock.calls[0][0] as {
  handleNotification: () => Promise<Record<string, boolean>>
}

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = "ios"
  constants.expoConfig = { extra: { eas: { projectId: "project-1" } } }
  constants.easConfig = undefined
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true })
  notifications.requestPermissionsAsync.mockResolvedValue({ granted: true })
  notifications.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" })
  notifications.setBadgeCountAsync.mockResolvedValue(true)
  ;(registerPushToken as jest.Mock).mockResolvedValue(undefined)
  ;(unregisterPushToken as jest.Mock).mockResolvedValue(undefined)
  ;(readPushToken as jest.Mock).mockResolvedValue(null)
})

describe("registerForPush", () => {
  it("registers the Expo token with the API and remembers it", async () => {
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(true)

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-1" })
    expect(registerPushToken).toHaveBeenCalledWith("u1", "ExponentPushToken[abc]", "fr", "jwt")
    expect(writePushToken).toHaveBeenCalledWith("ExponentPushToken[abc]")
  })

  it("does not ask again when the permission is already granted", async () => {
    await registerForPush("u1", "jwt", "fr")
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it("asks for the permission, and registers once it is given", async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true })
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(true)
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled()
  })

  it("gives up when the user refuses", async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true })
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: false })
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(false)
    expect(registerPushToken).not.toHaveBeenCalled()
  })

  it("does not nag a user who already said no for good", async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false })
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(false)
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it("creates the notification channel on Android first", async () => {
    Platform.OS = "android"
    await registerForPush("u1", "jwt", "fr")
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", {
      name: "default",
      importance: 3,
    })
  })

  it("creates no channel on iOS", async () => {
    await registerForPush("u1", "jwt", "fr")
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled()
  })

  it("falls back to the EAS config for the project id", async () => {
    constants.expoConfig = undefined
    constants.easConfig = { projectId: "project-2" }
    await registerForPush("u1", "jwt", "fr")
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-2" })
  })

  it("is a no-op when the build has no EAS project", async () => {
    constants.expoConfig = { extra: {} }
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(false)
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it("never throws: a simulator or a network failure just means no push", async () => {
    notifications.getExpoPushTokenAsync.mockRejectedValue(new Error("simulator"))
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(false)

    notifications.getExpoPushTokenAsync.mockResolvedValue({ data: "T" })
    ;(registerPushToken as jest.Mock).mockRejectedValue(new Error("500"))
    await expect(registerForPush("u1", "jwt", "fr")).resolves.toBe(false)
  })
})

describe("unregisterFromPush", () => {
  it("unregisters the remembered token and forgets it", async () => {
    ;(readPushToken as jest.Mock).mockResolvedValue("ExponentPushToken[abc]")
    await unregisterFromPush("u1", "jwt")

    expect(unregisterPushToken).toHaveBeenCalledWith("u1", "ExponentPushToken[abc]", "jwt")
    expect(writePushToken).toHaveBeenCalledWith(null)
  })

  it("calls nothing when this device never registered", async () => {
    await unregisterFromPush("u1", "jwt")
    expect(unregisterPushToken).not.toHaveBeenCalled()
    expect(writePushToken).toHaveBeenCalledWith(null)
  })

  it("never throws", async () => {
    ;(readPushToken as jest.Mock).mockResolvedValue("T")
    ;(unregisterPushToken as jest.Mock).mockRejectedValue(new Error("offline"))
    await expect(unregisterFromPush("u1", "jwt")).resolves.toBeUndefined()
  })
})

describe("setBadge", () => {
  it("sets the icon badge", async () => {
    await setBadge(7)
    expect(notifications.setBadgeCountAsync).toHaveBeenCalledWith(7)
  })

  it("never throws", async () => {
    notifications.setBadgeCountAsync.mockRejectedValue(new Error("no permission"))
    await expect(setBadge(7)).resolves.toBeUndefined()
  })
})

describe("the foreground handler", () => {
  it("shows a notification received while the app is open, with the badge", async () => {
    await expect(foregroundHandler.handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    })
  })
})
