import { useState, useEffect, useMemo, useCallback } from "react"
import { View, Text, Pressable, TextInput } from "react-native"
import { CheckCheck, Search, X } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useAuth } from "@/hooks/useAuth"
import { useFeed, type FeedFlux } from "@/hooks/useFeed"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { useLanguage } from "@/context/LanguageContext"
import { listSavedItems, searchItems } from "@/lib/api"
import { UnifiedFeedList } from "@/components/feed/UnifiedFeedList"
import { FeedFluxList } from "@/components/feed/FeedFluxList"
import { AddFluxSheet } from "@/components/feed/AddFluxSheet"
import { FolderSheet } from "@/components/feed/FolderSheet"
import { LoadingScreen } from "@/components/ui/LoadingScreen"
import { useSelectedFeedItemStore } from "@/store/selectedFeedItem"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import { colors } from "@/theme"
import type { Provider, TaggedItem } from "@/types"

type FilterMode = "all" | "unread" | "saved"

/** A search is only sent from this many characters on (the API refuses less). */
const MIN_QUERY = 2

/** Rows coming back from the API carry their provider column: they are tagged
 *  the same way the feed's rows are. */
function tagRows(rows: Array<TaggedItem["item"] & { provider: string }>): TaggedItem[] {
  return rows.map((row) => ({ provider: row.provider, item: row }))
}

export default function FeedScreen() {
  const router = useRouter()
  const auth = useAuth()
  const { t, lang } = useLanguage()
  // The API rejected the token: sign out and go back to the login screen.
  // Depend on the stable `logout`, not on `auth` (a new object every render),
  // otherwise useFeed's load effect re-runs after each render and refetches forever.
  const { logout } = auth
  const handleAuthError = useCallback(async () => {
    await logout()
    router.replace("/(auth)/login")
  }, [logout, router])
  const { fluxes, connectors, templates, loading, error, refresh } = useFeed(
    auth.token,
    handleAuthError,
  )
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [filterState, setFilterState] = useState<{ providerId: Provider | null; mode: FilterMode }>(
    {
      providerId: null,
      mode: "all",
    },
  )
  const filterMode = filterState.providerId === selectedProvider ? filterState.mode : "all"
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [movingFlux, setMovingFlux] = useState<FeedFlux | null>(null)
  const [query, setQuery] = useState("")
  // Rows that do not come from the feed (saved items, search results). `null`
  // while the feed's own items are shown.
  const [remote, setRemote] = useState<TaggedItem[] | null>(null)
  const [addVisible, setAddVisible] = useState(false)
  const { item: openItem, setItem } = useSelectedFeedItemStore()
  const { readIds, initialized, init, markAllRead, cleanup } = useReadItemsStore()
  const openItemId = openItem ? getTaggedItemId(openItem) : null

  const userId = auth.session?.userId
  useEffect(() => {
    if (userId && auth.token) void init({ userId, token: auth.token })
  }, [init, userId, auth.token])

  const searching = query.trim().length >= MIN_QUERY
  const wantsSaved = filterMode === "saved"
  useEffect(() => {
    if (!userId || !auth.token) return
    if (!searching && !wantsSaved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemote(null)
      return
    }
    let cancelled = false
    // Typing fires this on every key: wait for a pause.
    const timer = setTimeout(
      async () => {
        try {
          const rows = searching
            ? await searchItems(userId, query.trim(), auth.token as string)
            : await listSavedItems(userId, auth.token as string)
          if (!cancelled) setRemote(tagRows(rows))
        } catch {
          if (!cancelled) setRemote([])
        }
      },
      searching ? 300 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searching, wantsSaved, query, userId, auth.token])

  useEffect(() => {
    if (!connectors || !initialized) return
    const allIds = new Set(
      Object.entries(connectors).flatMap(([provider, items]) =>
        items.map((item) => getTaggedItemId({ provider, item } as TaggedItem)),
      ),
    )
    void cleanup(allIds)
  }, [connectors, initialized, cleanup])

  const c = connectors ?? {}

  const allTaggedItems = useMemo<TaggedItem[]>(
    () =>
      Object.entries(c).flatMap(([provider, items]) =>
        items.map((item) => ({ provider, item }) as TaggedItem),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectors],
  )

  const unreadCountByRepoId = useMemo<Record<number, number>>(() => {
    const counts: Record<number, number> = {}
    for (const tagged of allTaggedItems) {
      if (!readIds.has(getTaggedItemId(tagged))) {
        const k = tagged.item.repository_id
        counts[k] = (counts[k] ?? 0) + 1
      }
    }
    return counts
  }, [allTaggedItems, readIds])

  const unreadCount = useMemo(
    () => allTaggedItems.filter((t) => !readIds.has(getTaggedItemId(t))).length,
    [allTaggedItems, readIds],
  )

  usePushNotifications(userId, auth.token, lang, unreadCount)

  function handlePressItem(tagged: TaggedItem) {
    const flux = (fluxes ?? []).find((r) => r.repository_id === tagged.item.repository_id)
    setItem(tagged, {
      repoUrl: flux?.url ?? "",
      template: templates[tagged.provider]?.template ?? null,
      source: flux ? { url: flux.url, type: flux.provider, config: {} } : undefined,
    })
    router.push("/feed/detail")
  }

  if (loading && !connectors) {
    return <LoadingScreen message={t.feed.loading} />
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg">
        <Text className="text-sm text-rose">{error}</Text>
        <Pressable onPress={refresh} className="rounded-xl bg-peach px-4 py-2.5">
          <Text className="font-semibold text-peach-on">{t.feed.retry}</Text>
        </Pressable>
      </View>
    )
  }

  const folderRepoIds = selectedFolder
    ? new Set(fluxes.filter((f) => f.folder === selectedFolder).map((f) => f.repository_id))
    : null
  const scopedItems = selectedProvider
    ? allTaggedItems.filter((tagged) => tagged.provider === selectedProvider)
    : folderRepoIds
      ? allTaggedItems.filter((tagged) => folderRepoIds.has(tagged.item.repository_id))
      : allTaggedItems

  // What the list draws from: the feed's items, or the remote rows.
  const providerFilteredItems = remote ?? (searching || wantsSaved ? [] : scopedItems)

  const filteredItems =
    filterMode === "unread" && !searching
      ? providerFilteredItems.filter(
          (tagged) =>
            !readIds.has(getTaggedItemId(tagged)) || getTaggedItemId(tagged) === openItemId,
        )
      : providerFilteredItems

  const totalItems = scopedItems.length

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <FeedFluxList
        fluxes={fluxes}
        templates={templates}
        userId={auth.session?.userId ?? ""}
        token={auth.token as string}
        selectedProvider={selectedProvider}
        onSelectProvider={(p) => {
          setSelectedProvider(p)
          setSelectedFolder(null)
        }}
        selectedFolder={selectedFolder}
        onSelectFolder={(folder) => {
          setSelectedFolder(folder)
          setSelectedProvider(null)
        }}
        onMoveToFolder={setMovingFlux}
        onAddPress={() => setAddVisible(true)}
        onDeleted={refresh}
        onImported={refresh}
        unreadCountByRepoId={unreadCountByRepoId}
      />

      {/* Filter bar */}
      <View
        className="flex-row items-center gap-1 border-b px-3 py-1.5"
        style={{ borderColor: colors.borderSoft }}
      >
        <Pressable
          onPress={() => setFilterState({ providerId: selectedProvider, mode: "all" })}
          className="flex-row items-center gap-1.5 rounded-md px-2.5 py-1"
          style={filterMode === "all" ? { backgroundColor: colors.surface } : undefined}
        >
          <Text
            className="text-[15px]"
            style={{ color: filterMode === "all" ? colors.fg : colors.muted }}
          >
            {t.feed.filterAll}
          </Text>
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: colors.surfaceHi }}>
            <Text className="text-xs font-mono" style={{ color: colors.dim }}>
              {totalItems}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setFilterState({ providerId: selectedProvider, mode: "unread" })}
          className="flex-row items-center gap-1.5 rounded-md px-2.5 py-1"
          style={filterMode === "unread" ? { backgroundColor: colors.surface } : undefined}
        >
          <Text
            className="text-[15px]"
            style={{ color: filterMode === "unread" ? colors.fg : colors.muted }}
          >
            {t.feed.filterUnread}
          </Text>
          {unreadCount > 0 && (
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: colors.peachDim }}>
              <Text className="text-xs font-mono font-semibold" style={{ color: colors.peach }}>
                {unreadCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => setFilterState({ providerId: selectedProvider, mode: "saved" })}
          className="flex-row items-center gap-1.5 rounded-md px-2.5 py-1"
          style={filterMode === "saved" ? { backgroundColor: colors.surface } : undefined}
        >
          <Text
            className="text-[15px]"
            style={{ color: filterMode === "saved" ? colors.fg : colors.muted }}
          >
            {t.feed.filterSaved}
          </Text>
        </Pressable>

        <View className="flex-1" />

        {unreadCount > 0 && (
          <Pressable
            onPress={() => void markAllRead(allTaggedItems)}
            accessibilityLabel={t.feed.markAllRead}
            className="rounded p-1.5"
          >
            <CheckCheck size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View
        className="flex-row items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: colors.borderSoft }}
      >
        <Search size={15} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.feed.searchPlaceholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t.feed.searchPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="flex-1 py-1 text-[15px]"
          style={{ color: colors.fg }}
        />
        {query !== "" && (
          <Pressable onPress={() => setQuery("")} accessibilityLabel={t.feed.clearSearch}>
            <X size={15} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <UnifiedFeedList
        items={filteredItems}
        templates={templates}
        repositories={fluxes}
        loading={loading}
        onRefresh={refresh}
        onPressItem={handlePressItem}
        readIds={readIds}
        openItemId={openItemId ?? undefined}
      />

      <FolderSheet
        key={movingFlux?.id ?? "none"}
        flux={movingFlux}
        userId={auth.session?.userId ?? ""}
        token={auth.token as string}
        onClose={() => setMovingFlux(null)}
        onSaved={refresh}
      />

      <AddFluxSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        token={auth.token as string}
        onSuccess={refresh}
      />
    </SafeAreaView>
  )
}
