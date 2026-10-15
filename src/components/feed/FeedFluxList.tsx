import { useState } from "react"
import { ScrollView, View, Text, Pressable, Alert } from "react-native"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react-native"
import { ImportExportButtons } from "./ImportExportButtons"
import type { FeedFlux } from "@/hooks/useFeed"
import { useLanguage } from "@/context/LanguageContext"
import { deleteUserRepository } from "@/lib/api"
import { colors, getProviderMeta } from "@/theme"
import { providerIcon } from "./providerIcons"
import type { ProviderMeta } from "@/lib/providerTemplate"
import type { Provider } from "@/types"

interface FeedFluxListProps {
  fluxes: FeedFlux[]
  templates: Record<string, ProviderMeta>
  userId: string
  token: string
  selectedProvider: Provider | null
  onSelectProvider: (p: Provider | null) => void
  onAddPress: () => void
  onDeleted: () => void
  onImported: () => void
  unreadCountByRepoId?: Record<number, number>
}

export function FeedFluxList({
  fluxes,
  templates,
  userId,
  token,
  selectedProvider,
  onSelectProvider,
  onAddPress,
  onDeleted,
  onImported,
  unreadCountByRepoId = {},
}: FeedFluxListProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(true)

  // Dynamic: the providers shown are those actually present in the user's
  // fluxes, not a closed hardcoded list.
  const providers = Array.from(new Set(fluxes.map((f) => f.provider)))

  function meta(p: Provider) {
    return getProviderMeta(p, templates[p]?.template)
  }

  async function handleDelete(flux: FeedFlux) {
    Alert.alert(t.common.confirmDelete, flux.identifier, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteUserRepository(userId, flux.id, token)
            onDeleted()
          } catch {
            /* ignore */
          }
        },
      },
    ])
  }

  return (
    <View className="border-b" style={{ borderColor: colors.borderSoft }}>
      {/* Header bar — always visible */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center justify-between px-4 py-2.5"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold" style={{ color: colors.fg }}>
            {t.feed.myFeeds}
          </Text>
          {/* Active-filter badge when collapsed */}
          {!expanded && selectedProvider && (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: meta(selectedProvider).dim }}
            >
              <Text className="text-sm font-medium" style={{ color: meta(selectedProvider).color }}>
                {meta(selectedProvider).label}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {/* + button always accessible */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onAddPress()
            }}
            className="rounded-full p-1"
            hitSlop={8}
          >
            <Plus size={16} color={colors.peach} />
          </Pressable>
          <ImportExportButtons fluxes={fluxes} userId={userId} onImported={onImported} />
          {expanded ? (
            <ChevronUp size={16} color={colors.muted} />
          ) : (
            <ChevronDown size={16} color={colors.muted} />
          )}
        </View>
      </Pressable>

      {/* Section repliable */}
      {expanded && (
        <>
          {/* Provider chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="flex-row gap-2 px-4 pb-2"
          >
            <Pressable
              onPress={() => onSelectProvider(null)}
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: selectedProvider === null ? colors.peach : colors.surface }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: selectedProvider === null ? colors.peachOn : colors.fgSoft }}
              >
                {t.feed.allFeeds}
              </Text>
            </Pressable>

            {providers.map((p) => {
              const providerFluxes = fluxes.filter((f) => f.provider === p)
              if (providerFluxes.length === 0) return null
              const providerUnread = providerFluxes.reduce(
                (sum, f) => sum + (unreadCountByRepoId[f.repository_id] ?? 0),
                0,
              )
              const active = selectedProvider === p
              return (
                <Pressable
                  key={p}
                  onPress={() => onSelectProvider(active ? null : p)}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: active ? meta(p).dim : colors.surface }}
                >
                  {providerIcon(templates[p]?.template?.display, 13, meta(p).color)}
                  <Text
                    className="text-base font-medium"
                    style={{ color: active ? meta(p).color : colors.fgSoft }}
                  >
                    {meta(p).label}
                  </Text>
                  {providerUnread > 0 && (
                    <View
                      className="rounded-full px-1.5 py-0.5"
                      style={{ backgroundColor: colors.peach }}
                    >
                      <Text
                        className="text-xs font-mono font-semibold"
                        style={{ color: colors.peachOn }}
                      >
                        {providerUnread}
                      </Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Individual fluxes (when a provider is selected) */}
          {selectedProvider && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-2 px-4 pb-2"
            >
              {fluxes
                .filter((f) => f.provider === selectedProvider)
                .map((flux) => {
                  const fluxUnread = unreadCountByRepoId[flux.repository_id] ?? 0
                  return (
                    <View
                      key={flux.id}
                      className="flex-row items-center gap-1 rounded-lg border px-2 py-1"
                      style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                    >
                      <Text
                        className="max-w-[140px] text-sm font-mono"
                        style={{ color: colors.fgSoft }}
                        numberOfLines={1}
                      >
                        {flux.identifier}
                      </Text>
                      {fluxUnread > 0 && (
                        <View
                          className="rounded-full px-1 py-0.5"
                          style={{ backgroundColor: colors.peach }}
                        >
                          <Text
                            className="text-xs font-mono font-semibold"
                            style={{ color: colors.peachOn }}
                          >
                            {fluxUnread}
                          </Text>
                        </View>
                      )}
                      <Pressable onPress={() => handleDelete(flux)} className="ml-1 p-0.5">
                        <Trash2 size={12} color={colors.muted} />
                      </Pressable>
                    </View>
                  )
                })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}
