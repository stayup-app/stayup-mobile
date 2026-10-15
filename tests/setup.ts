export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
}

/** Rendered in place of <Redirect />: we inspect its props to verify redirects. */
export const mockRedirect = jest.fn(() => null)

const mockState: { params: Record<string, string> } = { params: {} }

export function setMockParams(params: Record<string, string>) {
  mockState.params = params
}

/** Target of the redirect triggered during render, or null. */
export function redirectedTo(): string | null {
  const call = mockRedirect.mock.calls[0] as unknown as [{ href: string }] | undefined
  return call ? call[0].href : null
}

jest.mock("expo-router", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null

  /**
   * Renders the icon declared in the tab options, so that the screens'
   * `tabBarIcon` callbacks are actually run by the tests.
   */
  const TabScreen = ({
    options,
  }: {
    options?: { tabBarIcon?: (p: { color: string; size: number }) => React.ReactNode }
  }) => options?.tabBarIcon?.({ color: "#6366f1", size: 24 }) ?? null

  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockState.params,
    Redirect: mockRedirect,
    Link: passthrough,
    Stack: Object.assign(passthrough, { Screen: () => null }),
    Tabs: Object.assign(passthrough, { Screen: TabScreen }),
  }
})

// expo-secure-store et async-storage sont branchés via moduleNameMapper (jest.config.js).

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: "cancel" }),
}))

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn(() => "stayup://auth/callback"),
}))

jest.mock("expo-linking", () => ({
  createURL: (path: string) => `stayup://${path}`,
  useURL: () => null,
}))

// No notification service under Jest: push and the icon badge are native.
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExponentPushToken[abc]" }),
  setBadgeCountAsync: jest.fn().mockResolvedValue(true),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3 },
}))

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "project-1" } } }, easConfig: undefined },
}))

jest.mock("expo-image", () => ({ Image: require("react-native").Image }))

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native")
  const inset = { top: 0, right: 0, bottom: 0, left: 0 }
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    SafeAreaInsetsContext: { Consumer: View, Provider: View },
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  }
})

jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: require("react-native").View,
}))

jest.mock("react-native-webview", () => ({ WebView: require("react-native").View }))

// nativewind: its native runtime is not available under Jest (see babel.config.js).
jest.mock("nativewind", () => ({
  colorScheme: { set: jest.fn(), get: jest.fn(() => "light") },
  useColorScheme: () => ({ colorScheme: "light", setColorScheme: jest.fn() }),
}))

// Icons: each icon becomes a <View testID="icon-<Name>" />, which gives a
// stable handle on buttons that only show an icon.
jest.mock("lucide-react-native", () => {
  const React = require("react")
  const { View } = require("react-native")

  return new Proxy(
    {},
    {
      get(cache: Record<string, unknown>, name: string) {
        if (name === "__esModule") return true
        if (!cache[name]) {
          const Icon = () => React.createElement(View, { testID: `icon-${name}` })
          Icon.displayName = name
          cache[name] = Icon
        }
        return cache[name]
      },
    },
  )
})

beforeEach(() => {
  mockState.params = {}
})

afterEach(() => {
  jest.clearAllMocks()
})
