import { Text, Pressable } from "react-native"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { LanguageProvider, useLanguage } from "@/context/LanguageContext"

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }

function Probe() {
  const { lang, t, setLang } = useLanguage()
  return (
    <>
      <Text testID="lang">{lang}</Text>
      <Text testID="label">{t.auth.signIn}</Text>
      <Pressable testID="to-fr" onPress={() => setLang("fr")}>
        <Text>switch</Text>
      </Pressable>
    </>
  )
}

async function renderProbe(initialLang?: "en" | "fr" | "de" | "es" | "it" | "pt" | "ja" | "zh") {
  return await render(
    <LanguageProvider initialLang={initialLang}>
      <Probe />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  asyncStorage.getItem.mockResolvedValue(null)
})

describe("LanguageProvider", () => {
  it("defaults to English when nothing is stored", async () => {
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("en"))
    expect(screen.getByTestId("label")).toHaveTextContent("Sign in")
  })

  it("restores the stored language", async () => {
    asyncStorage.getItem.mockResolvedValue("de")
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("de"))
    expect(screen.getByTestId("label")).toHaveTextContent("Anmelden")
  })

  it("accepts an explicit initial language", async () => {
    await renderProbe("fr")

    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("fr"))
    expect(screen.getByTestId("label")).toHaveTextContent("Se connecter")
  })

  it("switches language and persists the choice", async () => {
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("en"))

    await fireEvent.press(screen.getByTestId("to-fr"))

    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("fr"))
    expect(screen.getByTestId("label")).toHaveTextContent("Se connecter")
    expect(asyncStorage.setItem).toHaveBeenCalledWith("lang", "fr")
  })
})

describe("useLanguage", () => {
  it("throws when used outside of a provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    await expect(render(<Probe />)).rejects.toThrow(
      "useLanguage must be used within LanguageProvider",
    )
    spy.mockRestore()
  })
})
