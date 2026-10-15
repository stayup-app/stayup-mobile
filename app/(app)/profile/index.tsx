import { View, Text, Pressable, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { LogOut } from "lucide-react-native"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/context/LanguageContext"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import { colors } from "@/theme"

export default function ProfileScreen() {
  const router = useRouter()
  const { session, logout } = useAuth()
  const { t } = useLanguage()

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

        {/* Sign out */}
        <Pressable
          onPress={async () => {
            await logout()
            router.replace("/(auth)/login")
          }}
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
