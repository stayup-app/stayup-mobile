import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import { renderWithProviders } from "./render"

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }

beforeEach(() => {
  asyncStorage.getItem.mockResolvedValue(null)
})

describe("ThemeToggle", () => {
  it("offers to switch to dark mode while in light mode", async () => {
    await renderWithProviders(<ThemeToggle />)

    await waitFor(() => expect(screen.getByText("Mode sombre")).toBeTruthy())
    expect(screen.getByTestId("icon-Moon")).toBeTruthy()
  })

  it("offers to switch back to light mode once dark", async () => {
    await renderWithProviders(<ThemeToggle />)
    await waitFor(() => expect(screen.getByText("Mode sombre")).toBeTruthy())

    await fireEvent.press(screen.getByText("Mode sombre"))

    await waitFor(() => expect(screen.getByText("Mode clair")).toBeTruthy())
    expect(screen.getByTestId("icon-Sun")).toBeTruthy()
    expect(asyncStorage.setItem).toHaveBeenCalledWith("theme", "dark")
  })
})

describe("LanguageSwitcher", () => {
  it("lists every supported language", async () => {
    await renderWithProviders(<LanguageSwitcher />)

    await waitFor(() => expect(screen.getByText("🇫🇷 Français")).toBeTruthy())
    expect(screen.getByText("🇬🇧 English")).toBeTruthy()
    expect(screen.getByText("🇩🇪 Deutsch")).toBeTruthy()
    expect(screen.getByText("🇪🇸 Español")).toBeTruthy()
    expect(screen.getByText("🇮🇹 Italiano")).toBeTruthy()
    expect(screen.getByText("🇵🇹 Português")).toBeTruthy()
    expect(screen.getByText("🇯🇵 日本語")).toBeTruthy()
    expect(screen.getByText("🇨🇳 中文")).toBeTruthy()
  })

  it("switches the app to English", async () => {
    await renderWithProviders(<LanguageSwitcher />)
    await waitFor(() => expect(screen.getByText("🇬🇧 English")).toBeTruthy())

    await fireEvent.press(screen.getByText("🇬🇧 English"))

    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalledWith("lang", "en"))
  })
})
