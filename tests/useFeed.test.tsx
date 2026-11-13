import { renderHook, waitFor, act } from "@testing-library/react-native"
import { useFeed } from "@/hooks/useFeed"
import { getUserFeed, ApiError } from "@/lib/api"

jest.mock("@/lib/api", () => ({
  getUserFeed: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
}))

const mockedGetUserFeed = getUserFeed as jest.Mock

function makeJwt(payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`
}
const token = makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 })

const emptyConnectors = { changelog: [], youtube: [], rss: [], scrap: [] }
const onAuthError = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockedGetUserFeed.mockResolvedValue({ repositories: [], connectors: emptyConnectors })
})

describe("useFeed", () => {
  it("loads the feed and labels each flux from its provider template", async () => {
    mockedGetUserFeed.mockResolvedValue({
      repositories: [
        {
          id: "link-1",
          repository_id: 10,
          provider: "changelog",
          url: "https://github.com/facebook/react/",
          config: {},
          created_at: "2026-01-01",
        },
      ],
      connectors: {
        ...emptyConnectors,
        changelog: [{ id: 1, repository_id: 10, executed_at: "2026-01-01T00:00:00Z" }],
      },
    })

    // Hold the request open so the loading state can be observed: the async
    // render would otherwise flush past it.
    const feed = await mockedGetUserFeed.getMockImplementation()?.()
    let release: (value: unknown) => void = () => {}
    mockedGetUserFeed.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))

    const { result } = await renderHook(() => useFeed(token, onAuthError))

    expect(result.current.loading).toBe(true)
    release(feed)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGetUserFeed).toHaveBeenCalledWith("user-1", token)
    expect(result.current.fluxes).toEqual([
      expect.objectContaining({
        id: "link-1",
        provider: "changelog",
        identifier: "facebook/react",
      }),
    ])
    expect(result.current.connectors?.changelog?.[0]).toMatchObject({ id: 1 })
    expect(result.current.error).toBeNull()
  })

  it("renders with the bundled provider templates", async () => {
    const { result } = await renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(Object.keys(result.current.templates).sort()).toEqual([
      "changelog",
      "github_trending",
      "podcast",
      "reddit",
      "rss",
      "scrap",
      "social",
      "youtube",
    ])
  })

  it("signs the user out when the API rejects the token", async () => {
    mockedGetUserFeed.mockRejectedValue(new ApiError(401, "Unauthorized"))
    await renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1))
  })

  it("reports an error for any other failure", async () => {
    mockedGetUserFeed.mockRejectedValue(new Error("down"))
    const { result } = await renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Erreur de chargement.")
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it("handles a repositories-only response (no connectors block, no config)", async () => {
    mockedGetUserFeed.mockResolvedValue({
      repositories: [{ id: "l9", repository_id: 9, url: "https://x.dev", provider: "custom" }],
    })

    const { result } = await renderHook(() => useFeed(token, onAuthError))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.connectors).toEqual({})
    expect(result.current.fluxes[0]).toMatchObject({ id: "l9" })
  })

  it("waits for a token before loading", async () => {
    const { result } = await renderHook(() => useFeed(null, onAuthError))

    await act(async () => {})
    expect(mockedGetUserFeed).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it("refetches on refresh", async () => {
    const { result } = await renderHook(() => useFeed(token, onAuthError))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.refresh()
    })
    expect(mockedGetUserFeed).toHaveBeenCalledTimes(2)
  })
})
