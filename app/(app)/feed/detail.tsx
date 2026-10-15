import { useState, useEffect } from "react"
import { ScrollView, View, Text, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ChevronLeft, Star } from "lucide-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSelectedFeedItemStore } from "@/store/selectedFeedItem"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import { useLanguage } from "@/context/LanguageContext"
import { formatDate, providerDisplayName } from "@/lib/utils"
import { colors } from "@/theme"
import { makeCtx, resolveText } from "@/lib/providerTemplate"
import { TemplatedDetail } from "@/components/feed/TemplatedDetail"
import type { TaggedItem } from "@/types"

const LS_FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"
const BASE_FONT = 16
const MIN_OFFSET = -4
const MAX_OFFSET = 10

export default function FeedDetailScreen() {
  const router = useRouter()
  const { t } = useLanguage()
  const { item: tagged, template, source } = useSelectedFeedItemStore()
  const { markRead, savedIds, toggleSaved } = useReadItemsStore()
  const [fontSizeOffset, setFontSizeOffset] = useState(0)

  useEffect(() => {
    if (tagged) void markRead(tagged)
  }, [tagged, markRead])

  useEffect(() => {
    void AsyncStorage.getItem(LS_FONT_KEY).then((v) => {
      if (v) setFontSizeOffset(parseInt(v, 10) || 0)
    })
  }, [])

  function adjustFont(delta: number) {
    setFontSizeOffset((prev) => {
      const next = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, prev + delta))
      void AsyncStorage.setItem(LS_FONT_KEY, String(next))
      return next
    })
  }

  if (!tagged) return null

  const bodyFontSize = BASE_FONT + fontSizeOffset
  const isSaved = savedIds.has(getTaggedItemId(tagged))
  const headerTitle = template
    ? resolveText(
        template.detail?.title ?? template.item?.fields?.title,
        makeCtx(template, tagged.item as Record<string, unknown>, source),
      ) || providerDisplayName(tagged.provider)
    : providerDisplayName(tagged.provider)

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View
        className="flex-row items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: colors.borderSoft }}
      >
        <Pressable
          onPress={() => router.back()}
          className="rounded p-1"
          style={{ marginLeft: -4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={colors.muted} />
        </Pressable>
        <Text
          className="flex-1 text-base font-semibold"
          style={{ color: colors.fg }}
          numberOfLines={1}
        >
          {headerTitle}
        </Text>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => void toggleSaved(tagged)}
            accessibilityLabel={isSaved ? t.feed.removeFromSaved : t.feed.saveForLater}
            accessibilityState={{ selected: isSaved }}
            className="rounded px-2 py-1"
          >
            <Star
              size={18}
              color={isSaved ? colors.peach : colors.muted}
              fill={isSaved ? colors.peach : "none"}
            />
          </Pressable>
          <Pressable
            onPress={() => adjustFont(-1)}
            disabled={fontSizeOffset <= MIN_OFFSET}
            className="rounded px-2 py-1"
            style={{ opacity: fontSizeOffset <= MIN_OFFSET ? 0.35 : 1 }}
          >
            <Text className="font-mono text-base" style={{ color: colors.muted }}>
              A−
            </Text>
          </Pressable>
          <Pressable
            onPress={() => adjustFont(1)}
            disabled={fontSizeOffset >= MAX_OFFSET}
            className="rounded px-2 py-1"
            style={{ opacity: fontSizeOffset >= MAX_OFFSET ? 0.35 : 1 }}
          >
            <Text className="font-mono text-lg" style={{ color: colors.muted }}>
              A+
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {template ? (
          <TemplatedDetail
            template={template}
            item={tagged.item as Record<string, unknown>}
            source={source}
            color={template.display?.accent || colors.peach}
            dimColor={template.display?.accent ? `${template.display.accent}22` : colors.surfaceHi}
            bodyFontSize={bodyFontSize}
            t={t}
          />
        ) : (
          <GenericDetail tagged={tagged} bodyFontSize={bodyFontSize} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function GenericDetail({ tagged, bodyFontSize }: { tagged: TaggedItem; bodyFontSize: number }) {
  const item = tagged.item
  const content = typeof item.content === "string" ? item.content : ""
  return (
    <View>
      <View className="mb-4 flex-row items-center gap-2">
        <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: colors.surfaceHi }}>
          <Text className="text-sm font-mono font-semibold" style={{ color: colors.muted }}>
            {providerDisplayName(tagged.provider)}
          </Text>
        </View>
        {item.version ? (
          <Text className="text-sm font-mono" style={{ color: colors.dim }}>
            {String(item.version)}
          </Text>
        ) : null}
        <Text className="ml-auto text-sm font-mono" style={{ color: colors.dim }}>
          {formatDate(item.datetime ?? item.executed_at)}
        </Text>
      </View>

      {content ? (
        <Text className="leading-relaxed" style={{ fontSize: bodyFontSize, color: colors.fgSoft }}>
          {content}
        </Text>
      ) : null}
    </View>
  )
}
