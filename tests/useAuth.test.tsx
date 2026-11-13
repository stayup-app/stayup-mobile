import { renderHook, waitFor, act } from "@testing-library/react-native"
import * as WebBrowser from "expo-web-browser"
import { useAuth } from "@/hooks/useAuth"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { readToken, writeToken, clearToken } from "@/lib/store"
import { LanguageProvider } from "@/context/LanguageContext"
import { en } from "@/lib/translations"

jest.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  },
  loginWithPassword: jest.fn(),
  registerWithPassword: jest.fn(),
}))
jest.mock("@/lib/store", () => ({
  readToken: jest.fn().mockResolvedValue(null),
  writeToken: jest.fn().mockResolvedValue(undefined),
  clearToken: jest.fn().mockResolvedValue(undefined),
  readLang: jest.fn().mockResolvedValue(null),
  writeLang: jest.fn().mockResolvedValue(undefined),
}))

const webBrowser = WebBrowser as unknown as { openAuthSessionAsync: jest.Mock }
const mockedLogin = loginWithPassword as jest.Mock
const mockedRegister = registerWithPassword as jest.Mock
const mockedReadToken = readToken as jest.Mock

function wrapper({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
const renderAuth = async () => await renderHook(() => useAuth(), { wrapper })

function makeToken(overrides: Record<string, unknown> = {}): string {
  const payload = {
    sub: "user-1",
    name: "Jean",
    email: "jean@example.com",
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
  return `${btoa("{}")}.${btoa(JSON.stringify(payload))}.sig`
}
const validToken = makeToken()
const expiredToken = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 })

beforeEach(() => {
  jest.clearAllMocks()
  mockedReadToken.mockResolvedValue(null)
})

describe("initial restore", () => {
  it("restores the session from the stored token", async () => {
    mockedReadToken.mockResolvedValue(validToken)
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toMatchObject({ userId: "user-1", email: "jean@example.com" })
    expect(result.current.token).toBe(validToken)
  })

  it("ignores an expired stored token", async () => {
    mockedReadToken.mockResolvedValue(expiredToken)
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  it("stays signed out with no stored token", async () => {
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.token).toBeNull()
  })
})

describe("login", () => {
  it("stores the token and exposes the session", async () => {
    mockedLogin.mockResolvedValue(validToken)
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("jean@example.com", "pw"))

    expect(mockedLogin).toHaveBeenCalledWith("jean@example.com", "pw")
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.userId).toBe("user-1")
    expect(result.current.error).toBeNull()
  })

  it("translates a 401", async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, "Login failed: 401"))
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.login("a@b.c", "x"))
    expect(result.current.error).toBe(en.errors.invalidCredentials)
    expect(writeToken).not.toHaveBeenCalled()
  })

  it("falls back to a generic message otherwise", async () => {
    mockedLogin.mockRejectedValue("boom")
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.login("a@b.c", "x"))
    expect(result.current.error).toBe(en.errors.serverError)
  })
})

describe("register", () => {
  it("stores the token and exposes the session", async () => {
    mockedRegister.mockResolvedValue(validToken)
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Jean", "jean@example.com", "pw"))

    expect(mockedRegister).toHaveBeenCalledWith("Jean", "jean@example.com", "pw")
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.email).toBe("jean@example.com")
  })

  it("translates a 409 into the taken-email message", async () => {
    mockedRegister.mockRejectedValue(new ApiError(409, "Register failed: 409"))
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.register("Jean", "jean@example.com", "pw"))
    expect(result.current.error).toBe(en.errors.emailTaken)
  })
})

describe("OAuth", () => {
  it("applies the token returned by the auth session", async () => {
    webBrowser.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: `stayup://auth/callback?token=${validToken}`,
    })
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("github"))

    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.userId).toBe("user-1")
  })

  it("does nothing (no error) when the auth session is cancelled", async () => {
    webBrowser.openAuthSessionAsync.mockResolvedValue({ type: "cancel" })
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.loginOAuth("google"))
    expect(result.current.error).toBeNull()
    expect(writeToken).not.toHaveBeenCalled()
  })
})

describe("logout", () => {
  it("clears the stored token and drops the session", async () => {
    mockedReadToken.mockResolvedValue(validToken)
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.session).not.toBeNull())
    await act(() => result.current.logout())
    expect(clearToken).toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})
