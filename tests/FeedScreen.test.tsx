import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import FeedScreen from "../app/(app)/feed/index"
import { ApiError, getUserFeed, getConnectorProviders } from "@/lib/api"
import { useReadItemsStore } from "@/store/readItems"
import { useSelectedFeedItemStore } from "@/store/selectedFeedItem"
import { renderWithProviders } from "./render"
import { mockRouter } from "./setup"
import { RAW_PROVIDERS } from "./_templates"

jest.mock("@/lib/api", () => ({
  getUserFeed: jest.fn(),
  getConnectorProviders: jest.fn(),
  deleteUserRepository: jest.fn(),
  addUserRepository: jest.fn(),

  getProviderFluxes: jest.fn().mockResolvedValue([]),
  subscribeFlux: jest.fn(),
  fetchAuthConfig: jest.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
}))

const secureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}
const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }
const mockedGetUserFeed = getUserFeed as jest.Mock
const mockedGetProviders = getConnectorProviders as jest.Mock

function validToken(): string {
  const payload = {
    sub: "user-1",
    name: "Jean",
    email: "jean@example.com",
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  return `${btoa("{}")}.${btoa(JSON.stringify(payload))}.sig`
}

const repositories = [
  {
    id: "link-1",
    repository_id: 10,
    provider: "rss" as const,
    url: "https://blog.example.com/feed.xml",
    config: {},
    created_at: "2026-01-01",
  },
]

function rssItem(id: number, title: string) {
  return {
    id,
    repository_id: 10,
    content: JSON.stringify({ title, link: `https://blog.example.com/${id}`, summary: "" }),
    datetime: `2026-0${id}-01T10:00:00Z`,
    executed_at: `2026-0${id}-01T11:00:00Z`,
    success: true,
  }
}

function feedResponse(rss = [rssItem(1, "Article A"), rssItem(2, "Article B")]) {
  return { repositories, connectors: { changelog: [], youtube: [], rss, scrap: [] } }
}

/**
 * AsyncStorage is shared by the language, the theme and the read items: we
 * answer by key so as not to inject a list of ids where a language is expected.
 */
function stubStorage(values: Record<string, string> = {}) {
  const all: Record<string, string> = { ...values }
  asyncStorage.getItem.mockImplementation((key: string) => Promise.resolve(all[key] ?? null))
}

/** Marks items as already read at startup. */
function withReadItems(...ids: string[]) {
  stubStorage({ read_items: JSON.stringify(ids) })
}

beforeEach(() => {
  secureStore.getItemAsync.mockImplementation((k: string) =>
    Promise.resolve(k === "auth_token" ? validToken() : null),
  )
  stubStorage()
  mockedGetUserFeed.mockResolvedValue(feedResponse())
  mockedGetProviders.mockResolvedValue(RAW_PROVIDERS)
  useReadItemsStore.setState({ readIds: new Set(), initialized: false })
  useSelectedFeedItemStore.setState({ item: null, repoUrl: "", template: null, source: undefined })
})

describe("FeedScreen — chargement", () => {
  it("shows the loading screen before the first response", async () => {
    mockedGetUserFeed.mockReturnValue(new Promise(() => {}))
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Chargement…")).toBeTruthy())
  })

  it("shows the error and allows retrying", async () => {
    mockedGetUserFeed.mockRejectedValue(new Error("StayUp API error 500"))
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Erreur de chargement.")).toBeTruthy())

    mockedGetUserFeed.mockResolvedValue(feedResponse())
    await fireEvent.press(screen.getByText("Réessayer"))

    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
  })
})

describe("FeedScreen — affichage", () => {
  it("lists the feed items and the flux section", async () => {
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
    expect(screen.getByText("Article B")).toBeTruthy()
    expect(screen.getByText("Mes flux")).toBeTruthy()
  })

  it("shows the total count and the unread count", async () => {
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Tous")).toBeTruthy())
    // 2 items au total, 2 non lus.
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2)
  })

  it("hides the unread badge and the mark-all button once everything is read", async () => {
    withReadItems("rss:1", "rss:2")
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
    expect(screen.queryByTestId("icon-CheckCheck")).toBeNull()
  })
})

describe("FeedScreen — filtres", () => {
  it("keeps only unread items in unread mode", async () => {
    withReadItems("rss:1")
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    await fireEvent.press(screen.getByText("Non lu"))

    await waitFor(() => expect(screen.queryByText("Article A")).toBeNull())
    expect(screen.getByText("Article B")).toBeTruthy()
  })

  it("keeps the currently open item visible in unread mode", async () => {
    withReadItems("rss:1")
    useSelectedFeedItemStore.setState({
      item: { provider: "rss", item: { ...rssItem(1, "Article A") } },
      repoUrl: "",
    })
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    await fireEvent.press(screen.getByText("Non lu"))

    await waitFor(() => expect(screen.getByText("Article B")).toBeTruthy())
    expect(screen.getByText("Article A")).toBeTruthy()
  })

  it("switches back to the all filter", async () => {
    withReadItems("rss:1")
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    await fireEvent.press(screen.getByText("Non lu"))
    await waitFor(() => expect(screen.queryByText("Article A")).toBeNull())

    await fireEvent.press(screen.getByText("Tous"))
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
  })

  it("restricts the feed to the selected provider", async () => {
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("RSS")).toBeTruthy())

    await fireEvent.press(screen.getByText("RSS"))

    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
  })
})

describe("FeedScreen — lecture", () => {
  it("marks everything as read", async () => {
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByTestId("icon-CheckCheck")).toBeTruthy())

    await fireEvent.press(screen.getByTestId("icon-CheckCheck"))

    await waitFor(() =>
      expect(asyncStorage.setItem).toHaveBeenCalledWith(
        "read_items",
        JSON.stringify(["rss:1", "rss:2"]),
      ),
    )
  })

  it("opens an item and stores it with its repository url", async () => {
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    await fireEvent.press(screen.getByText("Article A"))

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/feed/detail"))
    expect(useSelectedFeedItemStore.getState().repoUrl).toBe("https://blog.example.com/feed.xml")
  })

  it("drops stored ids that are no longer in the feed", async () => {
    withReadItems("rss:1", "rss:999")
    await renderWithProviders(<FeedScreen />)

    await waitFor(() =>
      expect(asyncStorage.setItem).toHaveBeenCalledWith("read_items", JSON.stringify(["rss:1"])),
    )
  })
})

describe("FeedScreen — session", () => {
  it("signs the user out when the API rejects the token", async () => {
    mockedGetUserFeed.mockRejectedValue(new ApiError(401, "Unauthorized"))
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("auth_token"))
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login"))
  })
})

describe("FeedScreen — connecteurs partiels", () => {
  it("tolerates a response where some connector lists are missing", async () => {
    mockedGetUserFeed.mockResolvedValue({
      repositories,
      connectors: { rss: [rssItem(1, "Article A")] },
    })
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
  })

  it("tolerates a response with no connector at all", async () => {
    mockedGetUserFeed.mockResolvedValue({ repositories, connectors: {} })
    await renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(screen.getByText("Aucun contenu disponible.")).toBeTruthy())
  })
})

describe("FeedScreen — filtre non lu par provider", () => {
  const changelogItem = {
    id: 1,
    repository_id: 20,
    content: "Notes",
    datetime: "2026-04-01T10:00:00Z",
    executed_at: "2026-04-01T11:00:00Z",
    success: true,
    version: "v9.9.9",
  }
  const youtubeItem = {
    id: 1,
    repository_id: 21,
    version: "1",
    content: JSON.stringify({ title: "Ma vidéo", url: "https://www.youtube.com/@a" }),
    datetime: "2026-03-01T10:00:00Z",
    executed_at: "2026-03-01T11:00:00Z",
    success: true,
  }
  const scrapItem = {
    id: 1,
    repository_id: 22,
    content: "Texte scrapé",
    params: JSON.stringify({ url: "https://example.com/s" }),
    executed_at: "2026-02-01T11:00:00Z",
    success: true,
  }

  it("filters read items of every provider", async () => {
    mockedGetUserFeed.mockResolvedValue({
      repositories,
      connectors: {
        changelog: [changelogItem],
        youtube: [youtubeItem],
        rss: [rssItem(2, "Article B")],
        scrap: [scrapItem],
      },
    })
    withReadItems("changelog:1", "youtube:1", "scrap:1")
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("v9.9.9")).toBeTruthy())

    await fireEvent.press(screen.getByText("Non lu"))

    await waitFor(() => expect(screen.queryByText("v9.9.9")).toBeNull())
    expect(screen.queryByText("Ma vidéo")).toBeNull()
    expect(screen.queryByText("Texte scrapé")).toBeNull()
    expect(screen.getByText("Article B")).toBeTruthy()
  })
})

describe("FeedScreen — ajout de flux", () => {
  it("opens the add sheet", async () => {
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByTestId("icon-Plus")).toBeTruthy())

    await fireEvent.press(screen.getByTestId("icon-Plus"), { stopPropagation: jest.fn() })

    await waitFor(() => expect(screen.getByText("Ajouter un flux")).toBeTruthy())
  })

  it("closes the add sheet again", async () => {
    await renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByTestId("icon-Plus")).toBeTruthy())

    await fireEvent.press(screen.getByTestId("icon-Plus"), { stopPropagation: jest.fn() })
    await waitFor(() => expect(screen.getByText("Ajouter un flux")).toBeTruthy())

    await fireEvent.press(screen.getByText("Annuler"))

    await waitFor(() => expect(screen.queryByText("Ajouter un flux")).toBeNull())
  })
})
