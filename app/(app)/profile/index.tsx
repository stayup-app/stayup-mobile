import { useEffect, useState } from "react"
import { View, Text, Pressable, ScrollView, Switch } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { LogOut } from "lucide-react-native"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/context/LanguageContext"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import { registerForPush, unregisterFromPush, setBadge } from "@/lib/push"
import { readPushEnabled, writePushEnabled } from "@/lib/store"
import { colors } from "@/theme"

export default function ProfileScreen() {
  const router = useRouter()
  const { session, token, logout } = useAuth()
  const { t, lang } = useLanguage()
  const [pushEnabled, setPushEnabled] = useState(true)

  useEffect(() => {
    void readPushEnabled().then(setPushEnabled)
  }, [])

  async function handlePushToggle(next: boolean) {
    setPushEnabled(next)
    await writePushEnabled(next)
    if (!session || !token) return
    if (next) await registerForPush(session.userId, token, lang)
    else {
      await unregisterFromPush(session.userId, token)
      await setBadge(0)
    }
  }

  async function handleSignOut() {
    if (session && token) await unregisterFromPush(session.userId, token)
    await setBadge(0)
    await logout()
    router.replace("/(auth)/login")
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="p-6 gap-6">
        {/* User info */}
        <View className="items-center gap-2">
          <View
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.peach }}
          >
            <Text className="text-2xl font-semibold" style={{ color: colors.peachOn }}>
              {session?.name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={{ fontFamily: "InstrumentSerif", fontSize: 22, color: colors.fg }}>
            {session?.name}
          </Text>
          <Text className="text-sm font-mono" style={{ color: colors.muted }}>
            {session?.email}
          </Text>
        </View>

        {/* Theme */}
        <View
          className="rounded-xl border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Text
            className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: colors.muted }}
          >
            {t.profile.theme}
          </Text>
          <ThemeToggle />
        </View>

        {/* Language */}
        <View
          className="rounded-xl border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <Text
            className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: colors.muted }}
          >
            {t.profile.language}
          </Text>
          <LanguageSwitcher />
        </View>

        {/* Push notifications */}
        <View
          className="rounded-xl border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-base" style={{ color: colors.fg }}>
              {t.profile.pushToggle}
            </Text>
            <Switch
              value={pushEnabled}
              onValueChange={(next) => void handlePushToggle(next)}
              accessibilityLabel={t.profile.pushToggle}
            />
          </View>
          <Text className="mt-2 text-sm" style={{ color: colors.muted }}>
            {t.profile.pushDescription}
          </Text>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={() => void handleSignOut()}
          className="flex-row items-center justify-center gap-2 rounded-xl border py-4 active:opacity-80"
          style={{ borderColor: "rgba(232, 168, 181, 0.3)", backgroundColor: colors.roseDim }}
        >
          <LogOut size={18} color={colors.rose} />
          <Text className="font-semibold" style={{ color: colors.rose }}>
            {t.profile.signOut}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
