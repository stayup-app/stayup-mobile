import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { Link } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import { useAuthConfig } from "@/hooks/useAuthConfig"
import { LoginForm } from "@/components/auth/LoginForm"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { AuroraMark } from "@/components/ui/AuroraMark"
import { useLanguage } from "@/context/LanguageContext"
import { colors } from "@/theme"

export default function LoginScreen() {
  const { login, loginOAuth, loading, error } = useAuth()
  const { config } = useAuthConfig()
  const { t } = useLanguage()

  // Une API trop ancienne pour /auth/config → on propose tout, comme avant.
  const oauth = config?.oauth ?? { github: true, google: true }
  const hasOAuth = oauth.github || oauth.google

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-4 mb-8">
            <AuroraMark size={52} />
            <View className="items-center">
              <Text
                style={{ fontFamily: "InstrumentSerif", fontSize: 30, color: colors.fg }}
                className="text-center"
              >
                {t.auth.loginTitle}
              </Text>
              <Text className="mt-2 text-center text-[14px]" style={{ color: colors.muted }}>
                {t.auth.subtitle}
              </Text>
            </View>
          </View>

          <LoginForm onSubmit={login} loading={loading} error={error} />

          {hasOAuth && (
            <>
              <View className="my-6 flex-row items-center gap-3">
                <View className="h-px flex-1" style={{ backgroundColor: colors.borderSoft }} />
                <Text className="text-[11px] uppercase" style={{ color: colors.muted }}>
                  {t.auth.or}
                </Text>
                <View className="h-px flex-1" style={{ backgroundColor: colors.borderSoft }} />
              </View>

              <OAuthButtons onPress={loginOAuth} loading={loading} providers={oauth} />
            </>
          )}

          <View className="mt-6 flex-row justify-center gap-1">
            <Text className="text-[13px]" style={{ color: colors.muted }}>
              {t.auth.noAccount}
            </Text>
            <Link href="/(auth)/register">
              <Text className="text-[13px] font-semibold" style={{ color: colors.peach }}>
                {t.auth.signUp}
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
