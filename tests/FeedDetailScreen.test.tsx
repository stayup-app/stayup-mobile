import { Linking } from "react-native"
import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import FeedDetailScreen from "../app/(app)/feed/detail"
import { useSelectedFeedItemStore } from "@/store/selectedFeedItem"
import { useReadItemsStore } from "@/store/readItems"
import type { TaggedItem } from "@/types"
import { renderWithProviders } from "./render"
import { mockRouter } from "./setup"
import { normalizeTemplate, type ProviderTemplate } from "@/lib/providerTemplate"
import { TEMPLATES } from "./_templates"

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }
const FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"

let openURL: jest.SpyInstance

function stubStorage(values: Record<string, string> = {}) {
  asyncStorage.getItem.mockImplementation((key: string) => Promise.resolve(values[key] ?? null))
}

/** Selects an item the way FeedScreen does: item + template + source. */
function select(tagged: TaggedItem, repoUrl = "", template?: ProviderTemplate | null) {
  useSelectedFeedItemStore.setState({
    item: tagged,
    repoUrl,
    template: template ?? TEMPLATES[tagged.provider]?.template ?? null,
    source: { url: repoUrl, type: tagged.provider, config: {} },
  })
}

const audioTemplate = normalizeTemplate({
  version: 1,
  display: { name: "Podcast", accent: "#c5b1e8" },
  item: { parseContentAsJson: true, fields: { title: "title" } },
  detail: {
    mode: "audio",
    title: "title",
    image: "cover",
    audioUrl: "audio",
    body: "notes",
    openUrl: "page",
    openLabel: "Open episode",
  },
})

const galleryTemplate = normalizeTemplate({
  version: 1,
  display: { name: "Photos", accent: "#a8d4b5" },
  item: { parseContentAsJson: true, fields: { title: "album" } },
  detail: {
    mode: "gallery",
    title: "album",
    collection: "shots",
    image: "url",
    caption: "caption",
    rowLink: "url",
    openLabel: "Open album",
  },
})

const changelogItem: TaggedItem = {
  provider: "changelog",
  item: {
    id: 1,
    repository_id: 10,
    content: "## Titre\n**gras** et `code`",
    datetime: "2026-03-01T10:00:00Z",
    executed_at: "2026-03-01T11:00:00Z",
    success: true,
    version: "v1.2.3",
  },
}

function youtubeItem(content: unknown): TaggedItem {
  return {
    provider: "youtube",
    item: {
      id: 2,
      repository_id: 11,
      version: "1",
      content: typeof content === "string" ? content : JSON.stringify(content),
      datetime: "2026-02-01T10:00:00Z",
      executed_at: "2026-02-01T11:00:00Z",
      success: true,
    },
  }
}

function rssTagged(content: unknown): TaggedItem {
  return {
    provider: "rss",
    item: {
      id: 3,
      repository_id: 12,
      content: typeof content === "string" ? content : JSON.stringify(content),
      datetime: "2026-01-01T10:00:00Z",
      executed_at: "2026-01-01T11:00:00Z",
      success: true,
    },
  }
}

function scrapTagged(params: unknown, content = "Contenu scrapé"): TaggedItem {
  return {
    provider: "scrap",
    item: {
      id: 4,
      repository_id: 13,
      content,
      params: params as never,
      executed_at: "2025-12-01T11:00:00Z",
      success: true,
    },
  }
}

function genericTagged(
  overrides: Partial<{ content: string; version: string | null; datetime: string | null }> = {},
): TaggedItem {
  return {
    provider: "podcast",
    item: {
      id: 5,
      repository_id: 14,
      content: "Corps générique",
      version: "s02e04",
      datetime: "2026-04-01T10:00:00Z",
      executed_at: "2026-04-01T11:00:00Z",
      ...overrides,
    },
  }
}

beforeEach(() => {
  stubStorage()
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
  useSelectedFeedItemStore.setState({ item: null, repoUrl: "", template: null, source: undefined })
  useReadItemsStore.setState({ readIds: new Set(), initialized: true })
})

afterEach(() => openURL.mockRestore())

describe("FeedDetailScreen — cadre", () => {
  it("renders nothing without a selected item", async () => {
    const { toJSON } = await renderWithProviders(<FeedDetailScreen />)
    expect(toJSON()).toBeNull()
  })

  it("marks the opened item as read", async () => {
    select(rssTagged({ title: "A" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() =>
      expect(asyncStorage.setItem).toHaveBeenCalledWith("read_items", JSON.stringify(["rss:3"])),
    )
  })

  it("goes back", async () => {
    select(rssTagged({ title: "A" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByTestId("icon-ChevronLeft")).toBeTruthy())
    await fireEvent.press(screen.getByTestId("icon-ChevronLeft"))
    expect(mockRouter.back).toHaveBeenCalled()
  })
})

describe("FeedDetailScreen — taille de police", () => {
  it("restores the stored offset", async () => {
    stubStorage({ [FONT_KEY]: "4" })
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Corps").props.style.fontSize).toBe(20))
  })

  it("ignores a malformed stored offset", async () => {
    stubStorage({ [FONT_KEY]: "abc" })
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Corps").props.style.fontSize).toBe(16))
  })

  it("increases and persists the font size", async () => {
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("A+")).toBeTruthy())
    await fireEvent.press(screen.getByText("A+"))
    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalledWith(FONT_KEY, "1"))
    expect(screen.getByText("Corps").props.style.fontSize).toBe(17)
  })

  it("decreases and persists the font size", async () => {
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("A−")).toBeTruthy())
    await fireEvent.press(screen.getByText("A−"))
    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalledWith(FONT_KEY, "-1"))
  })

  it("clamps at the minimum offset", async () => {
    stubStorage({ [FONT_KEY]: "-4" })
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Corps").props.style.fontSize).toBe(12))
    await fireEvent.press(screen.getByText("A−"))
    expect(asyncStorage.setItem).not.toHaveBeenCalledWith(FONT_KEY, expect.anything())
    expect(screen.getByText("Corps").props.style.fontSize).toBe(12)
  })

  it("clamps at the maximum offset", async () => {
    stubStorage({ [FONT_KEY]: "10" })
    select(rssTagged({ title: "A", summary: "Corps" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Corps").props.style.fontSize).toBe(26))
    await fireEvent.press(screen.getByText("A+"))
    expect(asyncStorage.setItem).not.toHaveBeenCalledWith(FONT_KEY, expect.anything())
    expect(screen.getByText("Corps").props.style.fontSize).toBe(26)
  })
})

describe("FeedDetailScreen — changelog (template text)", () => {
  it("shows the repo slug, version and cleaned markdown", async () => {
    select(changelogItem, "https://github.com/facebook/react")
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("facebook/react").length).toBeGreaterThan(0))
    expect(screen.getByText("v1.2.3")).toBeTruthy()
    expect(screen.getByText("Titre\ngras et code")).toBeTruthy()
  })

  it("hides the open button without a source url", async () => {
    select(changelogItem)
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("v1.2.3")).toBeTruthy())
    expect(screen.queryByText("Open on GitHub")).toBeNull()
  })

  it("opens the release page", async () => {
    select(changelogItem, "https://github.com/facebook/react")
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Open on GitHub")).toBeTruthy())
    await fireEvent.press(screen.getByText("Open on GitHub"))
    expect(openURL).toHaveBeenCalledWith("https://github.com/facebook/react/releases/tag/v1.2.3")
  })

  it("hides the body when the changelog is empty", async () => {
    select({ ...changelogItem, item: { ...changelogItem.item, content: "" } } as TaggedItem)
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("v1.2.3")).toBeTruthy())
  })
})

describe("FeedDetailScreen — youtube (template media)", () => {
  it("shows the title, channel handle and links out", async () => {
    select(
      youtubeItem({
        title: "Ma vidéo",
        url: "https://www.youtube.com/@fireship",
        thumbnail: "https://img.example.com/t.jpg",
        link: "https://youtu.be/xyz",
      }),
    )
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Ma vidéo").length).toBeGreaterThan(0))
    expect(screen.getByText("@fireship")).toBeTruthy()
    expect(screen.getByText("Watch on YouTube")).toBeTruthy()
  })

  it("keeps the channel path for a /channel/ url", async () => {
    select(youtubeItem({ title: "V", url: "https://www.youtube.com/channel/UC123" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("channel/UC123")).toBeTruthy())
  })

  it("hides the open button on malformed content", async () => {
    select(youtubeItem("{cassé"))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("A+")).toBeTruthy())
    expect(screen.queryByText("Watch on YouTube")).toBeNull()
  })

  it("opens the video", async () => {
    select(youtubeItem({ title: "V", link: "https://youtu.be/xyz" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Watch on YouTube")).toBeTruthy())
    await fireEvent.press(screen.getByText("Watch on YouTube"))
    expect(openURL).toHaveBeenCalledWith("https://youtu.be/xyz")
  })
})

describe("FeedDetailScreen — rss (template html)", () => {
  it("shows the title, source and html-stripped summary", async () => {
    select(
      rssTagged({
        title: "Mon article",
        link: "https://www.blog.example.com/a",
        summary: "<p>Un &amp; résumé</p>",
      }),
    )
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Mon article").length).toBeGreaterThan(0))
    expect(screen.getByText("blog.example.com")).toBeTruthy()
    expect(screen.getByText("Un & résumé")).toBeTruthy()
    expect(screen.getByText("Read article")).toBeTruthy()
  })

  it("keeps a malformed link as the source", async () => {
    select(rssTagged({ title: "A", link: "pas-une-url" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("pas-une-url")).toBeTruthy())
  })

  it("hides the open button on malformed content", async () => {
    select(rssTagged("{cassé"))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("A+")).toBeTruthy())
    expect(screen.queryByText("Read article")).toBeNull()
  })

  it("opens the article", async () => {
    select(rssTagged({ title: "A", link: "https://example.com/a" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Read article")).toBeTruthy())
    await fireEvent.press(screen.getByText("Read article"))
    expect(openURL).toHaveBeenCalledWith("https://example.com/a")
  })
})

describe("FeedDetailScreen — scraping (template text)", () => {
  it("shows the source hostname, content and open button", async () => {
    select(scrapTagged({ url: "https://example.com/blog" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("example.com").length).toBeGreaterThan(0))
    expect(screen.getByText("Contenu scrapé")).toBeTruthy()
    expect(screen.getByText("Visit website")).toBeTruthy()
  })

  it("parses params given as a JSON string", async () => {
    select(scrapTagged(JSON.stringify({ url: "https://example.org/x" })))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("example.org").length).toBeGreaterThan(0))
  })

  it("tolerates malformed params", async () => {
    select(scrapTagged("{cassé"))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Contenu scrapé")).toBeTruthy())
    expect(screen.queryByText("Visit website")).toBeNull()
  })

  it("hides the body when the content is empty", async () => {
    select(scrapTagged({ url: "https://example.com/x" }, ""))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("example.com").length).toBeGreaterThan(0))
    expect(screen.queryByText("Contenu scrapé")).toBeNull()
  })

  it("opens the scraped site", async () => {
    select(scrapTagged({ url: "https://example.com/blog" }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getByText("Visit website")).toBeTruthy())
    await fireEvent.press(screen.getByText("Visit website"))
    expect(openURL).toHaveBeenCalledWith("https://example.com/blog")
  })
})

describe("FeedDetailScreen — modes audio & gallery", () => {
  it("renders an audio episode: cover, notes and an open button", async () => {
    select(
      {
        provider: "podcast",
        item: {
          id: 6,
          repository_id: 6,
          content: JSON.stringify({
            title: "Épisode 12",
            cover: "https://cdn.example.com/c.jpg",
            audio: "https://cdn.example.com/ep.mp3",
            notes: "Notes de l'épisode",
            page: "https://pod.example.com/12",
          }),
          datetime: "2026-05-01T10:00:00Z",
          executed_at: "2026-05-01T11:00:00Z",
          success: true,
        },
      },
      "",
      audioTemplate,
    )
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Épisode 12").length).toBeGreaterThan(0))
    expect(screen.getByText("Notes de l'épisode")).toBeTruthy()
    await fireEvent.press(screen.getByText("Open episode"))
    expect(openURL).toHaveBeenCalledWith("https://pod.example.com/12")
  })

  it("renders a gallery of images with captions", async () => {
    select(
      {
        provider: "photos",
        item: {
          id: 7,
          repository_id: 7,
          content: JSON.stringify({
            album: "Kyoto",
            shots: [
              { url: "https://cdn.example.com/1.jpg", caption: "Fushimi Inari" },
              { url: "https://cdn.example.com/2.jpg", caption: "Arashiyama" },
            ],
          }),
          datetime: "2026-05-02T10:00:00Z",
          executed_at: "2026-05-02T11:00:00Z",
          success: true,
        },
      },
      "",
      galleryTemplate,
    )
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Kyoto").length).toBeGreaterThan(0))
    expect(screen.getByText("Fushimi Inari")).toBeTruthy()
    expect(screen.getByText("Arashiyama")).toBeTruthy()
  })
})

describe("FeedDetailScreen — provider sans template", () => {
  it("renders the generic detail with the capitalized provider label", async () => {
    select(genericTagged())
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Podcast")).toHaveLength(2))
    expect(screen.getByText("s02e04")).toBeTruthy()
    expect(screen.getByText("Corps générique")).toBeTruthy()
  })

  it("omits the version and the body when the item carries neither", async () => {
    select(genericTagged({ content: "", version: null }))
    await renderWithProviders(<FeedDetailScreen />)
    await waitFor(() => expect(screen.getAllByText("Podcast")).toHaveLength(2))
    expect(screen.queryByText("s02e04")).toBeNull()
    expect(screen.queryByText("Corps générique")).toBeNull()
  })
})
