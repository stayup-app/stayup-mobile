import { Alert } from "react-native"
import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import * as DocumentPicker from "expo-document-picker"
import * as Sharing from "expo-sharing"
import { ImportExportButtons } from "@/components/feed/ImportExportButtons"
import { addUserRepository, getProviderFluxes, subscribeFlux } from "@/lib/api"
import { buildOpml } from "@/lib/opml"
import type { FeedFlux } from "@/hooks/useFeed"
import { renderWithProviders } from "./render"

jest.mock("@/lib/api", () => ({
  addUserRepository: jest.fn(),
  getProviderFluxes: jest.fn(),
  subscribeFlux: jest.fn(),
}))

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }))
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }))

const mockFileCreate = jest.fn()
const mockFileWrite = jest.fn()
const mockFileText = jest.fn()
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((...uris: unknown[]) => ({
    uri: uris.join("/"),
    create: mockFileCreate,
    write: mockFileWrite,
    text: mockFileText,
  })),
  Paths: { cache: "cache-dir" },
}))

const secureStore = SecureStore as unknown as { getItemAsync: jest.Mock }
const mockedAdd = addUserRepository as jest.Mock
const mockedGetFluxes = getProviderFluxes as jest.Mock
const mockedSubscribe = subscribeFlux as jest.Mock
const mockedGetDocument = DocumentPicker.getDocumentAsync as jest.Mock
const mockedIsAvailable = Sharing.isAvailableAsync as jest.Mock
const mockedShare = Sharing.shareAsync as jest.Mock

function flux(overrides: Partial<FeedFlux> = {}): FeedFlux {
  return {
    id: "l1",
    repository_id: 1,
    provider: "changelog",
    url: "https://github.com/facebook/react/",
    identifier: "facebook/react",
    ...overrides,
  }
}

async function setup(fluxes: FeedFlux[] = []) {
  const onImported = jest.fn()
  await renderWithProviders(
    <ImportExportButtons fluxes={fluxes} userId="user-1" onImported={onImported} />,
  )
  return { onImported }
}

beforeEach(() => {
  jest.clearAllMocks()
  secureStore.getItemAsync.mockResolvedValue("token-1")
  mockedGetFluxes.mockResolvedValue([])
  mockedIsAvailable.mockResolvedValue(true)
})

describe("export", () => {
  it("writes and shares the OPML file", async () => {
    await setup([flux()])

    await fireEvent.press(screen.getByLabelText("Exporter les flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() => expect(mockFileWrite).toHaveBeenCalled())
    expect(mockFileWrite.mock.calls[0][0]).toContain('xmlUrl="https://github.com/facebook/react/"')
    expect(mockFileCreate).toHaveBeenCalledWith({ overwrite: true })
    expect(mockedShare).toHaveBeenCalled()
  })

  it("does not share when sharing is unavailable", async () => {
    mockedIsAvailable.mockResolvedValue(false)
    await setup([flux()])

    await fireEvent.press(screen.getByLabelText("Exporter les flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() => expect(mockFileWrite).toHaveBeenCalled())
    expect(mockedShare).not.toHaveBeenCalled()
  })
})

describe("import", () => {
  it("does nothing when the picker is cancelled", async () => {
    mockedGetDocument.mockResolvedValue({ canceled: true, assets: null })
    await setup([])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() => expect(mockedGetDocument).toHaveBeenCalled())
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it("adds new entries and reports the count", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///picked.opml", name: "picked.opml", lastModified: 0 }],
    })
    mockFileText.mockResolvedValue(
      buildOpml(
        [{ provider: "rss", url: "https://blog.example.com/feed.xml", identifier: "blog" }],
        "StayUp",
      ),
    )
    mockedAdd.mockResolvedValue(undefined)
    const { onImported } = await setup([])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd).toHaveBeenCalledWith("user-1", "token-1", {
      provider: "rss",
      url: "https://blog.example.com/feed.xml",
      config: { max_scraps: 5, retention_days: 15 },
    })
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(alertSpy).toHaveBeenCalledWith("Importer des flux", "1 ajouté(s)")
  })

  it("skips entries already present without calling the API", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///picked.opml", name: "picked.opml", lastModified: 0 }],
    })
    mockFileText.mockResolvedValue(
      buildOpml(
        [
          {
            provider: "changelog",
            url: "https://github.com/facebook/react/",
            identifier: "facebook/react",
          },
        ],
        "StayUp",
      ),
    )
    const { onImported } = await setup([flux()])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Importer des flux", "1 déjà présent(s)"),
    )
    expect(mockedAdd).not.toHaveBeenCalled()
    expect(onImported).not.toHaveBeenCalled()
  })

  it("marks a scrap entry unavailable when no matching repository is subscribable", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///picked.opml", name: "picked.opml", lastModified: 0 }],
    })
    mockFileText.mockResolvedValue(
      buildOpml(
        [
          {
            provider: "scrap",
            url: "https://news.ycombinator.com",
            identifier: "news.ycombinator.com",
          },
        ],
        "StayUp",
      ),
    )
    mockedGetFluxes.mockResolvedValue([])
    await setup([])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Importer des flux", "1 indisponible(s)"),
    )
    expect(mockedSubscribe).not.toHaveBeenCalled()
  })

  it("subscribes to a matching scrap repository", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///picked.opml", name: "picked.opml", lastModified: 0 }],
    })
    mockFileText.mockResolvedValue(
      buildOpml(
        [
          {
            provider: "scrap",
            url: "https://news.ycombinator.com",
            identifier: "news.ycombinator.com",
          },
        ],
        "StayUp",
      ),
    )
    mockedGetFluxes.mockResolvedValue([
      {
        id: 7,
        url: "https://news.ycombinator.com",
        config: {},
        created_at: "",
        is_subscribed: false,
      },
    ])
    await setup([])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() => expect(mockedSubscribe).toHaveBeenCalledWith("scrap", 7, "token-1"))
    expect(alertSpy).toHaveBeenCalledWith("Importer des flux", "1 ajouté(s)")
  })

  it("shows an alert for a file with no valid entries", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockedGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///picked.opml", name: "picked.opml", lastModified: 0 }],
    })
    mockFileText.mockResolvedValue("not opml")
    await setup([])

    await fireEvent.press(screen.getByLabelText("Importer des flux"), {
      stopPropagation: jest.fn(),
    })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Ce fichier n'a pas pu être lu comme un fichier OPML valide.",
      ),
    )
    expect(mockedAdd).not.toHaveBeenCalled()
  })
})
