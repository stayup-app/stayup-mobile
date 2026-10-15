import { create } from "zustand"
import { readReadItems, writeReadItems } from "@/lib/store"
import { getItemState, markItemsRead, setItemSaved } from "@/lib/api"
import type { TaggedItem } from "@/types"

/** Key for a read item: `<provider>:<id>`. */
export function getTaggedItemId(tagged: TaggedItem): string {
  return `${tagged.provider}:${tagged.item.id}`
}

/** Drops the instance segment of keys stored by multi-server versions
 *  (`<instanceId>:<provider>:<id>`), keeping the read state. */
function migrateIds(stored: string[]): string[] {
  return stored.map((id) => {
    const parts = id.split(":")
    return parts.length === 3 ? parts.slice(1).join(":") : id
  })
}

/** The API takes at most this many ids per request. */
const SYNC_BATCH = 1000

/** Who the state is synced for. Without it the store stays purely local. */
export interface SyncAuth {
  userId: string
  token: string
}

function itemNumber(key: string): number {
  return Number(key.slice(key.lastIndexOf(":") + 1))
}

interface ReadItemsState {
  readIds: Set<string>
  savedIds: Set<string>
  initialized: boolean
  /** True once the server's state had its chance to be merged in. */
  ready: boolean
  sync: SyncAuth | null
  init: (sync?: SyncAuth) => Promise<void>
  markRead: (tagged: TaggedItem) => Promise<void>
  markAllRead: (items: TaggedItem[]) => Promise<void>
  toggleSaved: (tagged: TaggedItem) => Promise<void>
  cleanup: (currentIds: Set<string>) => Promise<void>
}

/** Tells the API these keys are read. Best effort: whatever fails to go through
 *  is uploaded again at the next start, since the server then lacks it. */
async function syncRead(sync: SyncAuth | null, keys: string[]): Promise<void> {
  if (!sync) return
  const ids = keys.map(itemNumber).filter(Number.isInteger)
  for (let i = 0; i < ids.length; i += SYNC_BATCH) {
    try {
      await markItemsRead(sync.userId, ids.slice(i, i + SYNC_BATCH), sync.token)
    } catch {
      /* ignore */
    }
  }
}

export const useReadItemsStore = create<ReadItemsState>()((set, get) => ({
  readIds: new Set(),
  savedIds: new Set(),
  initialized: false,
  ready: false,
  sync: null,

  init: async (sync) => {
    if (get().initialized) return
    const local = migrateIds(await readReadItems())
    set({ readIds: new Set(local), initialized: true, sync: sync ?? null })
    if (!sync) {
      set({ ready: true })
      return
    }

    // The server is the source of truth across devices; what only this device
    // had read is uploaded once.
    try {
      const state = await getItemState(sync.userId, sync.token)
      const server = new Set(state.read)
      const merged = new Set([...server, ...get().readIds])
      set({ readIds: merged, savedIds: new Set(state.saved) })
      await writeReadItems([...merged])
      await syncRead(
        sync,
        [...merged].filter((key) => !server.has(key)),
      )
    } catch {
      /* offline: the local copy stands */
    }
    set({ ready: true })
  },

  markRead: async (tagged: TaggedItem) => {
    const id = getTaggedItemId(tagged)
    const { readIds } = get()
    if (readIds.has(id)) return
    const next = new Set(readIds)
    next.add(id)
    set({ readIds: next })
    await writeReadItems([...next])
    await syncRead(get().sync, [id])
  },

  markAllRead: async (items: TaggedItem[]) => {
    const { readIds } = get()
    const next = new Set(readIds)
    for (const tagged of items) next.add(getTaggedItemId(tagged))
    if (next.size === readIds.size) return
    set({ readIds: next })
    await writeReadItems([...next])
    await syncRead(
      get().sync,
      [...next].filter((key) => !readIds.has(key)),
    )
  },

  toggleSaved: async (tagged: TaggedItem) => {
    const id = getTaggedItemId(tagged)
    const next = new Set(get().savedIds)
    const saved = !next.has(id)
    if (saved) next.add(id)
    else next.delete(id)
    set({ savedIds: next })
    const { sync } = get()
    if (!sync) return
    try {
      await setItemSaved(sync.userId, tagged.item.id, saved, sync.token)
    } catch {
      /* ignore */
    }
  },

  cleanup: async (currentIds: Set<string>) => {
    const { readIds } = get()
    const filtered = [...readIds].filter((id) => currentIds.has(id))
    if (filtered.length === readIds.size) return
    const next = new Set(filtered)
    set({ readIds: next })
    await writeReadItems(filtered)
  },
}))
