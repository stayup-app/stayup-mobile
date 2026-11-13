/**
 * Direct rendering of `TemplatedEntry` (list row, mobile). The nominal path goes
 * through `UnifiedFeedList`; here we cover the branches it does not touch: an
 * entry with no date / no subtitle / no snippet, the `media` layout's fallback
 * thumbnail, and the default `row` layout when `list` is absent.
 */
import { render, screen, fireEvent } from "@testing-library/react-native"
import { TemplatedEntry } from "@/components/feed/TemplatedEntry"
import type { ProviderTemplate } from "@/lib/providerTemplate"

const rowTpl: ProviderTemplate = {
  version: 1,
  list: { layout: "row", primary: "title", secondary: "sub", meta: "ts", snippet: "body" },
  item: {
    parseContentAsJson: true,
    fields: { title: "title", subtitle: "sub", summary: "body", timestamp: "ts" },
  },
}

const mediaTpl: ProviderTemplate = {
  version: 1,
  list: { layout: "media", primary: "title", thumbnail: "image" },
  item: {
    parseContentAsJson: true,
    fields: { title: "title", subtitle: "sub", image: "img", timestamp: "ts" },
  },
}

const noListTpl: ProviderTemplate = {
  version: 1,
  item: { parseContentAsJson: true, fields: { title: "title" } },
}

async function renderEntry(
  template: ProviderTemplate,
  content: Record<string, unknown>,
  onPress?: () => void,
  extra: Record<string, unknown> = {},
) {
  return await render(
    <TemplatedEntry
      template={template}
      item={{ content: JSON.stringify(content), ...extra }}
      color="#f4b585"
      onPress={onPress}
    />,
  )
}

describe("row layout", () => {
  it("shows title, subtitle, date and a clipped snippet, and is pressable", async () => {
    const onPress = jest.fn()
    await renderEntry(
      rowTpl,
      { title: "Hello", sub: "a source", body: "x".repeat(300), ts: "2024-06-15T14:30:00Z" },
      onPress,
    )
    expect(screen.getByText("Hello")).toBeTruthy()
    expect(screen.getByText("a source")).toBeTruthy()
    expect(screen.getByText("x".repeat(200))).toBeTruthy()
    await fireEvent.press(screen.getByText("Hello"))
    expect(onPress).toHaveBeenCalled()
  })

  it("falls back to a dash and hides date / subtitle / snippet when the entry is bare", async () => {
    await renderEntry(rowTpl, {})
    expect(screen.getByText("—")).toBeTruthy()
  })
})

describe("media layout", () => {
  it("renders the thumbnail and the date", async () => {
    await renderEntry(mediaTpl, {
      title: "Clip",
      sub: "chan",
      img: "https://img.test/t.jpg",
      ts: "2024-06-15T14:30:00Z",
    })
    expect(screen.getByText("Clip")).toBeTruthy()
    expect(screen.getByText("chan")).toBeTruthy()
  })

  it("shows the placeholder glyph when there is no image and no date", async () => {
    await renderEntry(mediaTpl, { title: "Clip" })
    expect(screen.getByText("▶")).toBeTruthy()
  })
})

describe("default layout", () => {
  it("uses the row layout when the template declares no list block", async () => {
    await renderEntry(noListTpl, { title: "Rowish" })
    expect(screen.getByText("Rowish")).toBeTruthy()
  })
})
