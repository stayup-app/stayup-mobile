import { useReadItemsStore } from "../src/store/readItems"
import { readReadItems, writeReadItems } from "../src/lib/store"
import { getItemState, markItemsRead, setItemSaved } from "../src/lib/api"
import type { TaggedItem } from "../src/types"

jest.mock("../src/lib/store", () => ({
  readReadItems: jest.fn(),
  writeReadItems: jest.fn(),
}))
jest.mock("../src/lib/api", () => ({
  getItemState: jest.fn(),
  markItemsRead: jest.fn(),
  setItemSaved: jest.fn(),
}))

const SYNC = { userId: "u1", token: "jwt" }

function tagged(id: number, provider = "rss"): TaggedItem {
  return {
    provider,
    item: { id, repository_id: 1, content: "", executed_at: "2024-01-01", success: true },
  } as TaggedItem
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(readReadItems as jest.Mock).mockResolvedValue([])
  ;(writeReadItems as jest.Mock).mockResolvedValue(undefined)
  ;(getItemState as jest.Mock).mockResolvedValue({ read: [], saved: [] })
  ;(markItemsRead as jest.Mock).mockResolvedValue(undefined)
  ;(setItemSaved as jest.Mock).mockResolvedValue(undefined)
  useReadItemsStore.setState({
    readIds: new Set(),
    savedIds: new Set(),
    initialized: false,
    ready: false,
    sync: null,
  })
})

describe("init with the server", () => {
  it("adopts the server's read and saved items", async () => {
    ;(getItemState as jest.Mock).mockResolvedValue({ read: ["rss:7"], saved: ["rss:9"] })
    await useReadItemsStore.getState().init(SYNC)

    const state = useReadItemsStore.getState()
    expect([...state.readIds]).toEqual(["rss:7"])
    expect([...state.savedIds]).toEqual(["rss:9"])
    expect(state.ready).toBe(true)
    expect(writeReadItems).toHaveBeenCalledWith(["rss:7"])
  })

  it("uploads what only this device had read, and keeps both", async () => {
    ;(readReadItems as jest.Mock).mockResolvedValue(["rss:1", "rss:7"])
    ;(getItemState as jest.Mock).mockResolvedValue({ read: ["rss:7"], saved: [] })
    await useReadItemsStore.getState().init(SYNC)

    expect([...useReadItemsStore.getState().readIds].sort()).toEqual(["rss:1", "rss:7"])
    expect(markItemsRead).toHaveBeenCalledWith("u1", [1], "jwt")
  })

  it("uploads in batches of 1000", async () => {
    ;(readReadItems as jest.Mock).mockResolvedValue(
      Array.from({ length: 2500 }, (_, i) => `rss:${i + 1}`),
    )
    await useReadItemsStore.getState().init(SYNC)

    const sizes = (markItemsRead as jest.Mock).mock.calls.map((c) => c[1].length)
    expect(sizes).toEqual([1000, 1000, 500])
  })

  it("keeps the local copy when the server is unreachable", async () => {
    ;(readReadItems as jest.Mock).mockResolvedValue(["rss:5"])
    ;(getItemState as jest.Mock).mockRejectedValue(new Error("offline"))
    await useReadItemsStore.getState().init(SYNC)

    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:5"])
    expect(useReadItemsStore.getState().ready).toBe(true)
  })

  it("stays local, and ready, without credentials", async () => {
    await useReadItemsStore.getState().init()
    expect(getItemState).not.toHaveBeenCalled()
    expect(useReadItemsStore.getState().ready).toBe(true)
  })

  it("runs once", async () => {
    await useReadItemsStore.getState().init(SYNC)
    await useReadItemsStore.getState().init(SYNC)
    expect(getItemState).toHaveBeenCalledTimes(1)
  })
})

describe("syncing marks", () => {
  beforeEach(async () => {
    await useReadItemsStore.getState().init(SYNC)
    ;(markItemsRead as jest.Mock).mockClear()
  })

  it("tells the server an item is read, once", async () => {
    await useReadItemsStore.getState().markRead(tagged(3))
    await useReadItemsStore.getState().markRead(tagged(3))
    expect(markItemsRead).toHaveBeenCalledTimes(1)
    expect(markItemsRead).toHaveBeenCalledWith("u1", [3], "jwt")
  })

  it("sends only the items that were not read yet when marking all", async () => {
    await useReadItemsStore.getState().markRead(tagged(1))
    ;(markItemsRead as jest.Mock).mockClear()
    await useReadItemsStore.getState().markAllRead([tagged(1), tagged(2), tagged(3)])
    expect(markItemsRead).toHaveBeenCalledWith("u1", [2, 3], "jwt")
  })

  it("does nothing when everything is already read", async () => {
    await useReadItemsStore.getState().markRead(tagged(1))
    ;(markItemsRead as jest.Mock).mockClear()
    await useReadItemsStore.getState().markAllRead([tagged(1)])
    expect(markItemsRead).not.toHaveBeenCalled()
  })

  it("survives the server rejecting a mark", async () => {
    ;(markItemsRead as jest.Mock).mockRejectedValue(new Error("500"))
    await useReadItemsStore.getState().markRead(tagged(4))
    expect(useReadItemsStore.getState().readIds.has("rss:4")).toBe(true)
  })

  it("saves and unsaves an item through the API", async () => {
    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(true)
    expect(setItemSaved).toHaveBeenLastCalledWith("u1", 8, true, "jwt")

    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(false)
    expect(setItemSaved).toHaveBeenLastCalledWith("u1", 8, false, "jwt")
  })

  it("survives the server rejecting a save", async () => {
    ;(setItemSaved as jest.Mock).mockRejectedValue(new Error("500"))
    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(true)
  })

  it("drops read ids that are no longer in the feed, only when something changes", async () => {
    await useReadItemsStore.getState().markRead(tagged(1))
    await useReadItemsStore.getState().markRead(tagged(2))
    ;(writeReadItems as jest.Mock).mockClear()

    await useReadItemsStore.getState().cleanup(new Set(["rss:1", "rss:2"]))
    expect(writeReadItems).not.toHaveBeenCalled()

    await useReadItemsStore.getState().cleanup(new Set(["rss:1"]))
    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:1"])
    expect(writeReadItems).toHaveBeenCalledWith(["rss:1"])
  })
})

describe("without credentials", () => {
  it("works locally and calls nothing", async () => {
    await useReadItemsStore.getState().init()
    await useReadItemsStore.getState().markRead(tagged(1))
    await useReadItemsStore.getState().markAllRead([tagged(2)])
    await useReadItemsStore.getState().toggleSaved(tagged(3))

    expect(markItemsRead).not.toHaveBeenCalled()
    expect(setItemSaved).not.toHaveBeenCalled()
    expect(useReadItemsStore.getState().savedIds.has("rss:3")).toBe(true)
  })
})

describe("legacy keys", () => {
  it("drops the instance segment of keys stored by multi-server versions", async () => {
    ;(readReadItems as jest.Mock).mockResolvedValue(["rss:1", "i2:rss:9"])
    await useReadItemsStore.getState().init()
    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:1", "rss:9"])
  })
})
