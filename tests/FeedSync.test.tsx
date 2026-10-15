import { screen, fireEvent, waitFor, renderHook } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import FeedScreen from "../app/(app)/feed/index"
import FeedDetailScreen from "../app/(app)/feed/detail"
import ProfileScreen from "../app/(app)/profile/index"
import { FolderSheet } from "@/components/feed/FolderSheet"
import { FeedFluxList } from "@/components/feed/FeedFluxList"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import {
  getUserFeed,
  getConnectorProviders,
  getItemState,
  listSavedItems,
  searchItems,
  setRepositoryFolder,
  setItemSaved,
  registerPushToken,
  unregisterPushToken,
} from "@/lib/api"
import { useReadItemsStore } from "@/store/readItems"
import { useSelectedFeedItemStore } from "@/store/selectedFeedItem"
import type { FeedFlux } from "@/hooks/useFeed"
import type { TaggedItem } from "@/types"
import { renderWithProviders } from "./render"
import { mockRouter } from "./setup"
import { RAW_PROVIDERS, TEMPLATES } from "./_templates"

jest.mock("@/lib/api", () => ({
  getUserFeed: jest.fn(),
  getConnectorProviders: jest.fn(),
  getItemState: jest.fn(),
  markItemsRead: jest.fn().mockResolvedValue(undefined),
  setItemSaved: jest.fn().mockResolvedValue(undefined),
  listSavedItems: jest.fn(),
  searchItems: jest.fn(),
  setRepositoryFolder: jest.fn(),
  registerPushToken: jest.fn().mockResolvedValue(undefined),
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
  deleteUserRepository: jest.fn(),
  addUserRepository: jest.fn(),
  getProviderFluxes: jest.fn().mockResolvedValue([]),
  subscribeFlux: jest.fn(),
  fetchAuthConfig: jest.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
}))

const secureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}
const asyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}
const notifications = Notifications as unknown as Record<string, jest.Mock>

function validToken(): string {
  const payload = {
    sub: "user-1",
    name: "Jean",
    email: "jean@example.com",
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  return `${btoa("{}")}.${btoa(JSON.stringify(payload))}.sig`
}

function repo(id: string, repoId: number, folder: string | null = null) {
  return {
    id,
    repository_id: repoId,
    provider: "rss" as const,
    url: `https://blog${repoId}.example.com/feed.xml`,
    config: {},
    created_at: "2026-01-01",
    folder,
  }
}

function rssItem(id: number, repoId: number, title: string) {
  return {
    id,
    repository_id: repoId,
    content: JSON.stringify({ title, link: `https://blog.example.com/${id}`, summary: "" }),
    datetime: `2026-0${id}-01T10:00:00Z`,
    executed_at: `2026-0${id}-01T11:00:00Z`,
    success: true,
  }
}

function setFeed(repositories = [repo("l1", 10, "AI"), repo("l2", 11)]) {
  ;(getUserFeed as jest.Mock).mockResolvedValue({
    repositories,
    connectors: { rss: [rssItem(1, 10, "Article A"), rssItem(2, 11, "Article B")] },
  })
}

function stubStorage(values: Record<string, string> = {}) {
  asyncStorage.getItem.mockImplementation((key: string) => Promise.resolve(values[key] ?? null))
}

beforeEach(() => {
  secureStore.getItemAsync.mockImplementation((k: string) =>
    Promise.resolve(k === "auth_token" ? validToken() : null),
  )
  stubStorage()
  setFeed()
  ;(getConnectorProviders as jest.Mock).mockResolvedValue(RAW_PROVIDERS)
  ;(getItemState as jest.Mock).mockResolvedValue({ read: [], saved: [] })
  ;(listSavedItems as jest.Mock).mockResolvedValue([])
  ;(searchItems as jest.Mock).mockResolvedValue([])
  ;(setRepositoryFolder as jest.Mock).mockResolvedValue(undefined)
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true })
  useReadItemsStore.setState({
    readIds: new Set(),
    savedIds: new Set(),
    initialized: false,
    ready: false,
    sync: null,
  })
  useSelectedFeedItemStore.setState({ item: null, repoUrl: "", template: null, source: undefined })
})

describe("FeedScreen — server sync", () => {
  it("syncs the read state with the signed-in user", async () => {
    ;(getItemState as jest.Mock).mockResolvedValue({ read: ["rss:1"], saved: ["rss:2"] })
    renderWithProviders(<FeedScreen />)

    await waitFor(() => expect(getItemState).toHaveBeenCalledWith("user-1", expect.any(String)))
    await waitFor(() => expect(useReadItemsStore.getState().readIds.has("rss:1")).toBe(true))
    expect(useReadItemsStore.getState().savedIds.has("rss:2")).toBe(true)
  })
})

describe("FeedScreen — saved items", () => {
  it("lists the saved items from the API under the Enregistrés filter", async () => {
    ;(listSavedItems as jest.Mock).mockResolvedValue([
      { ...rssItem(3, 10, "Saved one"), provider: "rss" },
    ])
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.press(screen.getByText("Enregistrés"))

    await waitFor(() => expect(screen.getByText("Saved one")).toBeTruthy())
    expect(screen.queryByText("Article A")).toBeNull()
    expect(listSavedItems).toHaveBeenCalledWith("user-1", expect.any(String))
  })

  it("shows nothing when the saved items cannot be loaded", async () => {
    ;(listSavedItems as jest.Mock).mockRejectedValue(new Error("down"))
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.press(screen.getByText("Enregistrés"))

    await waitFor(() => expect(screen.queryByText("Article A")).toBeNull())
  })
})

describe("FeedScreen — search", () => {
  it("searches after a pause and replaces the list, then restores it", async () => {
    ;(searchItems as jest.Mock).mockResolvedValue([
      { ...rssItem(4, 10, "Found it"), provider: "rss" },
    ])
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.changeText(screen.getByLabelText("Rechercher…"), " rel ")

    await waitFor(() => expect(screen.getByText("Found it")).toBeTruthy())
    expect(searchItems).toHaveBeenCalledWith("user-1", "rel", expect.any(String))
    expect(screen.queryByText("Article A")).toBeNull()

    fireEvent.press(screen.getByLabelText("Effacer la recherche"))
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
  })

  it("does not search for a single character", async () => {
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.changeText(screen.getByLabelText("Rechercher…"), "r")
    await new Promise((r) => setTimeout(r, 400))

    expect(searchItems).not.toHaveBeenCalled()
    expect(screen.getByText("Article A")).toBeTruthy()
  })

  it("shows nothing when the search fails", async () => {
    ;(searchItems as jest.Mock).mockRejectedValue(new Error("down"))
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.changeText(screen.getByLabelText("Rechercher…"), "rel")

    await waitFor(() => expect(screen.queryByText("Article A")).toBeNull())
  })

  it("keeps showing every result in unread mode while searching", async () => {
    ;(searchItems as jest.Mock).mockResolvedValue([
      { ...rssItem(4, 10, "Found it"), provider: "rss" },
    ])
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())
    useReadItemsStore.setState({ readIds: new Set(["rss:4"]) })
    fireEvent.press(screen.getByText("Non lu"))

    fireEvent.changeText(screen.getByLabelText("Rechercher…"), "rel")

    await waitFor(() => expect(screen.getByText("Found it")).toBeTruthy())
  })
})

describe("FeedScreen — folders", () => {
  it("filters the feed to the flux of a folder, and back", async () => {
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.press(screen.getByText("AI"))
    await waitFor(() => expect(screen.queryByText("Article B")).toBeNull())
    expect(screen.getByText("Article A")).toBeTruthy()

    fireEvent.press(screen.getByText("AI"))
    await waitFor(() => expect(screen.getByText("Article B")).toBeTruthy())
  })

  it("leaves the folder when a provider is picked, and the provider when a folder is", async () => {
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.press(screen.getByText("AI"))
    fireEvent.press(screen.getByText("RSS"))
    await waitFor(() => expect(screen.getByText("Article B")).toBeTruthy())

    fireEvent.press(screen.getByText("AI"))
    await waitFor(() => expect(screen.queryByText("Article B")).toBeNull())
  })

  it("moves a flux into a folder from its chip", async () => {
    setFeed([repo("l1", 10), repo("l2", 11)])
    renderWithProviders(<FeedScreen />)
    await waitFor(() => expect(screen.getByText("Article A")).toBeTruthy())

    fireEvent.press(screen.getByText("RSS"))
    fireEvent.press(screen.getAllByLabelText("Déplacer dans un dossier")[0])
    fireEvent.changeText(screen.getByLabelText("Nom du dossier (vide pour retirer)"), " Security ")
    fireEvent.press(screen.getByText("Enregistrer"))

    await waitFor(() =>
      expect(setRepositoryFolder).toHaveBeenCalledWith(
        "user-1",
        "l1",
        "Security",
        expect.any(String),
      ),
    )
  })
})

describe("FolderSheet", () => {
  const flux: FeedFlux = {
    id: "l1",
    repository_id: 10,
    provider: "rss",
    url: "https://blog.example.com/feed.xml",
    identifier: "blog",
    folder: "AI",
  }

  function sheet(over: Partial<React.ComponentProps<typeof FolderSheet>> = {}) {
    const props = { onClose: jest.fn(), onSaved: jest.fn() }
    renderWithProviders(
      <FolderSheet flux={flux} userId="user-1" token="jwt" {...props} {...over} />,
    )
    return props
  }

  it("starts from the current folder and clears it when the name is emptied", async () => {
    const { onSaved, onClose } = sheet()
    const input = screen.getByLabelText("Nom du dossier (vide pour retirer)")
    expect(input.props.value).toBe("AI")

    fireEvent.changeText(input, "")
    fireEvent.press(screen.getByText("Enregistrer"))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(setRepositoryFolder).toHaveBeenCalledWith("user-1", "l1", null, "jwt")
    expect(onClose).toHaveBeenCalled()
  })

  it("starts empty for a flux without folder", () => {
    sheet({ flux: { ...flux, folder: undefined } })
    expect(screen.getByLabelText("Nom du dossier (vide pour retirer)").props.value).toBe("")
  })

  it("shows an error and stays open when the API refuses", async () => {
    ;(setRepositoryFolder as jest.Mock).mockRejectedValue(new Error("500"))
    const { onClose, onSaved } = sheet()

    fireEvent.press(screen.getByText("Enregistrer"))

    await waitFor(() => expect(screen.getByText("Une erreur est survenue.")).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("stays open when the sheet itself is pressed", () => {
    const { onClose } = sheet()
    const stopPropagation = jest.fn()

    fireEvent.press(screen.getByText("Déplacer dans un dossier"), { stopPropagation })

    expect(stopPropagation).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("closes without saving", () => {
    const { onClose } = sheet()
    fireEvent.press(screen.getByText("Annuler"))
    expect(onClose).toHaveBeenCalled()
    expect(setRepositoryFolder).not.toHaveBeenCalled()
  })

  it("renders nothing and does nothing without a flux", () => {
    sheet({ flux: null })
    expect(screen.queryByText("Enregistrer")).toBeNull()
  })

  it("ignores a save pressed with no flux", async () => {
    // The only way to reach handleSave without a flux is a stale press on a closing sheet.
    const { rerender } = renderWithProviders(
      <FolderSheet
        flux={flux}
        userId="user-1"
        token="jwt"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    )
    const press = screen.getByText("Enregistrer")
    rerender(
      <FolderSheet
        flux={null}
        userId="user-1"
        token="jwt"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    )
    fireEvent.press(press)
    expect(setRepositoryFolder).not.toHaveBeenCalled()
  })
})

describe("FeedFluxList — folder chips", () => {
  const fluxes: FeedFlux[] = [
    {
      id: "a",
      repository_id: 1,
      provider: "rss",
      url: "https://a.dev/feed",
      identifier: "a",
      folder: "AI",
    },
    {
      id: "b",
      repository_id: 2,
      provider: "rss",
      url: "https://b.dev/feed",
      identifier: "b",
      folder: "AI",
    },
    {
      id: "c",
      repository_id: 3,
      provider: "rss",
      url: "https://c.dev/feed",
      identifier: "c",
      folder: null,
    },
  ]

  function list(over: Partial<React.ComponentProps<typeof FeedFluxList>> = {}) {
    const props = {
      onSelectProvider: jest.fn(),
      onSelectFolder: jest.fn(),
      onMoveToFolder: jest.fn(),
    }
    renderWithProviders(
      <FeedFluxList
        fluxes={fluxes}
        templates={TEMPLATES}
        userId="user-1"
        token="jwt"
        selectedProvider={null}
        onAddPress={jest.fn()}
        onDeleted={jest.fn()}
        onImported={jest.fn()}
        unreadCountByRepoId={{ 1: 2, 2: 1 }}
        {...props}
        {...over}
      />,
    )
    return props
  }

  it("shows one chip per folder with its unread total, and selects it", () => {
    const { onSelectFolder } = list()
    expect(screen.getAllByText("3").length).toBeGreaterThan(0)
    fireEvent.press(screen.getByText("AI"))
    expect(onSelectFolder).toHaveBeenCalledWith("AI")
  })

  it("deselects the folder when pressed again", () => {
    const { onSelectFolder } = list({ selectedFolder: "AI" })
    fireEvent.press(screen.getByText("AI"))
    expect(onSelectFolder).toHaveBeenCalledWith(null)
  })

  it("lists only the flux of the selected folder, each movable", () => {
    const { onMoveToFolder } = list({ selectedFolder: "AI" })
    expect(screen.getByText("a")).toBeTruthy()
    expect(screen.getByText("b")).toBeTruthy()
    expect(screen.queryByText("c")).toBeNull()

    fireEvent.press(screen.getAllByLabelText("Déplacer dans un dossier")[0])
    expect(onMoveToFolder).toHaveBeenCalledWith(fluxes[0])
  })

  it("shows no folder chip when nothing is in a folder", () => {
    list({ fluxes: [fluxes[2]] })
    expect(screen.queryByText("AI")).toBeNull()
  })

  it("works without folder handlers (defaults)", () => {
    renderWithProviders(
      <FeedFluxList
        fluxes={fluxes}
        templates={TEMPLATES}
        userId="user-1"
        token="jwt"
        selectedProvider="rss"
        onSelectProvider={jest.fn()}
        onAddPress={jest.fn()}
        onDeleted={jest.fn()}
        onImported={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByText("AI"))
    fireEvent.press(screen.getAllByLabelText("Déplacer dans un dossier")[0])
    expect(screen.getByText("a")).toBeTruthy()
  })
})

describe("FeedDetailScreen — save button", () => {
  const tagged: TaggedItem = { provider: "rss", item: rssItem(1, 10, "Article A") } as TaggedItem

  it("saves and unsaves the open item", async () => {
    useSelectedFeedItemStore.setState({
      item: tagged,
      repoUrl: "",
      template: null,
      source: undefined,
    })
    useReadItemsStore.setState({ initialized: true, sync: { userId: "user-1", token: "jwt" } })
    renderWithProviders(<FeedDetailScreen />)

    fireEvent.press(screen.getByLabelText("Garder pour plus tard"))
    await waitFor(() => expect(setItemSaved).toHaveBeenLastCalledWith("user-1", 1, true, "jwt"))

    fireEvent.press(screen.getByLabelText("Retirer des enregistrés"))
    await waitFor(() => expect(setItemSaved).toHaveBeenLastCalledWith("user-1", 1, false, "jwt"))
  })
})

describe("usePushNotifications", () => {
  function run(userId: string | undefined, token: string | null, unread: number) {
    return renderHook(() => usePushNotifications(userId, token, "fr", unread))
  }

  it("registers the device and shows the unread count on the icon once the state is merged", async () => {
    useReadItemsStore.setState({ ready: true })
    run("user-1", "jwt", 4)

    await waitFor(() =>
      expect(registerPushToken).toHaveBeenCalledWith(
        "user-1",
        "ExponentPushToken[abc]",
        "fr",
        "jwt",
      ),
    )
    await waitFor(() => expect(notifications.setBadgeCountAsync).toHaveBeenCalledWith(4))
  })

  it("holds the badge back until the server's read state is in", async () => {
    useReadItemsStore.setState({ ready: false })
    run("user-1", "jwt", 4)

    await waitFor(() => expect(registerPushToken).toHaveBeenCalled())
    expect(notifications.setBadgeCountAsync).not.toHaveBeenCalled()
  })

  it("does nothing when the user turned push off", async () => {
    stubStorage({ push_enabled: "false" })
    useReadItemsStore.setState({ ready: true })
    run("user-1", "jwt", 4)

    await new Promise((r) => setTimeout(r, 20))
    expect(registerPushToken).not.toHaveBeenCalled()
    expect(notifications.setBadgeCountAsync).not.toHaveBeenCalled()
  })

  it("does not register without a session", async () => {
    useReadItemsStore.setState({ ready: true })
    run(undefined, null, 0)

    await new Promise((r) => setTimeout(r, 20))
    expect(registerPushToken).not.toHaveBeenCalled()
  })
})

describe("ProfileScreen — push switch", () => {
  async function profile(values: Record<string, string> = {}) {
    stubStorage(values)
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("Jean")).toBeTruthy())
    return screen.getByLabelText("Notifications push")
  }

  it("shows the stored choice", async () => {
    const off = await profile({ push_enabled: "false" })
    await waitFor(() => expect(off.props.value).toBe(false))
  })

  it("turning it off unregisters the device and clears the badge", async () => {
    stubStorage({ push_token: "ExponentPushToken[abc]" })
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("Jean")).toBeTruthy())

    fireEvent(screen.getByLabelText("Notifications push"), "valueChange", false)

    await waitFor(() =>
      expect(unregisterPushToken).toHaveBeenCalledWith(
        "user-1",
        "ExponentPushToken[abc]",
        expect.any(String),
      ),
    )
    expect(asyncStorage.setItem).toHaveBeenCalledWith("push_enabled", "false")
    expect(notifications.setBadgeCountAsync).toHaveBeenCalledWith(0)
  })

  it("turning it on registers the device again", async () => {
    await profile({ push_enabled: "false" })

    fireEvent(screen.getByLabelText("Notifications push"), "valueChange", true)

    await waitFor(() => expect(registerPushToken).toHaveBeenCalled())
    expect(asyncStorage.setItem).toHaveBeenCalledWith("push_enabled", "true")
  })

  it("only stores the choice when nobody is signed in", async () => {
    secureStore.getItemAsync.mockResolvedValue(null)
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("?")).toBeTruthy())

    fireEvent(screen.getByLabelText("Notifications push"), "valueChange", false)

    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalledWith("push_enabled", "false"))
    expect(unregisterPushToken).not.toHaveBeenCalled()
  })

  it("signing out unregisters the device and clears the badge first", async () => {
    stubStorage({ push_token: "ExponentPushToken[abc]" })
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("Jean")).toBeTruthy())

    fireEvent.press(screen.getByText("Déconnexion"))

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login"))
    expect(unregisterPushToken).toHaveBeenCalled()
    expect(notifications.setBadgeCountAsync).toHaveBeenCalledWith(0)
  })

  it("signing out without a session still goes back to the login", async () => {
    secureStore.getItemAsync.mockResolvedValue(null)
    renderWithProviders(<ProfileScreen />)
    await waitFor(() => expect(screen.getByText("?")).toBeTruthy())

    fireEvent.press(screen.getByText("Déconnexion"))

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login"))
    expect(unregisterPushToken).not.toHaveBeenCalled()
  })
})
