// A provider is never hardcoded: the list comes from GET /connectors/providers
// and rendering from its `template` (provider_registry.template). A provider
// with no recognized template falls back to generic rendering.
export type Provider = string

export interface UserRepository {
  id: string
  userId: string
  repositoryId: number
  provider: Provider
  url: string
  identifier: string
  config: Record<string, unknown>
  createdAt: string
}

// Minimal shape guaranteed by a provider's contract (see stayup-api).
// Everything else goes through the index signature — the template knows how to
// read it.
export interface ConnectorItem {
  id: number
  repository_id: number
  content?: string
  datetime?: string | null
  version?: string | null
  executed_at: string
  success?: boolean
  params?: unknown
  [key: string]: unknown
}

export type GenericItem = ConnectorItem

export interface TaggedItem {
  provider: string
  item: ConnectorItem
}

export interface FeedRepository {
  repository_id: number
  url: string
  provider?: string
  config?: Record<string, unknown>
}

/** An existing flux of a provider, with the user's subscription state. */
export interface ProviderFlux {
  id: number
  url: string
  config: Record<string, unknown>
  created_at: string
  is_subscribed: boolean
}
