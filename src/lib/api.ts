import { API_URL } from "@/lib/config"
import type { ConnectorItem, Provider, ProviderFlux } from "@/types"

export interface UserRepositoryItem {
  id: string
  repository_id: number
  created_at: string
  url: string
  provider: Provider
  config: Record<string, unknown>
}

export interface UserFeedResponse {
  repositories: UserRepositoryItem[]
  connectors: Record<string, ConnectorItem[]>
}

export interface ConnectorProvider {
  name: string
  displayName: string
  /** `auto`: adding a flux is immediate; `manual`: it goes through a request. */
  fluxApproval?: "auto" | "manual"
}

/** API call error carrying the HTTP status. The API message is in English
 *  whatever the app's language: it is up to the display point to translate from
 *  the status, not to show `StayUp API error 409: /ui/...` to the user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const base = API_URL
  // A POST/DELETE may have been processed before the cut: replaying it would
  // create a duplicate. Only reads are retried.
  const isGet = !init?.method || init.method === "GET"
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })

    if (!res.ok) {
      if (isGet && attempt === 0 && res.status >= 500) {
        return apiFetch(path, token, init, 1)
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new ApiError(res.status, body.error ?? `StayUp API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (isGet && attempt === 0 && err instanceof TypeError) {
      return apiFetch(path, token, init, 1)
    }
    throw err
  }
}

export interface AuthConfig {
  emailPassword: boolean
  oauth: { google: boolean; github: boolean }
}

function isAuthConfig(v: unknown): v is AuthConfig {
  if (!v || typeof v !== "object") return false
  const c = v as Record<string, unknown>
  const o = c.oauth as Record<string, unknown> | null | undefined
  return (
    typeof c.emailPassword === "boolean" &&
    !!o &&
    typeof o === "object" &&
    typeof o.github === "boolean" &&
    typeof o.google === "boolean"
  )
}

/** What a client needs to know before the login screen. `null` if the API does
 *  not respond — the caller then falls back to "everything is offered". */
export async function fetchAuthConfig(): Promise<AuthConfig | null> {
  try {
    const res = await fetch(`${API_URL}/auth/config`)
    if (!res.ok) return null
    const body: unknown = await res.json()
    return isAuthConfig(body) ? body : null
  } catch {
    return null
  }
}

export async function loginWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw new ApiError(res.status, `Login failed: ${res.status}`)

  const { token } = (await res.json()) as { token: string }
  return token
}

export async function registerWithPassword(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })

  if (!res.ok) throw new ApiError(res.status, `Register failed: ${res.status}`)

  const { token } = (await res.json()) as { token: string }
  return token
}

export async function getUserFeed(userId: string, token: string): Promise<UserFeedResponse> {
  return apiFetch<UserFeedResponse>(`/ui/users/${userId}/feed`, token)
}

export async function getConnectorProviders(token: string): Promise<ConnectorProvider[]> {
  const data = await apiFetch<{ providers: ConnectorProvider[] }>("/connectors/providers", token)
  return data.providers
}

/** `{ repository }` (flux created) or `{ status: 'pending' }` (`manual`
 *  provider: the request goes to the admin approval queue). */
export type AddRepositoryResult =
  | { repository: { id: string; repository_id: number }; status?: undefined }
  | { status: "pending" }

export async function addUserRepository(
  userId: string,
  token: string,
  data: { provider: string; url: string; config: Record<string, unknown> },
): Promise<AddRepositoryResult> {
  return apiFetch<AddRepositoryResult>(`/ui/users/${userId}/repositories`, token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteUserRepository(
  userId: string,
  linkId: string,
  token: string,
): Promise<void> {
  await apiFetch(`/ui/users/${userId}/repositories/${linkId}`, token, {
    method: "DELETE",
  })
}

export async function getProviderFluxes(provider: string, token: string): Promise<ProviderFlux[]> {
  const data = await apiFetch<{ fluxes: ProviderFlux[] }>(`/providers/${provider}/fluxes`, token)
  return data.fluxes
}

export async function subscribeFlux(provider: string, id: number, token: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/providers/${provider}/fluxes/${id}/subscribe`, token, {
    method: "POST",
  })
}

export async function unsubscribeFlux(provider: string, id: number, token: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/providers/${provider}/fluxes/${id}/subscribe`, token, {
    method: "DELETE",
  })
}
