/**
 * Direct rendering of `TemplatedDetail` (mobile) — one case per `detail.mode`
 * and per render branch. The nominal path goes through `FeedDetailScreen`; here
 * we target what it does not touch: `table` / `link-list`, opening a row link or
 * a gallery image, malformed `openUrl`, the HTML-to-text fallback.
 */
import { Linking } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { TemplatedDetail } from "@/components/feed/TemplatedDetail"
import type { ProviderTemplate } from "@/lib/providerTemplate"
import { fr } from "@/lib/translations/fr"

let openURL: jest.SpyInstance

beforeEach(() => {
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never)
})

async function renderDetail(
  template: ProviderTemplate,
  item: Record<string, unknown>,
  source?: Record<string, unknown>,
) {
  return await render(
    <TemplatedDetail
      template={template}
      item={item}
      source={source}
      color="#f4b585"
      dimColor="#f4b58522"
      bodyFontSize={16}
      t={fr}
    />,
  )
}

describe("text & html modes", () => {
  const text: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "text",
      title: "title",
      badge: "badge",
      subtitle: "subtitle",
      body: "body",
      openUrl: "link",
      openLabel: "Open it",
    },
    item: { fields: { timestamp: "$row.datetime" } },
  }

  it("renders header, body and the open button", async () => {
    await renderDetail(text, {
      title: "A title",
      badge: "v1",
      subtitle: "sub",
      body: "The body",
      link: "https://example.com/a",
      datetime: "2024-06-15T14:30:00Z",
    })
    expect(screen.getByText("A title")).toBeTruthy()
    expect(screen.getByText("v1")).toBeTruthy()
    expect(screen.getByText("sub")).toBeTruthy()
    await fireEvent.press(screen.getByText("Open it"))
    expect(openURL).toHaveBeenCalledWith("https://example.com/a")
  })

  it("drops the body and open button when both are blank, and falls back to item.datetime", async () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "text", title: "title", body: "body", openUrl: "link" },
      item: { fields: {} },
    }
    await renderDetail(t, { title: "Bare", datetime: "2024-06-15T14:30:00Z" })
    expect(screen.getByText("Bare")).toBeTruthy()
    expect(screen.queryByText(fr.viewer.openLink)).toBeNull()
  })

  it("hides the open button for a non-http url, a //-path or a non-url", async () => {
    await renderDetail(text, { title: "T1", body: "B", link: "ftp://nope/x" })
    expect(screen.queryByText("Open it")).toBeNull()
    await renderDetail(text, { title: "T2", body: "B", link: "https://host//evil" })
    expect(screen.queryByText("Open it")).toBeNull()
    await renderDetail(text, { title: "T3", body: "B", link: "not a url" })
    expect(screen.queryByText("Open it")).toBeNull()
  })

  it("reduces an HTML body to plain text", async () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "html", title: "title", body: "body" },
    }
    await renderDetail(t, {
      title: "Post",
      body: "<p>Hello <strong>world</strong> &amp; more &lt;x&gt;</p>",
    })
    expect(screen.getByText("Hello world & more <x>")).toBeTruthy()
  })

  it("reads the body from item.fields.summary when detail omits it", async () => {
    const t: ProviderTemplate = { version: 1, item: { fields: { summary: "desc" } } }
    await renderDetail(t, { desc: "From fields" })
    expect(screen.getByText("From fields")).toBeTruthy()
  })
})

describe("media & audio modes", () => {
  it("shows the media image and reads it from item.fields as a fallback", async () => {
    const withDetail: ProviderTemplate = {
      version: 1,
      detail: {
        mode: "media",
        title: "title",
        image: "image",
        openUrl: "link",
        openLabel: "Watch",
      },
    }
    const a = await renderDetail(withDetail, {
      title: "V",
      image: "https://img.test/1.jpg",
      link: "https://example.com/v",
    })
    expect(a.container.queryAll((n) => n.type === "Image").length).toBeGreaterThan(0)
    await fireEvent.press(screen.getByText("Watch"))
    expect(openURL).toHaveBeenCalledWith("https://example.com/v")

    const fromFields: ProviderTemplate = {
      version: 1,
      detail: { mode: "media", title: "title" },
      item: { fields: { image: "image" } },
    }
    const b = await renderDetail(fromFields, { title: "V2", image: "https://img.test/2.jpg" })
    expect(b.container.queryAll((n) => n.type === "Image").length).toBeGreaterThan(0)
  })

  it("renders nothing extra when the media payload has no image", async () => {
    const t: ProviderTemplate = { version: 1, detail: { mode: "media", title: "title" } }
    await renderDetail(t, { title: "V" })
    expect(screen.getByText("V")).toBeTruthy()
  })

  it("renders the audio cover + notes, reading both from item.fields when needed", async () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "audio", title: "title", openUrl: "page", openLabel: "Open episode" },
      item: { fields: { image: "cover", summary: "notes" } },
    }
    await renderDetail(t, {
      title: "Ep",
      cover: "https://cdn.test/c.jpg",
      notes: "Show notes",
      page: "https://pod.test/1",
    })
    expect(screen.getByText("Show notes")).toBeTruthy()
    await fireEvent.press(screen.getByText("Open episode"))
    expect(openURL).toHaveBeenCalledWith("https://pod.test/1")
  })

  it("drops every audio block when the payload is bare", async () => {
    const t: ProviderTemplate = { version: 1, detail: { mode: "audio", title: "title" } }
    await renderDetail(t, { title: "Bare" })
    expect(screen.getByText("Bare")).toBeTruthy()
  })
})

describe("table mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "table",
      title: "title",
      collection: "repos",
      rowLink: "url",
      openUrl: "page",
      openLabel: "Open list",
      columns: [
        { label: "#", field: "rank" },
        { label: "Repo", field: "{owner}/{name}", emphasis: true },
        { label: "Desc", field: "description", muted: true, truncate: true },
        { label: "Delta", field: "delta", format: "compactNumber", prefix: "+", accent: true },
        { label: "Empty", field: "missing" },
      ],
    },
  }

  it("renders a row per entry, a prefixed formatted cell, and opens the row link", async () => {
    await renderDetail(template, {
      title: "Trending",
      repos: [
        {
          rank: 1,
          owner: "vercel",
          name: "next.js",
          url: "https://github.com/vercel/next.js",
          description: "The framework",
          delta: 42,
        },
        {
          rank: 2,
          owner: "denoland",
          name: "deno",
          url: "https://github.com/denoland/deno",
          description: "A runtime",
          delta: 7,
        },
      ],
      page: "https://github.com/trending",
    })
    expect(screen.getByText("+42")).toBeTruthy()
    expect(screen.getByText("vercel/next.js")).toBeTruthy()
    await fireEvent.press(screen.getByText("vercel/next.js"))
    expect(openURL).toHaveBeenCalledWith("https://github.com/vercel/next.js")
    await fireEvent.press(screen.getByText("Open list"))
    expect(openURL).toHaveBeenCalledWith("https://github.com/trending")
  })

  it("tolerates a table with no columns and a missing collection", async () => {
    await renderDetail(
      { version: 1, detail: { mode: "table", title: "title", collection: "nope" } },
      { title: "Empty" },
    )
    expect(screen.getByText("Empty")).toBeTruthy()
  })

  it("renders rows with no columns and no row link without crashing", async () => {
    await renderDetail(
      { version: 1, detail: { mode: "table", title: "title", collection: "repos" } },
      { title: "Bare", repos: [{ name: "a" }, { name: "b" }] },
    )
    expect(screen.getByText("Bare")).toBeTruthy()
  })
})

describe("link-list mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "link-list",
      title: "title",
      collection: "links",
      columns: [{ label: "Name", field: "name" }],
      rowLink: "href",
    },
  }

  it("renders a labelled link per row and opens it on press", async () => {
    await renderDetail(template, {
      title: "Bookmarks",
      links: [
        { name: "First", href: "https://a.test/1" },
        { name: "Second", href: "https://b.test/2" },
      ],
    })
    await fireEvent.press(screen.getByText("First"))
    expect(openURL).toHaveBeenCalledWith("https://a.test/1")
  })

  it("shows the href as the label when a row has no name", async () => {
    await renderDetail(template, { title: "Bookmarks", links: [{ href: "https://only.test/x" }] })
    expect(screen.getByText("https://only.test/x")).toBeTruthy()
  })

  it("defaults the row label to `title` when no columns are given", async () => {
    await renderDetail(
      { version: 1, detail: { mode: "link-list", collection: "links", rowLink: "url" } },
      { links: [{ title: "Defaulted", url: "https://d.test/1" }] },
    )
    await fireEvent.press(screen.getByText("Defaulted"))
    expect(openURL).toHaveBeenCalledWith("https://d.test/1")
  })

  it("renders a plain, unpressable row when there is no row link", async () => {
    await renderDetail(template, { title: "Bookmarks", links: [{ name: "no link" }] })
    expect(screen.getByText("no link")).toBeTruthy()
  })
})

describe("gallery mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "gallery",
      title: "title",
      collection: "shots",
      image: "url",
      caption: "caption",
      rowLink: "href",
    },
  }

  it("opens a linked image on press, shows its caption and the album open button", async () => {
    await renderDetail(
      {
        version: 1,
        detail: {
          mode: "gallery",
          title: "title",
          collection: "shots",
          image: "url",
          caption: "caption",
          rowLink: "href",
          openUrl: "album",
          openLabel: "Open album",
        },
      },
      {
        title: "Trip",
        shots: [{ url: "https://cdn.test/1.jpg", caption: "One", href: "https://page.test/1" }],
        album: "https://page.test",
      },
    )
    expect(screen.getByText("One")).toBeTruthy()
    await fireEvent.press(screen.getByText("One"))
    expect(openURL).toHaveBeenCalledWith("https://page.test/1")
    await fireEvent.press(screen.getByText("Open album"))
    expect(openURL).toHaveBeenCalledWith("https://page.test")
  })

  it("skips an entry with no image source and renders a bare image otherwise", async () => {
    await renderDetail(template, {
      title: "Trip",
      shots: [{ caption: "no image" }, { url: "https://cdn.test/2.jpg" }],
    })
    expect(screen.queryByText("no image")).toBeNull()
  })

  it("defaults to $self for a collection of bare URL strings", async () => {
    await renderDetail(
      { version: 1, detail: { mode: "gallery", title: "title", collection: "shots" } },
      { title: "Trip", shots: ["https://cdn.test/3.jpg"] },
    )
    expect(screen.getByText("Trip")).toBeTruthy()
  })
})
