import { useState } from "react"
import { Modal, View, Text, TextInput, Pressable } from "react-native"
import { setRepositoryFolder } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import { colors } from "@/theme"
import type { FeedFlux } from "@/hooks/useFeed"

interface FolderSheetProps {
  /** The flux being moved; the sheet is closed while it is null. */
  flux: FeedFlux | null
  userId: string
  token: string
  onClose: () => void
  onSaved: () => void
}

export function FolderSheet({ flux, userId, token, onClose, onSaved }: FolderSheetProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(flux?.folder ?? "")
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!flux) return
    setError(null)
    try {
      await setRepositoryFolder(userId, flux.id, name.trim() || null, token)
      onSaved()
      onClose()
    } catch {
      setError(t.common.error)
    }
  }

  return (
    <Modal visible={flux !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(8,10,16,0.72)" }}
        onPress={onClose}
      >
        <Pressable
          className="rounded-t-[24px] p-6"
          style={{ backgroundColor: colors.surface, paddingBottom: 34 }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-3 text-base font-semibold" style={{ color: colors.fg }}>
            {t.feed.moveToFolder}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.feed.folderPrompt}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t.feed.folderPrompt}
            autoFocus
            className="mb-3 rounded-xl border px-3 py-2.5 text-base"
            style={{ borderColor: colors.border, color: colors.fg }}
          />
          {error && (
            <Text className="mb-3 text-sm" style={{ color: colors.rose }}>
              {error}
            </Text>
          )}
          <View className="flex-row justify-end gap-2">
            <Pressable
              onPress={onClose}
              className="rounded-xl border px-4 py-2.5"
              style={{ borderColor: colors.border }}
            >
              <Text style={{ color: colors.fgSoft }}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              className="rounded-xl px-4 py-2.5"
              style={{ backgroundColor: colors.peach }}
            >
              <Text className="font-semibold" style={{ color: colors.peachOn }}>
                {t.feed.folderSave}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
