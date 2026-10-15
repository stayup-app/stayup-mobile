import { Tabs, Redirect } from "expo-router"
import { Rss, User } from "lucide-react-native"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/context/LanguageContext"
import { View, ActivityIndicator } from "react-native"
import { colors } from "@/theme"

export default function AppLayout() {
  const { session, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.peach} />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.peach,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bgSoft,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        },
      }}
    >
      <Tabs.Screen
        name="feed/index"
        options={{
          title: t.tabs.feed,
          tabBarIcon: ({ color, size }) => <Rss color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="feed/flux/[id]" options={{ href: null }} />
      <Tabs.Screen name="feed/detail" options={{ href: null }} />
    </Tabs>
  )
}
