import { Text, Pressable, useColorScheme } from "react-native"
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colorScheme as nativewindColorScheme } from "nativewind"
import { ThemeProvider, useTheme } from "@/context/ThemeContext"

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock }
const nativewind = nativewindColorScheme as unknown as { set: jest.Mock }

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(() => "light"),
}))

const mockedUseColorScheme = useColorScheme as unknown as jest.Mock

function Probe() {
  const { theme, toggleTheme, setTheme } = useTheme()
  return (
    <>
      <Text testID="theme">{theme}</Text>
      <Pressable testID="toggle" onPress={toggleTheme}>
        <Text>toggle</Text>
      </Pressable>
      <Pressable testID="set-dark" onPress={() => setTheme("dark")}>
        <Text>dark</Text>
      </Pressable>
    </>
  )
}

async function renderProbe() {
  return await render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  asyncStorage.getItem.mockResolvedValue(null)
  mockedUseColorScheme.mockReturnValue("light")
})

describe("ThemeProvider", () => {
  it("falls back to the system scheme when nothing is stored", async () => {
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"))
    expect(nativewind.set).toHaveBeenCalledWith("light")
  })

  it("follows a dark system scheme", async () => {
    mockedUseColorScheme.mockReturnValue("dark")
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"))
    expect(nativewind.set).toHaveBeenCalledWith("dark")
  })

  it("restores the stored theme over the system scheme", async () => {
    asyncStorage.getItem.mockResolvedValue("dark")
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"))
    expect(nativewind.set).toHaveBeenCalledWith("dark")
  })

  it("ignores a malformed stored value", async () => {
    asyncStorage.getItem.mockResolvedValue("purple")
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"))
  })

  it("setTheme persists the choice", async () => {
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"))

    await fireEvent.press(screen.getByTestId("set-dark"))

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"))
    expect(asyncStorage.setItem).toHaveBeenCalledWith("theme", "dark")
  })

  it("toggleTheme flips light to dark and back", async () => {
    await renderProbe()
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"))

    await fireEvent.press(screen.getByTestId("toggle"))
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"))

    await fireEvent.press(screen.getByTestId("toggle"))
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("light"))
    expect(asyncStorage.setItem).toHaveBeenLastCalledWith("theme", "light")
  })
})

describe("useTheme", () => {
  it("throws when used outside of a provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    await expect(render(<Probe />)).rejects.toThrow("useTheme must be used within ThemeProvider")
    spy.mockRestore()
  })
})
