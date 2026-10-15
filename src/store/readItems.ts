import { create } from "zustand"
import { readReadItems, writeReadItems } from "@/lib/store"
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

interface ReadItemsState {
  readIds: Set<string>
  initialized: boolean
  init: () => Promise<void>
  markRead: (tagged: TaggedItem) => Promise<void>
  markAllRead: (items: TaggedItem[]) => Promise<void>
  cleanup: (currentIds: Set<string>) => Promise<void>
}

export const useReadItemsStore = create<ReadItemsState>()((set, get) => ({
  readIds: new Set(),
  initialized: false,

  init: async () => {
    if (get().initialized) return
    const stored = migrateIds(await readReadItems())
    set({ readIds: new Set(stored), initialized: true })
  },

  markRead: async (tagged: TaggedItem) => {
    const id = getTaggedItemId(tagged)
    const { readIds } = get()
    if (readIds.has(id)) return
    const next = new Set(readIds)
    next.add(id)
    set({ readIds: next })
    await writeReadItems([...next])
  },

  markAllRead: async (items: TaggedItem[]) => {
    const { readIds } = get()
    const next = new Set(readIds)
    for (const tagged of items) next.add(getTaggedItemId(tagged))
    if (next.size === readIds.size) return
    set({ readIds: next })
    await writeReadItems([...next])
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
