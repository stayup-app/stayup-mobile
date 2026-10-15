import { Platform, TextInput } from "react-native"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Index from "../app/index"
import RootLayout from "../app/_layout"
import AuthLayout from "../app/(auth)/_layout"
import LoginScreen from "../app/(auth)/login"
import RegisterScreen from "../app/(auth)/register"
import AppLayout from "../app/(app)/_layout"
import ProfileScreen from "../app/(app)/profile/index"
import FluxDetailScreen from "../app/(app)/feed/flux/[id]"
import { loginWithPassword, registerWithPassword, fetchAuthConfig } from "@/lib/api"
import { renderWithProviders } from "./render"
import { mockRedirect, mockRouter, redirectedTo, setMockParams } from "./setup"

jest.mock("@/lib/api", () => ({
  loginWithPassword: jest.fn(),
  registerWithPassword: jest.fn(),
  getUserFeed: jest.fn(),
  fetchAuthConfig: jest.fn(),
}))

const mockedAuthConfig = fetchAuthConfig as jest.Mock
const authConfig = (over: Record<string, unknown> = {}) => ({
  registrationMode: "open",
  emailPassword: true,
  oauth: { github: true, google: true },
  ...over,
})

const secureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}
const asyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}
const mockedLogin = loginWithPassword as jest.Mock
const mockedRegister = registerWithPassword as jest.Mock

function validToken(): string {
  const payload = {
    sub: "user-1",
    name: "Jean",
    email: "jean@example.com",
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  return `${btoa("{}")}.${btoa(JSON.stringify(payload))}.sig`
}

beforeEach(() => {
  secureStore.getItemAsync.mockResolvedValue(null)
  asyncStorage.getItem.mockResolvedValue(null)
  mockedAuthConfig.mockResolvedValue(authConfig())
})

describe("Index", () => {
  it("sends an anonymous visitor to the login screen", async () => {
    renderWithProviders(<Index />)
    await waitFor(() => expect(mockRedirect).toHaveBeenCalled())
    expect(redirectedTo()).toBe("/(auth)/login")
  })

  it("sends an authenticated user to the feed", async () => {
    secureStore.getItemAsync.mockResolvedValue(validToken())
    renderWithProviders(<Index />)

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled())
    expect(redirectedTo()).toBe("/(app)/feed")
  })

  it("shows a spinner while the session is being restored", () => {
    renderWithProviders(<Index />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe("Layouts", () => {
  it("RootLayout mounts the provider tree", () => {
    expect(() => render(<RootLayout />)).not.toThrow()
  })

  it("AuthLayout renders a stack", () => {
    expect(() => render(<AuthLayout />)).not.toThrow()
  })

  it("AppLayout redirects an anonymous visitor to login", async () => {
    renderWithProviders(<AppLayout />)

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled())
    expect(redirectedTo()).toBe("/(auth)/login")
  })

  it("AppLayout renders the feed and profile tabs for an authenticated user", async () => {
    secureStore.getItemAsync.mockResolvedValue(validToken())
    renderWithProviders(<AppLayout />)

    await waitFor(() => expect(screen.getByTestId("icon-Rss")).toBeTruthy())
    expect(screen.getByTestId("icon-User")).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("AppLayout no longer exposes a documentation tab", async () => {
    secureStore.getItemAsync.mockResolvedValue(validToken())
    renderWithProviders(<AppLayout />)

    await waitFor(() => expect(screen.getByTestId("icon-Rss")).toBeTruthy())
    expect(screen.queryByTestId("icon-BookOpen")).toBeNull()
  })

  it("AppLayout redirects to login when the stored session has expired", async () => {
    const expiredToken = () =>
      `${btoa("{}")}.${btoa(
        JSON.stringify({ sub: "user-1", role: "user", exp: Math.floor(Date.now() / 1000) - 10 }),
      )}.sig`
    secureStore.getItemAsync.mockResolvedValue(expiredToken())
    renderWithProviders(<AppLayout />)

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled())
    expect(redirectedTo()).toBe("/(auth)/login")
  })
})

describe("LoginScreen", () => {
  it("shows the title and the subtitle", async () => {
    renderWithProviders(<LoginScreen />)

    await waitFor(() => expect(screen.getByText("Content de te revoir.")).toBeTruthy())
    expect(screen.getByText("Reprends ta lecture là où tu l'avais laissée.")).toBeTruthy()
    expect(screen.getByText("ou")).toBeTruthy()
    expect(screen.getByText("Pas encore de compte ?")).toBeTruthy()
  })

  it("logs in through the form", async () => {
    mockedLogin.mockResolvedValue(validToken())
    renderWithProviders(<LoginScreen />)
    await waitFor(() => expect(screen.getByText("Se connecter")).toBeTruthy())

    const fields = screen.UNSAFE_getAllByType(TextInput)
    fireEvent.changeText(fields[0], "jean@example.com")
    fireEvent.changeText(fields[1], "password")
    fireEvent.press(screen.getByText("Se connecter"))

    await waitFor(() => expect(mockedLogin).toHaveBeenCalledWith("jean@example.com", "password"))
  })

  it("offers both OAuth providers", async () => {
    renderWithProviders(<LoginScreen />)

    await waitFor(() => expect(screen.getByText("Continuer avec GitHub")).toBeTruthy())
    expect(screen.getByText("Continuer avec Google")).toBeTruthy()
  })

  it("hides an OAuth provider the instance does not offer", async () => {
    mockedAuthConfig.mockResolvedValue(authConfig({ oauth: { github: true, google: false } }))
    renderWithProviders(<LoginScreen />)

    await waitFor(() => expect(screen.getByText("Continuer avec GitHub")).toBeTruthy())
    expect(screen.queryByText("Continuer avec Google")).toBeNull()
  })

  it("drops the OAuth block when the instance offers neither provider", async () => {
    mockedAuthConfig.mockResolvedValue(authConfig({ oauth: { github: false, google: false } }))
    renderWithProviders(<LoginScreen />)

    await waitFor(() => expect(screen.getByText("Content de te revoir.")).toBeTruthy())
    expect(screen.queryByText("ou")).toBeNull()
    expect(screen.queryByText("Continuer avec GitHub")).toBeNull()
  })
})

describe("RegisterScreen", () => {
  it("shows the title and the link back to login", async () => {
    renderWithProviders(<RegisterScreen />)

    await waitFor(() => expect(screen.getByText("Crée ton compte.")).toBeTruthy())
    expect(screen.getByText("Déjà un compte ?")).toBeTruthy()
  })

  it("registers through the form", async () => {
    mockedRegister.mockResolvedValue(validToken())
    renderWithProviders(<RegisterScreen />)
    await waitFor(() => expect(screen.getByText("Créer un compte")).toBeTruthy())

    const fields = screen.UNSAFE_getAllByType(TextInput)
    fireEvent.changeText(fields[0], "Jean")
    fireEvent.changeText(fields[1], "jean@example.com")
    fireEvent.changeText(fields[2], "password123")
    fireEvent.press(screen.getByText("Créer un compte"))

    await waitFor(() =>
      expect(mockedRegister).toHaveBeenCalledWith("Jean", "jean@example.com", "password123"),
    )
  })
})

describe("ProfileScreen", () => {
  it("shows the user identity and its initial", async () => {
    secureStore.getItemAsync.mockResolvedValue(validToken())
    renderWithProviders(<ProfileScreen />)

    await waitFor(() => expect(screen.getByText("Jean")).toBeTruthy())
    expect(screen.getByText("jean@example.com")).toBeTruthy()
    expect(screen.getByText("J")).toBeTruthy()
  })

  it("falls back to a question mark without a session", async () => {
    renderWithProviders(<ProfileScreen />)

    await waitFor(() => expect(screen.getByText("?")).toBeTruthy())
  })

  it("exposes the theme and language sections", async () => {
    renderWithProviders(<ProfileScreen />)

    await waitFor(() => expect(screen.getByText("Thème")).toBeTruthy())
    expect(screen.getByText("Langue")).toBeTruthy()
    expect(screen.getByText("Mode sombre")).toBeTruthy()
    expect(screen.getByText("🇫🇷 Français")).toBeTruthy()
  })

  it("signs the user out", async () => {
    secureStore.getItemAsync.mockResolvedValue(validToken())
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("Déconnexion")).toBeTruthy())

    fireEvent.press(screen.getByText("Déconnexion"))

    await waitFor(() => expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("auth_token"))
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login"))
  })
})

describe("Auth screens on Android", () => {
  // Tests run on the iOS platform by default: we switch to cover the other
  // branch of `Platform.OS === "ios" ? "padding" : "height"`.
  let original: typeof Platform.OS

  beforeEach(() => {
    original = Platform.OS
    Platform.OS = "android"
  })

  afterEach(() => {
    Platform.OS = original
  })

  it("LoginScreen renders with the Android keyboard behaviour", async () => {
    renderWithProviders(<LoginScreen />)
    await waitFor(() => expect(screen.getByText("Content de te revoir.")).toBeTruthy())
  })

  it("RegisterScreen renders with the Android keyboard behaviour", async () => {
    renderWithProviders(<RegisterScreen />)
    await waitFor(() => expect(screen.getByText("Crée ton compte.")).toBeTruthy())
  })
})

describe("FluxDetailScreen", () => {
  it("shows the flux id from the route", () => {
    setMockParams({ id: "42" })
    renderWithProviders(<FluxDetailScreen />)

    expect(screen.getByText("Flux #42")).toBeTruthy()
  })
})
