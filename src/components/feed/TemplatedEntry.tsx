import { View, Text, Pressable } from "react-native"
import { Image } from "expo-image"
import type { ProviderTemplate } from "@/lib/providerTemplate"
import { resolveItemView } from "@/lib/providerTemplate"
import { formatDate } from "@/lib/utils"
import { colors } from "@/theme"

interface TemplatedEntryProps {
  template: ProviderTemplate
  item: Record<string, unknown>
  source?: Record<string, unknown>
  color: string
  onPress?: () => void
}

/** List entry rendered from the connector template — no knowledge of the
 *  provider (everything comes from `template.list` + `template.item`). */
export function TemplatedEntry({ template, item, source, color, onPress }: TemplatedEntryProps) {
  const view = resolveItemView(template, item, source)
  const layout = template.list?.layout ?? "row"
  const date = view.timestamp ? formatDate(view.timestamp) : ""

  if (layout === "media") {
    return (
      <Pressable onPress={onPress} className="flex-row gap-3">
        <View
          className="h-14 w-24 overflow-hidden rounded"
          style={{ backgroundColor: colors.surface }}
        >
          {view.image ? (
            <Image
              source={{ uri: view.image }}
              style={{ width: 96, height: 56 }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm" style={{ color }}>
                ▶
              </Text>
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-medium leading-snug"
            style={{ color: colors.fg }}
            numberOfLines={2}
          >
            {view.title || "—"}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            {view.subtitle ? (
              <Text className="text-sm font-mono" style={{ color }} numberOfLines={1}>
                {view.subtitle}
              </Text>
            ) : null}
            {date ? (
              <Text className="text-sm font-mono" style={{ color: colors.dim }}>
                {date}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    )
  }

  const snippet = template.list?.snippet ? view.summary : ""

  return (
    <Pressable onPress={onPress} className="border-l-2 py-1 pl-3" style={{ borderColor: color }}>
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 text-base font-medium"
          style={{ color: colors.fg }}
          numberOfLines={1}
        >
          {view.title || "—"}
        </Text>
        {date ? (
          <Text className="text-sm font-mono" style={{ color: colors.dim }}>
            {date}
          </Text>
        ) : null}
      </View>
      {view.subtitle ? (
        <Text className="mb-1 text-sm font-mono" style={{ color }} numberOfLines={1}>
          {view.subtitle}
        </Text>
      ) : null}
      {snippet ? (
        <Text className="text-base leading-relaxed" style={{ color: colors.dim }} numberOfLines={2}>
          {snippet.slice(0, 200)}
        </Text>
      ) : null}
    </Pressable>
  )
}
