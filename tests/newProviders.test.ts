import { PROVIDERS } from "@/lib/providers"
import {
  buildFluxUrl,
  matchesFormPattern,
  resolveFeedLabel,
  resolveItemView,
  resolveOpenUrl,
  resolveText,
  makeCtx,
} from "@/lib/providerTemplate"

const tpl = (name: string) => {
  const template = PROVIDERS[name]?.template
  if (!template) throw new Error(`no template for ${name}`)
  return template
}

describe("reddit template", () => {
  const row = {
    id: 1,
    datetime: "2026-01-01T00:00:00Z",
    content: JSON.stringify({
      title: "Show HN: a thing",
      link: "https://www.reddit.com/r/python/comments/abc/show_hn/",
      url: "https://example.com/thing",
      subreddit: "python",
      author: "guido",
      score: 1234,
      comments: 56,
      summary: "Some text",
    }),
  }
  const source = { url: "https://www.reddit.com/r/python/" }

  it("labels a post with its subreddit and score", () => {
    const view = resolveItemView(tpl("reddit"), row, source)
    expect(view.title).toBe("Show HN: a thing")
    expect(view.subtitle).toBe("r/python · ▲ 1234")
    expect(view.summary).toBe("Some text")
    expect(view.url).toBe("https://www.reddit.com/r/python/comments/abc/show_hn/")
  })

  it("details the author and score, and opens the thread", () => {
    const template = tpl("reddit")
    const ctx = makeCtx(template, row, source)
    expect(resolveText(template.detail?.subtitle, ctx)).toBe("r/python · u/guido")
    expect(resolveText(template.detail?.badge, ctx)).toBe("▲ 1234")
    expect(resolveOpenUrl(template, row, source)).toBe(
      "https://www.reddit.com/r/python/comments/abc/show_hn/",
    )
  })

  it("labels the flux with the subreddit", () => {
    expect(resolveFeedLabel(tpl("reddit"), source)).toBe("r/python")
  })

  it.each([
    ["r/python", "https://www.reddit.com/r/python/"],
    ["/r/python", "https://www.reddit.com/r/python/"],
    ["python", "https://www.reddit.com/r/python/"],
    ["https://old.reddit.com/r/python/top/?t=week", "https://www.reddit.com/r/python/"],
    ["  r/python+django  ", "https://www.reddit.com/r/python+django/"],
  ])("builds the flux URL from %s", (input, expected) => {
    expect(buildFluxUrl(tpl("reddit").form, input)).toBe(expected)
  })
})

describe("podcast template", () => {
  const row = {
    id: 2,
    datetime: "2026-01-01T00:00:00Z",
    content: JSON.stringify({
      title: "Episode 12",
      link: "https://show.example/12",
      summary: "Notes",
      audio: "https://cdn.example/12.mp3",
      image: "https://cdn.example/12.jpg",
      duration: "42:10",
    }),
  }

  it("shows the cover, the duration and the title in the list", () => {
    const view = resolveItemView(tpl("podcast"), row, {})
    expect(view.title).toBe("Episode 12")
    expect(view.subtitle).toBe("42:10")
    expect(view.image).toBe("https://cdn.example/12.jpg")
  })

  it("plays the audio in the detail", () => {
    const template = tpl("podcast")
    expect(template.detail?.mode).toBe("audio")
    expect(resolveText(template.detail?.audioUrl, makeCtx(template, row, {}))).toBe(
      "https://cdn.example/12.mp3",
    )
  })

  it("opens the episode page, or the audio when the feed has none", () => {
    const template = tpl("podcast")
    expect(resolveOpenUrl(template, row, {})).toBe("https://show.example/12")
    const noLink = {
      ...row,
      content: JSON.stringify({ title: "t", audio: "https://cdn.example/a.mp3" }),
    }
    expect(resolveOpenUrl(template, noLink, {})).toBe("https://cdn.example/a.mp3")
  })

  it("labels the flux with the show title, else the site", () => {
    const template = tpl("podcast")
    expect(
      resolveFeedLabel(template, {
        url: "https://feeds.example.com/x.xml",
        config: { title: "The Show" },
      }),
    ).toBe("The Show")
    expect(resolveFeedLabel(template, { url: "https://feeds.example.com/x.xml", config: {} })).toBe(
      "feeds.example",
    )
  })

  it("takes a feed URL as is", () => {
    const form = tpl("podcast").form
    expect(buildFluxUrl(form, " https://feeds.example.com/x.xml ")).toBe(
      "https://feeds.example.com/x.xml",
    )
    expect(matchesFormPattern(form, "https://feeds.example.com/x.xml")).toBe(true)
    expect(matchesFormPattern(form, "not a url")).toBe(false)
  })
})

describe("social template", () => {
  const row = {
    id: 3,
    datetime: "2026-01-01T00:00:00Z",
    content: JSON.stringify({
      network: "bluesky",
      author: "Alice",
      handle: "@alice.bsky.social",
      text: "Hello Bluesky",
      link: "https://bsky.app/profile/alice.bsky.social/post/3k1",
      likes: 7,
      reposts: 2,
    }),
  }

  it("lists the text of a post under its author", () => {
    const view = resolveItemView(tpl("social"), row, {})
    expect(view.title).toBe("Hello Bluesky")
    expect(view.subtitle).toBe("Alice · @alice.bsky.social")
    expect(view.url).toBe("https://bsky.app/profile/alice.bsky.social/post/3k1")
  })

  it("details the author, the counters, and opens the post", () => {
    const template = tpl("social")
    const ctx = makeCtx(template, row, {})
    expect(resolveText(template.detail?.title, ctx)).toBe("Alice")
    expect(resolveText(template.detail?.subtitle, ctx)).toBe("@alice.bsky.social")
    expect(resolveText(template.detail?.badge, ctx)).toBe("♥ 7 · ↻ 2")
    expect(resolveOpenUrl(template, row, {})).toBe(
      "https://bsky.app/profile/alice.bsky.social/post/3k1",
    )
  })

  it("labels the flux with the name the connector stored, else the URL path", () => {
    const template = tpl("social")
    expect(
      resolveFeedLabel(template, {
        url: "https://mastodon.social/@alice",
        config: { title: "@alice@mastodon.social" },
      }),
    ).toBe("@alice@mastodon.social")
    expect(resolveFeedLabel(template, { url: "https://mastodon.social/@alice", config: {} })).toBe(
      "@alice",
    )
  })

  it("takes an account, hashtag or profile URL as is", () => {
    const form = tpl("social").form
    for (const url of [
      "https://mastodon.social/@alice",
      "https://fosstodon.org/tags/python",
      "https://bsky.app/profile/alice.bsky.social",
    ]) {
      expect(buildFluxUrl(form, url)).toBe(url)
      expect(matchesFormPattern(form, url)).toBe(true)
    }
  })
})

describe("the providers sit after the original five in the sidebar", () => {
  it("has distinct sort orders", () => {
    const orders = Object.values(PROVIDERS).map((p) => p.template?.display?.sortOrder)
    expect(new Set(orders).size).toBe(orders.length)
  })
})
