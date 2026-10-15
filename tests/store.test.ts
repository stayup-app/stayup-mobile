import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  readToken,
  writeToken,
  clearToken,
  readLang,
  writeLang,
  readReadItems,
  writeReadItems,
} from "../src/lib/store"

const secure = SecureStore as unknown as {
  getItemAsync: jest.Mock
  setItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}
const async = AsyncStorage as unknown as {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}

/** In-memory backing so multi-step store ops (read then write) behave. */
function stage(initial: { async?: Record<string, string>; secure?: Record<string, string> } = {}) {
  const a: Record<string, string> = { ...initial.async }
  const s: Record<string, string> = { ...initial.secure }
  async.getItem.mockImplementation((k: string) => Promise.resolve(a[k] ?? null))
  async.setItem.mockImplementation((k: string, v: string) => {
    a[k] = v
    return Promise.resolve()
  })
  async.removeItem.mockImplementation((k: string) => {
    delete a[k]
    return Promise.resolve()
  })
  secure.getItemAsync.mockImplementation((k: string) => Promise.resolve(s[k] ?? null))
  secure.setItemAsync.mockImplementation((k: string, v: string) => {
    s[k] = v
    return Promise.resolve()
  })
  secure.deleteItemAsync.mockImplementation((k: string) => {
    delete s[k]
    return Promise.resolve()
  })
  return { a, s }
}

afterEach(() => jest.clearAllMocks())

describe("token", () => {
  it("reads the stored token", async () => {
    stage({ secure: { auth_token: "jwt-a" } })
    await expect(readToken()).resolves.toBe("jwt-a")
  })

  it("returns null when nothing is stored", async () => {
    stage()
    await expect(readToken()).resolves.toBeNull()
  })

  it("carries over the first session of a multi-server version, then drops its keys", async () => {
    const { a, s } = stage({
      async: {
        instances: JSON.stringify([
          { id: "i1", url: "https://a.dev", name: "A" },
          { id: "i2", url: "https://b.dev", name: "B" },
        ]),
        api_url: "https://a.dev",
      },
      secure: { tok_i1: "jwt-first", tok_i2: "jwt-second" },
    })
    await expect(readToken()).resolves.toBe("jwt-first")
    expect(s.auth_token).toBe("jwt-first")
    expect(s.tok_i1).toBeUndefined()
    expect(s.tok_i2).toBeUndefined()
    expect(a.instances).toBeUndefined()
    expect(a.api_url).toBeUndefined()
  })

  it("drops an unreadable legacy list without inventing a session", async () => {
    const { a } = stage({ async: { instances: "not json" } })
    await expect(readToken()).resolves.toBeNull()
    expect(a.instances).toBeUndefined()
  })

  it("writes and clears the token", async () => {
    const { s } = stage()
    await writeToken("jwt-new")
    expect(s.auth_token).toBe("jwt-new")
    await clearToken()
    expect(s.auth_token).toBeUndefined()
  })
})

describe("language storage", () => {
  it("reads / returns null / writes", async () => {
    stage({ async: { lang: "en" } })
    await expect(readLang()).resolves.toBe("en")
    stage()
    await expect(readLang()).resolves.toBeNull()
    await writeLang("fr")
    expect(async.setItem).toHaveBeenCalledWith("lang", "fr")
  })
})

describe("read items storage", () => {
  it("returns [] when empty or malformed, parses otherwise, serializes on write", async () => {
    stage()
    await expect(readReadItems()).resolves.toEqual([])
    stage({ async: { read_items: "{not json" } })
    await expect(readReadItems()).resolves.toEqual([])
    stage({ async: { read_items: JSON.stringify(["i1:rss:1"]) } })
    await expect(readReadItems()).resolves.toEqual(["i1:rss:1"])
    await writeReadItems(["i1:rss:1"])
    expect(async.setItem).toHaveBeenCalledWith("read_items", JSON.stringify(["i1:rss:1"]))
  })
})
