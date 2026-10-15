import { FlatList, View, Text, RefreshControl } from "react-native"
import type { TaggedItem, FeedRepository } from "@/types"
import type { ProviderMeta } from "@/lib/providerTemplate"
import { formatDate, providerDisplayName } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { colors, getProviderMeta } from "@/theme"
import { TemplatedEntry } from "./TemplatedEntry"
import { providerIcon } from "./providerIcons"
import { getTaggedItemId } from "@/store/readItems"

function getItemDate(tagged: TaggedItem): string {
  const item = tagged.item
  if (typeof item.datetime === "string" && item.datetime) return item.datetime
  return String(item.executed_at ?? "")
}

interface UnifiedFeedListProps {
  items: TaggedItem[]
  templates: Record<string, ProviderMeta>
  repositories?: FeedRepository[]
  loading?: boolean
  onRefresh?: () => void
  onPressItem?: (tagged: TaggedItem) => void
  readIds?: Set<string>
  openItemId?: string
}

export function UnifiedFeedList({
  items,
  templates,
  repositories = [],
  loading,
  onRefresh,
  onPressItem,
  readIds,
  openItemId,
}: UnifiedFeedListProps) {
  const { t } = useLanguage()

  const sourceMap = Object.fromEntries(
    repositories.map((r) => [
      r.repository_id,
      { url: r.url, config: r.config ?? {}, type: r.provider ?? "" },
    ]),
  )

  const all: TaggedItem[] = [...items].sort(
    (a, b) => new Date(getItemDate(b)).getTime() - new Date(getItemDate(a)).getTime(),
  )

  if (all.length === 0 && !loading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-base italic" style={{ color: colors.dim }}>
          {t.feed.noContent}
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={all}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item: tagged }) => {
        const meta = templates[tagged.provider]
        const { color } = getProviderMeta(tagged.provider, meta?.template)
        const id = getTaggedItemId(tagged)
        const isRead = readIds?.has(id) ?? false
        const isOpen = id === openItemId
        const onPress = onPressItem ? () => onPressItem(tagged) : undefined

        return (
          <View
            className="flex-row gap-2.5 border-b px-4 py-3"
            style={{ borderColor: colors.borderSoft, opacity: isRead && !isOpen ? 0.45 : 1 }}
          >
            <View className="mt-0.5">{providerIcon(meta?.template?.display, 14, color)}</View>
            <View className="flex-1">
              {meta?.template ? (
                <TemplatedEntry
                  template={meta.template}
                  item={tagged.item as Record<string, unknown>}
                  source={sourceMap[tagged.item.repository_id]}
                  color={color}
                  onPress={onPress}
                />
              ) : (
                <GenericEntry
                  item={tagged.item}
                  color={color}
                  providerLabel={
                    meta?.template?.display?.name ??
                    meta?.displayName ??
                    providerDisplayName(tagged.provider)
                  }
                  onPress={onPress}
                />
              )}
            </View>
          </View>
        )
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!loading} onRefresh={onRefresh} tintColor={colors.peach} />
        ) : undefined
      }
    />
  )
}

function GenericEntry({
  item,
  color,
  providerLabel,
  onPress,
}: {
  item: TaggedItem["item"]
  color: string
  providerLabel: string
  onPress?: () => void
}) {
  const content = typeof item.content === "string" ? item.content : ""
  return (
    <View className="border-l-2 py-1 pl-3" style={{ borderColor: colors.dim }}>
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 text-base font-medium"
          style={{ color: colors.fg }}
          numberOfLines={1}
          onPress={onPress}
        >
          {content.slice(0, 80) || providerLabel}
        </Text>
        <Text className="text-sm font-mono" style={{ color: colors.dim }}>
          {formatDate(item.datetime ?? item.executed_at)}
        </Text>
      </View>
      <Text className="text-sm font-mono" style={{ color }}>
        {providerLabel}
      </Text>
    </View>
  )
}
