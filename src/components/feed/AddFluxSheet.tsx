import { useState, useEffect } from "react"
import { Modal, View, Text, TextInput, Pressable, ActivityIndicator } from "react-native"
import { X } from "lucide-react-native"
import {
  addUserRepository,
  getConnectorProviders,
  getProviderFluxes,
  subscribeFlux,
} from "@/lib/api"
import { decodeToken } from "@/lib/session"
import { PROVIDERS } from "@/lib/providers"
import { useLanguage } from "@/context/LanguageContext"
import { colors, getProviderMeta } from "@/theme"
import {
  buildFluxUrl,
  matchesFormPattern,
  resolveFeedLabel,
  type ProviderTemplate,
} from "@/lib/providerTemplate"
import type { ProviderFlux } from "@/types"

interface ProviderTile {
  id: string
  label: string
  color: string
  dim: string
}

interface AddFluxSheetProps {
  visible: boolean
  onClose: () => void
  token: string
  onSuccess: () => void
}

export function AddFluxSheet({ visible, onClose, token, onSuccess }: AddFluxSheetProps) {
  const { t } = useLanguage()
  const [provider, setProvider] = useState<string>("changelog")
  const [identifier, setIdentifier] = useState("")
  const [pickMode, setPickMode] = useState<"existing" | "new">("existing")
  const [selectedFlux, setSelectedFlux] = useState<ProviderFlux | null>(null)
  const [fluxes, setFluxes] = useState<ProviderFlux[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [tiles, setTiles] = useState<ProviderTile[]>([])
  const [tpls, setTpls] = useState<Record<string, ProviderTemplate | null>>({})
  const [approvals, setApprovals] = useState<Record<string, "auto" | "manual">>({})

  // Provider list: names and approval mode come from the API.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getConnectorProviders(token)
      .then((providers) => {
        if (cancelled) return
        const parsed = providers.map((p) => ({ ...p, tpl: PROVIDERS[p.name]?.template ?? null }))
        setTpls(Object.fromEntries(parsed.map((p) => [p.name, p.tpl])))
        setApprovals(Object.fromEntries(parsed.map((p) => [p.name, p.fluxApproval ?? "auto"])))
        setTiles(
          parsed.map(({ name, displayName, tpl }) => {
            const meta = getProviderMeta(name, tpl)
            return {
              id: name,
              label: tpl?.display?.name ?? displayName ?? name,
              color: meta.color,
              dim: meta.dim,
            }
          }),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setTiles([])
          setTpls({})
          setApprovals({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [visible, token])

  // Existing fluxes of the selected provider.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getProviderFluxes(provider, token)
      .then((list) => {
        if (cancelled) return
        setFluxes(list ?? [])
        setPickMode((list ?? []).some((f) => !f.is_subscribed) ? "existing" : "new")
      })
      .catch(() => {
        if (!cancelled) {
          setFluxes([])
          setPickMode("new")
        }
      })
    return () => {
      cancelled = true
    }
  }, [visible, provider, token])

  function handleClose() {
    setProvider("changelog")
    setIdentifier("")
    setSelectedFlux(null)
    setFluxes(null)
    setError(null)
    setPickMode("existing")
    setPending(false)
    onClose()
  }

  const currentForm = tpls[provider]?.form

  async function handleSubmit() {
    setError(null)

    if (pickMode === "existing") {
      if (!selectedFlux) {
        setError(t.addFlux.selectError)
        return
      }
      setSubmitting(true)
      try {
        await subscribeFlux(provider, selectedFlux.id, token)
        onSuccess()
        handleClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.error)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!identifier.trim()) {
      setError(t.addFlux.requiredError)
      return
    }
    if (currentForm && !matchesFormPattern(currentForm, identifier)) {
      setError(t.addFlux.requiredError)
      return
    }

    setSubmitting(true)
    try {
      const targetUserId = decodeToken(token).userId

      const url = currentForm ? buildFluxUrl(currentForm, identifier) : identifier
      const result = await addUserRepository(targetUserId, token, {
        provider,
        url,
        config: { max_scraps: 5, retention_days: 15 },
      })
      if (result.status === "pending") {
        setPending(true)
      } else {
        onSuccess()
        handleClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  const fluxesLoading = fluxes === null
  const availableFluxes = (fluxes ?? []).filter((f) => !f.is_subscribed)
  // Label / placeholder of the "add" field: the connector's (`form` in the
  // template), with a generic fallback. The app knows no provider hardcoded.
  const inputLabel = currentForm?.label ?? t.addFlux.identifierLabels.generic
  const inputPlaceholder = currentForm?.placeholder ?? t.addFlux.placeholders.generic
  // An existing flux's label: rendered by the connector template, as in the
  // flux list (fallback: URL without scheme).
  const fluxLabel = (f: ProviderFlux) =>
    resolveFeedLabel(tpls[provider], { url: f.url, config: f.config })
  const inputStyle = {
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.fg,
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(8,10,16,0.72)" }}
        onPress={handleClose}
      >
        <Pressable
          className="rounded-t-[24px] p-6"
          style={{ backgroundColor: colors.surface, paddingBottom: 34 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            className="self-center mb-4 h-1 w-10 rounded-full"
            style={{ backgroundColor: colors.border }}
          />
          <View className="flex-row items-start justify-between mb-1">
            <Text
              style={{ fontFamily: "InstrumentSerif", fontSize: 24, color: colors.fg, flex: 1 }}
            >
              {t.addFlux.title}
            </Text>
            <Pressable onPress={handleClose} className="p-1 -mr-1 -mt-1">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          {!pending && (
            <Text className="mb-4 text-[13px]" style={{ color: colors.muted }}>
              {t.addFlux.description}
            </Text>
          )}

          <View className="gap-4">
            {pending ? (
              <View className="gap-2 py-2">
                <Text className="text-sm font-semibold" style={{ color: colors.fg }}>
                  {t.addFlux.requestSent}
                </Text>
                <Text className="text-sm" style={{ color: colors.muted }}>
                  {t.addFlux.requestSentDescription}
                </Text>
              </View>
            ) : (
              <>
                {/* Provider selector — 2x2 grid */}
                <View className="gap-1.5">
                  <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
                    {t.addFlux.provider}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {tiles.map((tile) => {
                      const active = provider === tile.id
                      return (
                        <Pressable
                          key={tile.id}
                          onPress={() => {
                            setProvider(tile.id)
                            setIdentifier("")
                            setSelectedFlux(null)
                            setFluxes(null)
                            setError(null)
                          }}
                          className="rounded-xl px-3.5 py-2.5 border"
                          style={{
                            width: "47%",
                            backgroundColor: active ? tile.dim : colors.bg,
                            borderColor: active ? tile.color : colors.border,
                          }}
                        >
                          <Text
                            className="text-[13.5px] font-medium"
                            style={{ color: active ? tile.color : colors.fgSoft }}
                          >
                            {tile.label}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>

                {/* Mode toggle : flux existant vs nouveau */}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setPickMode("existing")}
                    className="rounded-full px-3 py-1.5"
                    style={{
                      backgroundColor: pickMode === "existing" ? colors.peach : colors.bg,
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{
                        color: pickMode === "existing" ? colors.peachOn : colors.fgSoft,
                      }}
                    >
                      {t.addFlux.chooseExisting}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPickMode("new")}
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: pickMode === "new" ? colors.peach : colors.bg }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: pickMode === "new" ? colors.peachOn : colors.fgSoft }}
                    >
                      {t.addFlux.makeRequest}
                    </Text>
                  </Pressable>
                </View>

                {pickMode === "existing" ? (
                  <View className="gap-1.5">
                    <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
                      {t.addFlux.scrapRepo}
                    </Text>
                    {fluxesLoading ? (
                      <ActivityIndicator size="small" color={colors.peach} />
                    ) : availableFluxes.length === 0 ? (
                      <Text className="text-sm" style={{ color: colors.dim }}>
                        {t.addFlux.noScrapRepos}
                      </Text>
                    ) : (
                      availableFluxes.map((f) => {
                        const active = selectedFlux?.id === f.id
                        return (
                          <Pressable
                            key={f.id}
                            onPress={() => setSelectedFlux(f)}
                            className="rounded-xl border p-3"
                            style={{
                              borderColor: active ? colors.peach : colors.border,
                              backgroundColor: active ? colors.peachDim : "transparent",
                            }}
                          >
                            <Text
                              className="text-sm font-mono"
                              style={{ color: colors.fgSoft }}
                              numberOfLines={1}
                            >
                              {fluxLabel(f)}
                            </Text>
                          </Pressable>
                        )
                      })
                    )}
                  </View>
                ) : (
                  <View className="gap-1.5">
                    <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
                      {inputLabel}
                    </Text>
                    <TextInput
                      className="rounded-xl border px-3.5 py-3"
                      style={inputStyle}
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder={inputPlaceholder}
                      placeholderTextColor={colors.dim}
                      autoCapitalize="none"
                    />
                    {approvals[provider] === "manual" && (
                      <Text className="text-[11px]" style={{ color: colors.muted }}>
                        {t.addFlux.requestSentDescription}
                      </Text>
                    )}
                  </View>
                )}

                {error && (
                  <Text className="text-sm" style={{ color: colors.rose }}>
                    {error}
                  </Text>
                )}

                <View className="flex-row gap-3 pt-2">
                  <Pressable
                    onPress={handleClose}
                    className="flex-1 items-center rounded-xl border py-3"
                    style={{ borderColor: colors.border }}
                  >
                    <Text className="font-medium" style={{ color: colors.fgSoft }}>
                      {t.addFlux.cancel}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    className="flex-1 items-center rounded-xl py-3 disabled:opacity-50"
                    style={{ backgroundColor: colors.peach }}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.peachOn} />
                    ) : (
                      <Text className="font-semibold" style={{ color: colors.peachOn }}>
                        {t.addFlux.add}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {pending && (
              <Pressable
                onPress={handleClose}
                className="items-center rounded-xl border py-3"
                style={{ borderColor: colors.border }}
              >
                <Text className="font-medium" style={{ color: colors.fgSoft }}>
                  {t.addFlux.cancel}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
