import { useState, useEffect, useCallback } from "react"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import { readToken, writeToken, clearToken } from "@/lib/store"
import { API_URL } from "@/lib/config"
import { decodeToken, isTokenExpired } from "@/lib/session"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

WebBrowser.maybeCompleteAuthSession()

interface UseAuth {
  /** The signed-in user, or null (signed out, or the stored token has expired). */
  session: AppSession | null
  token: string | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginOAuth: (provider: "github" | "google") => Promise<void>
  logout: () => Promise<void>
}

/** Runs the OAuth round-trip in the system browser. Returns `null` if it is
 *  cancelled (not an error: the caller shows nothing). */
async function oauthToken(provider: "github" | "google"): Promise<string | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "stayup", path: "auth/callback" })
  const authUrl = `${API_URL}/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)
  if (result.type === "success" && result.url) {
    return new URL(result.url).searchParams.get("token")
  }
  return null
}

export function useAuth(): UseAuth {
  const { t } = useLanguage()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const stored = await readToken()
      setToken(stored && !isTokenExpired(stored) ? stored : null)
      setLoading(false)
    })()
  }, [])

  const authErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 401) return t.errors.invalidCredentials
        if (err.status === 409) return t.errors.emailTaken
      }
      return t.errors.serverError
    },
    [t],
  )

  const signIn = useCallback(
    async (run: () => Promise<string | null>) => {
      setLoading(true)
      setError(null)
      try {
        const next = await run()
        if (next) {
          await writeToken(next)
          setToken(next)
        }
      } catch (err) {
        setError(authErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [authErrorMessage],
  )

  const login = useCallback(
    (email: string, password: string) => signIn(() => loginWithPassword(email, password)),
    [signIn],
  )

  const register = useCallback(
    (name: string, email: string, password: string) =>
      signIn(() => registerWithPassword(name, email, password)),
    [signIn],
  )

  const loginOAuth = useCallback(
    (provider: "github" | "google") => signIn(() => oauthToken(provider)),
    [signIn],
  )

  const logout = useCallback(async () => {
    await clearToken()
    setToken(null)
  }, [])

  const session = token ? decodeToken(token) : null

  return { session, token, loading, error, login, register, loginOAuth, logout }
}
