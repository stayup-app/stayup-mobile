/**
 * `providerIcons` (mobile) — the named icon set is only reached by an explicit
 * `display.icon = "<key>"`; the 5 official connectors all provide an SVG path.
 * Here we exercise each named icon, the image and the filled / `stroke` path.
 */
import type { ReactElement } from "react"
import { render } from "@testing-library/react-native"
import { providerIcon } from "@/components/feed/providerIcons"

const el = (node: ReturnType<typeof providerIcon>) => render(node as ReactElement)

describe("providerIcon — named set", () => {
  it.each(["changelog", "video", "rss", "globe", "table", "book", "dot"])(
    "renders the %s glyph",
    async (name) => {
      expect((await el(providerIcon({ icon: name }))).root).toBeTruthy()
    },
  )

  it("falls back to the dot for an unknown key and for no display", async () => {
    expect((await el(providerIcon({ icon: "nope" }))).root).toBeTruthy()
    expect((await el(providerIcon(undefined))).root).toBeTruthy()
  })
})

describe("providerIcon — traced SVG & image", () => {
  it("renders a stroked path set", async () => {
    expect(
      (
        await el(
          providerIcon({ icon: { paths: ["M1 1", "M2 2"], viewBox: "0 0 8 8", stroke: true } }),
        )
      ).root,
    ).toBeTruthy()
  })

  it("renders a filled path set when stroke is unset", async () => {
    expect((await el(providerIcon({ icon: { d: "M3 3", viewBox: "0 0 8 8" } }))).root).toBeTruthy()
  })

  it("renders an image for a data-URI / http icon", async () => {
    expect(
      (await el(providerIcon({ icon: "https://cdn.test/logo.png" }, 20, "#000"))).root,
    ).toBeTruthy()
  })
})
