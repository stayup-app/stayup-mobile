import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { Link } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { AuroraMark } from "@/components/ui/AuroraMark"
import { useLanguage } from "@/context/LanguageContext"
import { colors } from "@/theme"

export default function RegisterScreen() {
  const { register, loading, error } = useAuth()
  const { t } = useLanguage()

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
                {t.auth.registerTitle}
              </Text>
            </View>
          </View>

          <RegisterForm onSubmit={register} loading={loading} error={error} />

          <View className="mt-6 flex-row justify-center gap-1">
            <Text className="text-[13px]" style={{ color: colors.muted }}>
              {t.auth.alreadyHaveAccount}
            </Text>
            <Link href="/(auth)/login">
              <Text className="text-[13px] font-semibold" style={{ color: colors.peach }}>
                {t.auth.signIn}
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
