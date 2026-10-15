import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { Language } from "@/lib/translations"

const AUTH_KEY = "auth_token"
const LANG_KEY = "lang"
// Keys of versions that supported several servers.
const LEGACY_INSTANCES_KEY = "instances"
const LEGACY_API_URL_KEY = "api_url"
const legacyTokKey = (id: string) => `tok_${id}`

export async function readToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(AUTH_KEY)
  if (token) return token

  // Versions that supported several servers kept a list: carry the first
  // session over, then drop the obsolete keys.
  const raw = await AsyncStorage.getItem(LEGACY_INSTANCES_KEY)
  if (!raw) return null
  let ids: string[] = []
  try {
    ids = (JSON.parse(raw) as { id: string }[]).map((m) => m.id)
  } catch {
    ids = []
  }
  const migrated = ids[0] ? await SecureStore.getItemAsync(legacyTokKey(ids[0])) : null
  if (migrated) await SecureStore.setItemAsync(AUTH_KEY, migrated)
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(legacyTokKey(id))))
  await AsyncStorage.removeItem(LEGACY_INSTANCES_KEY)
  await AsyncStorage.removeItem(LEGACY_API_URL_KEY)
  return migrated
}

export async function writeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_KEY, token)
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_KEY)
}

// ─── Langue ──────────────────────────────────────────────────────────────────

export async function readLang(): Promise<Language | null> {
  const v = await AsyncStorage.getItem(LANG_KEY)
  return (v as Language) ?? null
}

export async function writeLang(lang: Language): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang)
}

// ─── Items lus ───────────────────────────────────────────────────────────────

const READ_ITEMS_KEY = "read_items"

export async function readReadItems(): Promise<string[]> {
  const v = await AsyncStorage.getItem(READ_ITEMS_KEY)
  if (!v) return []
  try {
    return JSON.parse(v) as string[]
  } catch {
    return []
  }
}

export async function writeReadItems(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(READ_ITEMS_KEY, JSON.stringify(ids))
}

// ─── Push notifications ──────────────────────────────────────────────────────

const PUSH_ENABLED_KEY = "push_enabled"
const PUSH_TOKEN_KEY = "push_token"

/** Push notifications are on unless the user turned them off. */
export async function readPushEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_ENABLED_KEY)) !== "false"
}

export async function writePushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, String(enabled))
}

/** The Expo push token this device registered with the API, if any. */
export async function readPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY)
}

export async function writePushToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
  else await AsyncStorage.removeItem(PUSH_TOKEN_KEY)
}
