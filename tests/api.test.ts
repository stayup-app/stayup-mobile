import {
  loginWithPassword,
  registerWithPassword,
  getUserFeed,
  getConnectorProviders,
  addUserRepository,
  deleteUserRepository,
  getProviderFluxes,
  subscribeFlux,
  unsubscribeFlux,
  fetchAuthConfig,
} from "../src/lib/api"

const API_URL = "https://stayup-api.r-sik.workers.dev"

global.fetch = jest.fn()

function mockFetch(status: number, body: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

function mockFetchError() {
  ;(global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("network error"))
}

afterEach(() => jest.clearAllMocks())

describe("fetchAuthConfig", () => {
  it("returns the parsed config on success", async () => {
    const cfg = {
      emailPassword: true,
      oauth: { github: true, google: false },
    }
    mockFetch(200, cfg)
    await expect(fetchAuthConfig()).resolves.toEqual(cfg)
    expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/auth/config`)
  })

  it("returns null when the endpoint is missing (non-2xx)", async () => {
    mockFetch(404, {})
    await expect(fetchAuthConfig()).resolves.toBeNull()
  })

  it("returns null when the request throws (unreachable API)", async () => {
    mockFetchError()
    await expect(fetchAuthConfig()).resolves.toBeNull()
  })
})

describe("loginWithPassword", () => {
  it("returns token on success", async () => {
    mockFetch(200, { token: "tok-123" })
    const token = await loginWithPassword("a@b.com", "pass")
    expect(token).toBe("tok-123")
  })

  // The displayed message is translated by useAuth from the status: here we
  // only check that the status is carried by the error.
  it("throws an ApiError carrying the 401", async () => {
    mockFetch(401, {})
    await expect(loginWithPassword("a@b.com", "wrong")).rejects.toMatchObject({
      status: 401,
    })
  })

  it("throws an ApiError carrying the 5xx", async () => {
    mockFetch(500, {})
    await expect(loginWithPassword("a@b.com", "pass")).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe("getUserFeed (apiFetch retry)", () => {
  it("retries on 5xx and succeeds on second attempt", async () => {
    mockFetch(503, {})
    mockFetch(200, {
      repositories: [],
      connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    })
    const result = await getUserFeed("user-1", "tok")
    expect(result.repositories).toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("retries on network error (TypeError) once", async () => {
    mockFetchError()
    mockFetch(200, {
      repositories: [],
      connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    })
    const result = await getUserFeed("user-1", "tok")
    expect(result.repositories).toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("throws if both attempts fail", async () => {
    mockFetch(503, {})
    mockFetch(503, {})
    await expect(getUserFeed("user-1", "tok")).rejects.toThrow()
  })

  it("does not retry a 4xx", async () => {
    mockFetch(404, {})
    await expect(getUserFeed("user-1", "tok")).rejects.toThrow("StayUp API error 404")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("does not retry a non-TypeError rejection", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("boom"))
    await expect(getUserFeed("user-1", "tok")).rejects.toThrow("boom")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("sends the bearer token", async () => {
    mockFetch(200, { repositories: [], connectors: {} })
    await getUserFeed("user-1", "tok")

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/ui/users/user-1/feed`)
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(init.headers["Content-Type"]).toBe("application/json")
  })
})

describe("getConnectorProviders", () => {
  it("returns the discovered providers and sends the bearer token", async () => {
    mockFetch(200, { providers: [{ name: "youtube", displayName: "YouTube" }] })
    const providers = await getConnectorProviders("tok")
    expect(providers).toEqual([{ name: "youtube", displayName: "YouTube" }])

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/connectors/providers`)
    expect(init.headers.Authorization).toBe("Bearer tok")
  })
})

describe("registerWithPassword", () => {
  it("returns the token on success", async () => {
    mockFetch(200, { token: "tok-new" })
    await expect(registerWithPassword("Sika", "a@b.com", "password")).resolves.toBe("tok-new")
  })

  it("throws an ApiError carrying the 409", async () => {
    mockFetch(409, {})
    await expect(registerWithPassword("Sika", "a@b.com", "password")).rejects.toMatchObject({
      status: 409,
    })
  })

  it("throws an ApiError carrying any other error status", async () => {
    mockFetch(500, {})
    await expect(registerWithPassword("Sika", "a@b.com", "password")).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe("repository mutations", () => {
  it("posts a new repository", async () => {
    mockFetch(200, {})
    await addUserRepository("user-1", "tok", {
      provider: "changelog",
      url: "https://github.com/facebook/react/",
      config: { max_scraps: 5 },
    })

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/ui/users/user-1/repositories`)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body).provider).toBe("changelog")
  })

  it("deletes a repository link", async () => {
    mockFetch(200, {})
    await deleteUserRepository("user-1", "link-9", "tok")

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/ui/users/user-1/repositories/link-9`)
    expect(init.method).toBe("DELETE")
  })
})

describe("provider flux endpoints", () => {
  it("unwraps the fluxes list", async () => {
    mockFetch(200, { fluxes: [{ id: 1, url: "https://example.com" }] })
    const fluxes = await getProviderFluxes("rss", "tok")
    expect(fluxes).toHaveLength(1)
    expect(fluxes[0].id).toBe(1)
  })

  it("subscribes with POST to the provider subscribe endpoint", async () => {
    mockFetch(200, { success: true })
    await subscribeFlux("rss", 3, "tok")

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/providers/rss/fluxes/3/subscribe`)
    expect(init.method).toBe("POST")
    expect(init.body).toBeUndefined()
  })

  it("unsubscribes with DELETE", async () => {
    mockFetch(200, { success: true })
    await unsubscribeFlux("rss", 3, "tok")

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`${API_URL}/providers/rss/fluxes/3/subscribe`)
    expect(init.method).toBe("DELETE")
    expect(init.body).toBeUndefined()
  })
})

describe("apiFetch — corps d'erreur et rejeu", () => {
  it("surfaces the API error body instead of the raw status line", async () => {
    mockFetch(409, { error: "Already subscribed" })
    await expect(getUserFeed("u1", "tok")).rejects.toThrow("Already subscribed")
  })

  it("falls back to the status line when the error body is not JSON", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 418,
      json: () => Promise.reject(new Error("not json")),
    })
    await expect(getUserFeed("u1", "tok")).rejects.toThrow("StayUp API error 418")
  })

  // A POST may have been processed before the cut: replaying it would create a duplicate.
  it("does not replay a write that failed with a 5xx", async () => {
    mockFetch(500, {})
    await expect(
      addUserRepository("u1", "tok", {
        provider: "rss",
        url: "https://x.dev/feed",
        config: {},
      }),
    ).rejects.toMatchObject({ status: 500 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("does not replay a write that failed on the network", async () => {
    mockFetchError()
    await expect(deleteUserRepository("u1", "link-1", "tok")).rejects.toThrow("network error")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
