import { screen, fireEvent } from "@testing-library/react-native"
import { UnifiedFeedList } from "@/components/feed/UnifiedFeedList"
import type { TaggedItem } from "@/types"
import { TEMPLATES } from "./_templates"
import { renderWithProviders } from "./render"

function changelog(overrides: Record<string, unknown> = {}): TaggedItem {
  return {
    provider: "changelog",
    item: {
      id: 1,
      repository_id: 10,
      content: "## Titre\r\nCorps du changelog",
      datetime: "2026-03-01T10:00:00Z",
      executed_at: "2026-03-01T11:00:00Z",
      success: true,
      version: "v1.2.3",
      ...overrides,
    },
  } as TaggedItem
}

function youtube(content: unknown): TaggedItem {
  return {
    provider: "youtube",
    item: {
      id: 2,
      repository_id: 11,
      version: "1",
      content: typeof content === "string" ? content : JSON.stringify(content),
      datetime: "2026-02-01T10:00:00Z",
      executed_at: "2026-02-01T11:00:00Z",
      success: true,
    },
  } as TaggedItem
}

function rss(content: unknown): TaggedItem {
  return {
    provider: "rss",
    item: {
      id: 3,
      repository_id: 12,
      content: typeof content === "string" ? content : JSON.stringify(content),
      datetime: "2026-01-01T10:00:00Z",
      executed_at: "2026-01-01T11:00:00Z",
      success: true,
    },
  } as TaggedItem
}

function scrap(params: unknown): TaggedItem {
  return {
    provider: "scrap",
    item: {
      id: 4,
      repository_id: 13,
      content: "Contenu scrapé",
      params,
      executed_at: "2025-12-01T11:00:00Z",
      success: true,
    },
  } as TaggedItem
}

function list(props: Partial<React.ComponentProps<typeof UnifiedFeedList>> = {}) {
  return renderWithProviders(
    <UnifiedFeedList items={[]} templates={TEMPLATES} repositories={[]} {...props} />,
  )
}

describe("UnifiedFeedList — état vide", () => {
  it("shows the empty message when there is nothing to display", () => {
    list()
    expect(screen.getByText("Aucun contenu disponible.")).toBeTruthy()
  })

  it("does not show the empty message while loading", () => {
    list({ loading: true })
    expect(screen.queryByText("Aucun contenu disponible.")).toBeNull()
  })
})

describe("UnifiedFeedList — rendu par template", () => {
  it("orders every provider together, newest first, with template titles", () => {
    list({
      items: [
        changelog(),
        youtube({ title: "Vidéo", url: "https://www.youtube.com/@fireship" }),
        rss({ title: "Article", link: "https://blog.example.com/a" }),
        scrap({ url: "https://example.com" }),
      ],
      repositories: [
        { repository_id: 10, url: "https://github.com/facebook/react", provider: "changelog" },
      ],
    })
    for (const title of ["facebook/react", "Vidéo", "Article", "Contenu scrapé"]) {
      expect(screen.getByText(title)).toBeTruthy()
    }
  })

  it("shows the changelog repo slug, version and stripped snippet", () => {
    list({
      items: [changelog()],
      repositories: [
        { repository_id: 10, url: "https://github.com/facebook/react", provider: "changelog" },
      ],
    })
    expect(screen.getByText("facebook/react")).toBeTruthy()
    expect(screen.getByText("v1.2.3")).toBeTruthy()
    expect(screen.getByText("Titre Corps du changelog")).toBeTruthy()
  })

  it("shows a dash title when the source repository is unknown", () => {
    list({ items: [changelog()] })
    expect(screen.getByText("—")).toBeTruthy()
    expect(screen.getByText("v1.2.3")).toBeTruthy()
  })

  it("hides the snippet when the changelog is empty", () => {
    list({ items: [changelog({ content: "" })] })
    expect(screen.queryByText("Titre Corps du changelog")).toBeNull()
  })

  it("calls the press handler with the tagged item", () => {
    const onPressItem = jest.fn()
    list({ items: [changelog()], onPressItem })
    fireEvent.press(screen.getByText("v1.2.3"))
    expect(onPressItem).toHaveBeenCalledWith(expect.objectContaining({ provider: "changelog" }))
  })

  it("shows the youtube title and channel handle", () => {
    list({
      items: [youtube({ title: "Nouvelle vidéo", url: "https://www.youtube.com/@fireship" })],
    })
    expect(screen.getByText("Nouvelle vidéo")).toBeTruthy()
    expect(screen.getByText("@fireship")).toBeTruthy()
  })

  it("renders a dash for unparsable youtube content", () => {
    list({ items: [youtube("pas du json")] })
    expect(screen.getByText("—")).toBeTruthy()
  })

  it("shows the rss title and source hostname", () => {
    list({ items: [rss({ title: "Article CSS", link: "https://www.css-tricks.com/x" })] })
    expect(screen.getByText("Article CSS")).toBeTruthy()
    expect(screen.getByText("css-tricks.com")).toBeTruthy()
  })

  it("shows the scrap excerpt and source hostname", () => {
    list({ items: [scrap({ url: "https://news.example.com" })] })
    expect(screen.getByText("Contenu scrapé")).toBeTruthy()
    expect(screen.getByText("news.example.com")).toBeTruthy()
  })

  it("dims a read row unless it is the open one", () => {
    const { toJSON } = list({
      items: [changelog()],
      readIds: new Set(["changelog:1"]),
    })
    expect(JSON.stringify(toJSON())).toContain('"opacity":0.45')
  })
})

describe("UnifiedFeedList — provider sans template", () => {
  it("renders a generic row with the capitalized provider label", () => {
    list({
      items: [
        {
          provider: "podcast",
          item: {
            id: 9,
            repository_id: 9,
            content: "Un épisode de test",
            executed_at: "2026-03-05T00:00:00Z",
          },
        } as TaggedItem,
      ],
    })
    expect(screen.getByText("Un épisode de test")).toBeTruthy()
    expect(screen.getByText("Podcast")).toBeTruthy()
  })
})
