import { useState } from "react"
import { View, Pressable, Alert, ActivityIndicator } from "react-native"
import { Download, Upload } from "lucide-react-native"
import { colors } from "@/theme"
import * as DocumentPicker from "expo-document-picker"
import * as Sharing from "expo-sharing"
import { File, Paths } from "expo-file-system"
import { buildOpml, parseOpml, type OpmlFlux } from "@/lib/opml"
import { addUserRepository, getProviderFluxes, subscribeFlux } from "@/lib/api"
import { readToken } from "@/lib/store"
import { useLanguage } from "@/context/LanguageContext"
import type { FeedFlux } from "@/hooks/useFeed"
import type { Translations } from "@/lib/translations"

interface ImportExportButtonsProps {
  fluxes: FeedFlux[]
  userId: string
  onImported: () => void
}

function resultMessage(
  t: Translations,
  { added, skipped, unavailable }: { added: number; skipped: number; unavailable: number },
): string {
  return [
    added > 0 && `${added} ${t.importExport.added}`,
    skipped > 0 && `${skipped} ${t.importExport.alreadyPresent}`,
    unavailable > 0 && `${unavailable} ${t.importExport.unavailable}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function ImportExportButtons({ fluxes, userId, onImported }: ImportExportButtonsProps) {
  const { t } = useLanguage()
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    const opml = buildOpml(
      fluxes.map((f) => ({ provider: f.provider, url: f.url, identifier: f.identifier })),
      "StayUp",
    )
    const file = new File(Paths.cache, "stayup-feeds.opml")
    file.create({ overwrite: true })
    file.write(opml)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "text/x-opml", UTI: "public.xml" })
    }
  }

  // `scrap` (and any `manual` provider): we do not create a flux on import, we
  // subscribe to an already-approved flux if one exists for this URL.
  async function resolveFluxId(
    provider: string,
    url: string,
    token: string,
  ): Promise<number | null> {
    try {
      const fluxes = await getProviderFluxes(provider, token)
      return fluxes.find((f) => f.url === url)?.id ?? null
    } catch {
      return null
    }
  }

  async function importEntry(
    entry: OpmlFlux,
    token: string,
  ): Promise<"added" | "unavailable" | "failed"> {
    try {
      if (entry.provider === "scrap") {
        const id = await resolveFluxId("scrap", entry.url, token)
        if (id === null) return "unavailable"
        await subscribeFlux("scrap", id, token)
        return "added"
      }

      await addUserRepository(userId, token, {
        provider: entry.provider,
        url: entry.url,
        config: { max_scraps: 5, retention_days: 15 },
      })
      return "added"
    } catch {
      return "failed"
    }
  }

  async function handleImport() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/xml", "text/x-opml", "application/xml", "*/*"],
      copyToCacheDirectory: true,
    })
    if (picked.canceled || !picked.assets?.[0]) return

    const text = await new File(picked.assets[0].uri).text()
    const entries = parseOpml(text)
    if (entries.length === 0) {
      Alert.alert(t.importExport.invalidFile)
      return
    }

    setImporting(true)
    const token = await readToken()
    const existing = new Set(fluxes.map((f) => `${f.provider}:${f.url}`))
    let added = 0
    let skipped = 0
    let unavailable = 0

    if (token) {
      for (const entry of entries) {
        if (existing.has(`${entry.provider}:${entry.url}`)) {
          skipped++
          continue
        }
        const outcome = await importEntry(entry, token)
        if (outcome === "added") added++
        else if (outcome === "unavailable") unavailable++
      }
    }

    setImporting(false)
    Alert.alert(t.importExport.import, resultMessage(t, { added, skipped, unavailable }))
    if (added > 0) onImported()
  }

  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={(e) => {
          e.stopPropagation()
          void handleExport()
        }}
        className="rounded-full p-1"
        hitSlop={8}
        accessibilityLabel={t.importExport.export}
      >
        <Download size={16} color={colors.peach} />
      </Pressable>
      <Pressable
        onPress={(e) => {
          e.stopPropagation()
          void handleImport()
        }}
        disabled={importing}
        className="rounded-full p-1"
        hitSlop={8}
        accessibilityLabel={t.importExport.import}
      >
        {importing ? (
          <ActivityIndicator size="small" color={colors.peach} />
        ) : (
          <Upload size={16} color={colors.peach} />
        )}
      </Pressable>
    </View>
  )
}
