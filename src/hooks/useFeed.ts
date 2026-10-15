import { useState, useEffect, useCallback } from "react"
import { getUserFeed, ApiError, type UserFeedResponse } from "@/lib/api"
import { decodeToken } from "@/lib/session"
import { PROVIDERS } from "@/lib/providers"
import { resolveFeedLabel, type ProviderMeta } from "@/lib/providerTemplate"
import type { Provider } from "@/types"

export interface FeedFlux {
  id: string
  repository_id: number
  provider: Provider
  url: string
  identifier: string
}

interface FeedState {
  fluxes: FeedFlux[]
  connectors: UserFeedResponse["connectors"] | null
  templates: Record<string, ProviderMeta>
  loading: boolean
  error: string | null
}

interface UseFeed extends FeedState {
  refresh: () => void
}

/** Loads the signed-in user's feed once a token is available. `onAuthError`
 *  fires when the API rejects the token (revoked, expired): the caller signs the
 *  user out. */
export function useFeed(token: string | null, onAuthError: () => void): UseFeed {
  const [state, setState] = useState<FeedState>({
    fluxes: [],
    connectors: null,
    templates: PROVIDERS,
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await getUserFeed(decodeToken(token).userId, token)
      setState({
        fluxes: data.repositories.map((repo) => ({
          id: repo.id,
          repository_id: repo.repository_id,
          provider: repo.provider,
          url: repo.url,
          identifier: resolveFeedLabel(PROVIDERS[repo.provider]?.template ?? null, {
            url: repo.url,
            config: (repo.config ?? {}) as Record<string, unknown>,
          }),
        })),
        connectors: data.connectors ?? {},
        templates: PROVIDERS,
        loading: false,
        error: null,
      })
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        onAuthError()
        return
      }
      setState((s) => ({ ...s, loading: false, error: "Erreur de chargement." }))
    }
  }, [token, onAuthError])

  useEffect(() => {
    // Async load: `load`'s only setState comes after the awaits, no synchronous
    // render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    void load()
  }, [load])

  return { ...state, refresh }
}
