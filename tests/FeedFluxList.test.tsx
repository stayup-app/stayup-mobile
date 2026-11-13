import { Alert } from "react-native"
import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import { FeedFluxList } from "@/components/feed/FeedFluxList"
import { deleteUserRepository } from "@/lib/api"
import type { FeedFlux } from "@/hooks/useFeed"
import { renderWithProviders } from "./render"
import { TEMPLATES } from "./_templates"

jest.mock("@/lib/api", () => ({ deleteUserRepository: jest.fn() }))

const secureStore = SecureStore as unknown as { getItemAsync: jest.Mock }
const mockedDelete = deleteUserRepository as jest.Mock

const TOKEN = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: "user-1" }))
  .toString("base64")
  .replace(/=/g, "")}.sig`
const fluxes: FeedFlux[] = [
  {
    id: "link-1",
    repository_id: 10,
    provider: "changelog",
    url: "https://github.com/facebook/react/",
    identifier: "facebook/react",
  },
  {
    id: "link-2",
    repository_id: 11,
    provider: "youtube",
    url: "https://www.youtube.com/@fireship",
    identifier: "@fireship",
  },
]

async function setup(props: Partial<React.ComponentProps<typeof FeedFluxList>> = {}) {
  const onSelectProvider = jest.fn()
  const onAddPress = jest.fn()
  const onDeleted = jest.fn()
  const onImported = jest.fn()

  await renderWithProviders(
    <FeedFluxList
      fluxes={fluxes}
      templates={TEMPLATES}
      userId="user-1"
      token={TOKEN}
      selectedProvider={null}
      onSelectProvider={onSelectProvider}
      onAddPress={onAddPress}
      onDeleted={onDeleted}
      onImported={onImported}
      {...props}
    />,
  )

  return { onSelectProvider, onAddPress, onDeleted, onImported }
}

beforeEach(() => {
  secureStore.getItemAsync.mockResolvedValue("tok")
})

describe("FeedFluxList", () => {
  it("shows a chip only for providers that have fluxes", async () => {
    await setup()

    await waitFor(() => expect(screen.getByText("Mes flux")).toBeTruthy())
    expect(screen.getByText("Tous les flux")).toBeTruthy()
    expect(screen.getByText("Changelog")).toBeTruthy()
    expect(screen.getByText("YouTube")).toBeTruthy()
    expect(screen.queryByText("RSS")).toBeNull()
    expect(screen.queryByText("Scraping web")).toBeNull()
  })

  it("selects a provider", async () => {
    const { onSelectProvider } = await setup()
    await waitFor(() => expect(screen.getByText("YouTube")).toBeTruthy())

    await fireEvent.press(screen.getByText("YouTube"))
    expect(onSelectProvider).toHaveBeenCalledWith("youtube")
  })

  it("deselects the provider that is already active", async () => {
    const { onSelectProvider } = await setup({ selectedProvider: "youtube" })
    await waitFor(() => expect(screen.getByText("YouTube")).toBeTruthy())

    await fireEvent.press(screen.getByText("YouTube"))
    expect(onSelectProvider).toHaveBeenCalledWith(null)
  })

  it("resets the filter from the all-feeds chip", async () => {
    const { onSelectProvider } = await setup({ selectedProvider: "youtube" })
    await waitFor(() => expect(screen.getByText("Tous les flux")).toBeTruthy())

    await fireEvent.press(screen.getByText("Tous les flux"))
    expect(onSelectProvider).toHaveBeenCalledWith(null)
  })

  it("asks to add a flux", async () => {
    const { onAddPress } = await setup()
    await waitFor(() => expect(screen.getByTestId("icon-Plus")).toBeTruthy())

    // The + button stops propagation so the section is not collapsed.
    const stopPropagation = jest.fn()
    await fireEvent.press(screen.getByTestId("icon-Plus"), { stopPropagation })

    expect(stopPropagation).toHaveBeenCalled()
    expect(onAddPress).toHaveBeenCalled()
  })

  it("sums the unread counts per provider", async () => {
    await setup({ unreadCountByRepoId: { 10: 3, 11: 2 } })

    await waitFor(() => expect(screen.getByText("3")).toBeTruthy())
    expect(screen.getByText("2")).toBeTruthy()
  })

  it("lists the individual fluxes of the selected provider", async () => {
    await setup({ selectedProvider: "changelog" })

    await waitFor(() => expect(screen.getByText("facebook/react")).toBeTruthy())
    expect(screen.getByTestId("icon-Trash2")).toBeTruthy()
  })

  it("shows the per-flux unread badge", async () => {
    await setup({ selectedProvider: "changelog", unreadCountByRepoId: { 10: 7 } })

    // The provider badge and the flux badge both show 7.
    await waitFor(() => expect(screen.getAllByText("7")).toHaveLength(2))
  })

  it("collapses and re-expands the section", async () => {
    await setup({ selectedProvider: "youtube" })
    await waitFor(() => expect(screen.getByText("Tous les flux")).toBeTruthy())

    await fireEvent.press(screen.getByText("Mes flux"))

    // Collapsed: the chips disappear, the active-filter badge appears.
    await waitFor(() => expect(screen.queryByText("Tous les flux")).toBeNull())
    expect(screen.getByText("YouTube")).toBeTruthy()
    expect(screen.getByTestId("icon-ChevronDown")).toBeTruthy()

    await fireEvent.press(screen.getByText("Mes flux"))
    await waitFor(() => expect(screen.getByText("Tous les flux")).toBeTruthy())
    expect(screen.getByTestId("icon-ChevronUp")).toBeTruthy()
  })

  it("hides the active-filter badge when collapsed with no filter", async () => {
    await setup()
    await waitFor(() => expect(screen.getByText("Tous les flux")).toBeTruthy())

    await fireEvent.press(screen.getByText("Mes flux"))

    await waitFor(() => expect(screen.queryByText("Tous les flux")).toBeNull())
    expect(screen.queryByText("YouTube")).toBeNull()
  })
})

describe("FeedFluxList — suppression", () => {
  async function pressDelete() {
    await fireEvent.press(screen.getByTestId("icon-Trash2"))
  }

  /** Triggers the destructive action of the last Alert.alert. */
  async function confirmAlert(spy: jest.SpyInstance) {
    const buttons = spy.mock.calls[0][2] as { text: string; onPress?: () => void }[]
    await buttons.find((b) => b.text === "Supprimer")!.onPress!()
  }

  it("asks for confirmation before deleting", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    await setup({ selectedProvider: "changelog" })
    await waitFor(() => expect(screen.getByTestId("icon-Trash2")).toBeTruthy())

    await pressDelete()

    expect(spy).toHaveBeenCalledWith(
      "Voulez-vous vraiment supprimer ?",
      "facebook/react",
      expect.any(Array),
    )
    expect(mockedDelete).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("deletes the flux once confirmed", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedDelete.mockResolvedValue(undefined)
    const { onDeleted } = await setup({ selectedProvider: "changelog" })
    await waitFor(() => expect(screen.getByTestId("icon-Trash2")).toBeTruthy())

    await pressDelete()
    await confirmAlert(spy)

    expect(mockedDelete).toHaveBeenCalledWith("user-1", "link-1", TOKEN)
    expect(onDeleted).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("swallows a deletion failure", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedDelete.mockRejectedValue(new Error("500"))
    const { onDeleted } = await setup({ selectedProvider: "changelog" })
    await waitFor(() => expect(screen.getByTestId("icon-Trash2")).toBeTruthy())

    await pressDelete()
    await confirmAlert(spy)

    expect(onDeleted).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
