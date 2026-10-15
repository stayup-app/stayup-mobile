import AsyncStorage from "@react-native-async-storage/async-storage"
import { useReadItemsStore, getTaggedItemId } from "../src/store/readItems"
import { useNavigationStore } from "../src/store/navigation"
import { useSelectedFeedItemStore } from "../src/store/selectedFeedItem"
import type { TaggedItem } from "../src/types"

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }

function rssItem(id: number): TaggedItem {
  return {
    provider: "rss",
    item: {
      id,
      repository_id: 1,
      content: "{}",
      datetime: null,
      executed_at: "2026-01-01T00:00:00Z",
      success: true,
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  asyncStorage.getItem.mockResolvedValue(null)
  useReadItemsStore.setState({ readIds: new Set(), initialized: false })
  useNavigationStore.setState({ selection: { type: "all" } })
  useSelectedFeedItemStore.setState({ item: null, repoUrl: "" })
})

describe("getTaggedItemId", () => {
  it("combines provider and item id", () => {
    expect(getTaggedItemId(rssItem(7))).toBe("rss:7")
  })
})

describe("useReadItemsStore", () => {
  it("init loads stored ids once", async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(["rss:1"]))
    await useReadItemsStore.getState().init()

    expect(useReadItemsStore.getState().readIds).toEqual(new Set(["rss:1"]))
    expect(useReadItemsStore.getState().initialized).toBe(true)
  })

  it("init is a no-op once initialized", async () => {
    useReadItemsStore.setState({ initialized: true })
    await useReadItemsStore.getState().init()
    expect(asyncStorage.getItem).not.toHaveBeenCalled()
  })

  it("init drops the instance segment of keys stored by multi-server versions", async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(["rss:1", "x:rss:9"]))
    await useReadItemsStore.getState().init()
    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:1", "rss:9"])
  })

  it("markRead adds the id and persists it", async () => {
    await useReadItemsStore.getState().markRead(rssItem(1))

    expect(useReadItemsStore.getState().readIds.has("rss:1")).toBe(true)
    expect(asyncStorage.setItem).toHaveBeenCalledWith("read_items", JSON.stringify(["rss:1"]))
  })

  it("markRead does not persist an already-read item", async () => {
    useReadItemsStore.setState({ readIds: new Set(["rss:1"]) })
    await useReadItemsStore.getState().markRead(rssItem(1))
    expect(asyncStorage.setItem).not.toHaveBeenCalled()
  })

  it("markAllRead adds every missing id", async () => {
    await useReadItemsStore.getState().markAllRead([rssItem(1), rssItem(2)])

    expect(useReadItemsStore.getState().readIds).toEqual(new Set(["rss:1", "rss:2"]))
    expect(asyncStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it("markAllRead is a no-op when nothing is new", async () => {
    useReadItemsStore.setState({ readIds: new Set(["rss:1"]) })
    await useReadItemsStore.getState().markAllRead([rssItem(1)])
    expect(asyncStorage.setItem).not.toHaveBeenCalled()
  })

  it("cleanup drops ids that are no longer in the feed", async () => {
    useReadItemsStore.setState({ readIds: new Set(["rss:1", "rss:2"]) })
    await useReadItemsStore.getState().cleanup(new Set(["rss:1"]))

    expect(useReadItemsStore.getState().readIds).toEqual(new Set(["rss:1"]))
    expect(asyncStorage.setItem).toHaveBeenCalledWith("read_items", JSON.stringify(["rss:1"]))
  })

  it("cleanup is a no-op when every id is still present", async () => {
    useReadItemsStore.setState({ readIds: new Set(["rss:1"]) })
    await useReadItemsStore.getState().cleanup(new Set(["rss:1", "rss:2"]))
    expect(asyncStorage.setItem).not.toHaveBeenCalled()
  })
})

describe("useNavigationStore", () => {
  it("defaults to the whole feed", () => {
    expect(useNavigationStore.getState().selection).toEqual({ type: "all" })
  })

  it("stores a category selection", () => {
    useNavigationStore.getState().setSelection({ type: "category", provider: "youtube" })
    expect(useNavigationStore.getState().selection).toEqual({
      type: "category",
      provider: "youtube",
    })
  })

  it("stores a flux selection", () => {
    useNavigationStore.getState().setSelection({ type: "flux", fluxId: "a", provider: "rss" })
    expect(useNavigationStore.getState().selection).toEqual({
      type: "flux",
      fluxId: "a",
      provider: "rss",
    })
  })
})

describe("useSelectedFeedItemStore", () => {
  it("stores the item and its repository url", () => {
    const item = rssItem(3)
    useSelectedFeedItemStore.getState().setItem(item, { repoUrl: "https://example.com" })

    expect(useSelectedFeedItemStore.getState().item).toBe(item)
    expect(useSelectedFeedItemStore.getState().repoUrl).toBe("https://example.com")
  })

  it("defaults the repository url to an empty string", () => {
    useSelectedFeedItemStore.getState().setItem(rssItem(4))
    expect(useSelectedFeedItemStore.getState().repoUrl).toBe("")
  })

  it("clears the selection", () => {
    useSelectedFeedItemStore.getState().setItem(rssItem(5), { repoUrl: "https://example.com" })
    useSelectedFeedItemStore.getState().setItem(null)

    expect(useSelectedFeedItemStore.getState().item).toBeNull()
    expect(useSelectedFeedItemStore.getState().repoUrl).toBe("")
  })
})
