import { useEffect, useState } from "react"
import { type AuthConfig, fetchAuthConfig } from "@/lib/api"

interface UseAuthConfig {
  /** `null` until the first call has responded, or if the API does not expose
   *  `/auth/config` — the caller then falls back to default values. */
  config: AuthConfig | null
}

export function useAuthConfig(): UseAuthConfig {
  const [config, setConfig] = useState<AuthConfig | null>(null)

  useEffect(() => {
    void fetchAuthConfig().then(setConfig)
  }, [])

  return { config }
}
