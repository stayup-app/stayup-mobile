import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import * as SecureStore from "expo-secure-store"
import { AddFluxSheet } from "@/components/feed/AddFluxSheet"
import {
  addUserRepository,
  getConnectorProviders,
  getProviderFluxes,
  subscribeFlux,
} from "@/lib/api"
import { renderWithProviders } from "./render"
import { RAW_PROVIDERS } from "./_templates"

jest.mock("@/lib/api", () => ({
  addUserRepository: jest.fn(),
  getProviderFluxes: jest.fn(),
  subscribeFlux: jest.fn(),
  getConnectorProviders: jest.fn(),
}))

const secureStore = SecureStore as unknown as { getItemAsync: jest.Mock }
const mockedAdd = addUserRepository as jest.Mock
const mockedGetFluxes = getProviderFluxes as jest.Mock
const mockedSubscribe = subscribeFlux as jest.Mock
const mockedGetConnectorProviders = getConnectorProviders as jest.Mock

const TOKEN = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: "user-1" }))
  .toString("base64")
  .replace(/=/g, "")}.sig`

// `scrap` is the `manual`-mode provider in this fixture set.
function providers() {
  return RAW_PROVIDERS.filter((p) => p.name !== "github_trending").map((p) => ({
    ...p,
    fluxApproval: p.name === "scrap" ? "manual" : "auto",
  }))
}

async function setup(props: Partial<React.ComponentProps<typeof AddFluxSheet>> = {}) {
  const onClose = jest.fn()
  const onSuccess = jest.fn()
  await renderWithProviders(
    <AddFluxSheet visible onClose={onClose} token={TOKEN} onSuccess={onSuccess} {...props} />,
  )
  await waitFor(() => expect(screen.getByText("Changelog")).toBeTruthy())
  return { onClose, onSuccess }
}

// The sheet opens on "Choisir un flux existant": adding a new one is an explicit tap.
async function chooseNew() {
  await waitFor(() => expect(screen.getByText("Ajouter un nouveau")).toBeTruthy())
  await fireEvent.press(screen.getByText("Ajouter un nouveau"))
}

function firstInput() {
  return screen.container.queryAll((n) => n.type === "TextInput")[0]
}

beforeEach(() => {
  secureStore.getItemAsync.mockResolvedValue("tok")
  mockedGetFluxes.mockResolvedValue([])
  mockedAdd.mockResolvedValue({ repository: { id: "r1" } })
  mockedGetConnectorProviders.mockResolvedValue(providers())
})

describe("AddFluxSheet — providers", () => {
  it("lists the four feed providers", async () => {
    await setup()
    expect(screen.getByText("YouTube")).toBeTruthy()
    expect(screen.getByText("RSS")).toBeTruthy()
    expect(screen.getByText("Scrap")).toBeTruthy()
  }, 20000)
})

describe("AddFluxSheet — add a new flux", () => {
  it("builds the repository url from the connector form and posts it", async () => {
    const { onSuccess, onClose } = await setup()
    await chooseNew()
    await waitFor(() => expect(screen.getByText("GitHub repo (owner/repo or URL)")).toBeTruthy())

    await fireEvent.changeText(firstInput(), "https://github.com/facebook/react.git")
    await fireEvent.press(screen.getByText("Ajouter"))

    await waitFor(() =>
      expect(mockedAdd).toHaveBeenCalledWith("user-1", TOKEN, {
        provider: "changelog",
        url: "https://github.com/facebook/react/",
        config: { max_scraps: 5, retention_days: 15 },
      }),
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("shows the connector form label of the selected provider", async () => {
    await setup()
    await fireEvent.press(screen.getByText("RSS"))
    await chooseNew()
    await waitFor(() => expect(screen.getByText("RSS/Atom feed URL")).toBeTruthy())
  })

  it("rejects an empty identifier", async () => {
    await setup()
    await chooseNew()
    await waitFor(() => expect(screen.getByText("Ajouter")).toBeTruthy())
    await fireEvent.press(screen.getByText("Ajouter"))
    await waitFor(() => expect(screen.getByText("Ce champ est requis")).toBeTruthy())
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it("shows the pending screen when the API answers 202 (provider `manual`)", async () => {
    mockedAdd.mockResolvedValue({ status: "pending" })
    await setup()
    await fireEvent.press(screen.getByText("Scrap"))
    await chooseNew()

    await fireEvent.changeText(firstInput(), "https://blog.dev")
    await fireEvent.press(screen.getByText("Ajouter"))

    await waitFor(() => expect(screen.getByText("Demande envoyée !")).toBeTruthy())
  })

  it("surfaces the API error", async () => {
    mockedAdd.mockRejectedValue(new Error("StayUp API error 500"))
    await setup()
    await chooseNew()

    await fireEvent.changeText(firstInput(), "facebook/react")
    await fireEvent.press(screen.getByText("Ajouter"))

    await waitFor(() => expect(screen.getByText("StayUp API error 500")).toBeTruthy())
  })
})

describe("AddFluxSheet — manual provider hint", () => {
  it("does not show the request-sent text before the user submits", async () => {
    await setup()
    await fireEvent.press(screen.getByText("Scrap"))
    await chooseNew()
    expect(screen.queryByText(/Votre demande a bien été envoyée/)).toBeNull()
  })
})

describe("AddFluxSheet — subscribe to an existing flux", () => {
  it("lists the provider fluxes and subscribes to the selected one", async () => {
    mockedGetFluxes.mockResolvedValue([
      { id: 1, url: "https://a.example.com", config: {}, created_at: "", is_subscribed: false },
      { id: 2, url: "https://b.example.com", config: {}, created_at: "", is_subscribed: true },
    ])
    const { onSuccess } = await setup()
    await fireEvent.press(screen.getByText("RSS"))

    await waitFor(() => expect(screen.getByText("a.example")).toBeTruthy())
    expect(screen.queryByText("b.example")).toBeNull()

    await fireEvent.press(screen.getByText("a.example"))
    await fireEvent.press(screen.getByText("Ajouter"))

    await waitFor(() => expect(mockedSubscribe).toHaveBeenCalledWith("rss", 1, TOKEN))
    expect(onSuccess).toHaveBeenCalled()
  })

  it("requires a selection before subscribing", async () => {
    mockedGetFluxes.mockResolvedValue([
      { id: 1, url: "https://a.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    await setup()
    await fireEvent.press(screen.getByText("RSS"))
    await waitFor(() => expect(screen.getByText("a.example")).toBeTruthy())

    await fireEvent.press(screen.getByText("Ajouter"))
    await waitFor(() => expect(screen.getByText("Sélectionnez un flux")).toBeTruthy())
    expect(mockedSubscribe).not.toHaveBeenCalled()
  })
})

describe("AddFluxSheet — fermeture", () => {
  it("closes from the cross", async () => {
    const { onClose } = await setup()
    await fireEvent.press(screen.getByTestId("icon-X"))
    expect(onClose).toHaveBeenCalled()
  })

  it("closes from the cancel button", async () => {
    const { onClose } = await setup()
    await fireEvent.press(screen.getByText("Annuler"))
    expect(onClose).toHaveBeenCalled()
  })

  it("a tap inside the sheet does not bubble to the backdrop", async () => {
    const { onClose } = await setup()
    await fireEvent.press(screen.getByText("Ajouter un flux"), { stopPropagation: jest.fn() })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("AddFluxSheet — mode toggle & guards", () => {
  it("switches between the existing-flux list and the new-flux form", async () => {
    mockedGetFluxes.mockResolvedValue([
      { id: 1, url: "https://a.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    await setup()
    await fireEvent.press(screen.getByText("RSS"))
    await waitFor(() => expect(screen.getByText("a.example")).toBeTruthy())

    await fireEvent.press(screen.getByText("Ajouter un nouveau"))
    await waitFor(() => expect(screen.getByText("RSS/Atom feed URL")).toBeTruthy())

    await fireEvent.press(screen.getByText("Choisir un flux existant"))
    await waitFor(() => expect(screen.getByText("a.example")).toBeTruthy())
  })

  it("shows 'no flux available' when every flux is already followed", async () => {
    mockedGetFluxes.mockResolvedValue([
      { id: 1, url: "https://a.example.com", config: {}, created_at: "", is_subscribed: true },
    ])
    await setup()
    await fireEvent.press(screen.getByText("RSS"))
    // Every flux is already followed → the picker is shown, with nothing to pick.
    await waitFor(() => expect(screen.getByText("Aucun flux disponible")).toBeTruthy())
  })

  it("rejects an identifier that does not match the connector pattern", async () => {
    await setup()
    await fireEvent.press(screen.getByText("RSS")) // pattern ^https?://.+
    await chooseNew()
    await waitFor(() => expect(screen.getByText("RSS/Atom feed URL")).toBeTruthy())
    await fireEvent.changeText(firstInput(), "not-a-url")
    await fireEvent.press(screen.getByText("Ajouter"))
    await waitFor(() => expect(screen.getByText("Ce champ est requis")).toBeTruthy())
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it("falls back to a generic message when a non-Error is thrown", async () => {
    mockedAdd.mockRejectedValue("nope")
    await setup()
    await chooseNew()
    await fireEvent.changeText(firstInput(), "facebook/react")
    await fireEvent.press(screen.getByText("Ajouter"))
    await waitFor(() => expect(screen.getByText("Une erreur est survenue.")).toBeTruthy())
  })

  it("falls back to a generic message when subscribing throws a non-Error", async () => {
    mockedGetFluxes.mockResolvedValue([
      { id: 1, url: "https://a.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    mockedSubscribe.mockRejectedValue("boom")
    await setup()
    await fireEvent.press(screen.getByText("RSS"))
    await waitFor(() => expect(screen.getByText("a.example")).toBeTruthy())
    await fireEvent.press(screen.getByText("a.example"))
    await fireEvent.press(screen.getByText("Ajouter"))
    await waitFor(() => expect(screen.getByText("Une erreur est survenue.")).toBeTruthy())
  })
})

describe("AddFluxSheet — degraded auth & payloads", () => {
  it("tolerates a flux endpoint that resolves nothing", async () => {
    mockedGetFluxes.mockResolvedValue(undefined as never)
    await setup()
    await chooseNew()
    await waitFor(() => expect(screen.getByText("GitHub repo (owner/repo or URL)")).toBeTruthy())
  })

  it("renders a provider that has no template, displayName or approval flag", async () => {
    mockedGetConnectorProviders.mockResolvedValue([{ name: "custom", template: null }] as never)
    const onClose = jest.fn()
    const onSuccess = jest.fn()
    await renderWithProviders(
      <AddFluxSheet visible onClose={onClose} token={TOKEN} onSuccess={onSuccess} />,
    )
    await waitFor(() => expect(screen.getByText("custom")).toBeTruthy())
  })
})

describe("AddFluxSheet — network failures", () => {
  it("renders no provider tiles when the connector list fails to load", async () => {
    mockedGetConnectorProviders.mockRejectedValue(new Error("offline"))
    const onClose = jest.fn()
    const onSuccess = jest.fn()
    await renderWithProviders(
      <AddFluxSheet visible onClose={onClose} token={TOKEN} onSuccess={onSuccess} />,
    )
    await waitFor(() => expect(screen.getByText("Ajouter un flux")).toBeTruthy())
    expect(screen.queryByText("Changelog")).toBeNull()
  })

  it("treats a failed flux fetch as an empty list", async () => {
    mockedGetFluxes.mockRejectedValue(new Error("boom"))
    await setup()
    await chooseNew()
    await waitFor(() => expect(screen.getByText("GitHub repo (owner/repo or URL)")).toBeTruthy())
  })
})
