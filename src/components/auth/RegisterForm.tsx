import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native"
import { useForm, Controller } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLanguage } from "@/context/LanguageContext"
import { colors } from "@/theme"

type FormData = { name: string; email: string; password: string }

interface RegisterFormProps {
  onSubmit: (name: string, email: string, password: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function RegisterForm({ onSubmit, loading, error }: RegisterFormProps) {
  const { t } = useLanguage()
  const schema = z.object({
    name: z.string().min(1, t.auth.nameRequired),
    email: z.string().email(t.auth.emailInvalid),
    password: z.string().min(8, t.auth.passwordTooShort),
  })
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const submit = handleSubmit((data) => onSubmit(data.name, data.email, data.password))

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
          {t.auth.name}
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-xl border px-3.5 py-3 text-[15px]"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.fg,
              }}
              autoComplete="name"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder={t.auth.namePlaceholder}
              placeholderTextColor={colors.dim}
            />
          )}
        />
        {errors.name && (
          <Text className="text-xs" style={{ color: colors.rose }}>
            {errors.name.message}
          </Text>
        )}
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
          {t.auth.email}
        </Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-xl border px-3.5 py-3 text-[15px]"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.fg,
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="ton@email.com"
              placeholderTextColor={colors.dim}
            />
          )}
        />
        {errors.email && (
          <Text className="text-xs" style={{ color: colors.rose }}>
            {errors.email.message}
          </Text>
        )}
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-medium" style={{ color: colors.fgSoft }}>
          {t.auth.password}
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-xl border px-3.5 py-3 text-[15px]"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.fg,
              }}
              secureTextEntry
              autoComplete="new-password"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="mot de passe"
              placeholderTextColor={colors.dim}
            />
          )}
        />
        {errors.password && (
          <Text className="text-xs" style={{ color: colors.rose }}>
            {errors.password.message}
          </Text>
        )}
      </View>

      {error && (
        <View className="rounded-xl p-3" style={{ backgroundColor: colors.roseDim }}>
          <Text className="text-sm" style={{ color: colors.rose }}>
            {error}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => submit()}
        disabled={loading}
        className="items-center rounded-xl py-3.5 active:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: colors.peach }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.peachOn} />
        ) : (
          <Text className="font-semibold" style={{ color: colors.peachOn }}>
            {t.auth.signUp}
          </Text>
        )}
      </Pressable>
    </View>
  )
}
