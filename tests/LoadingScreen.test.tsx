import { render, screen } from "@testing-library/react-native"
import { LoadingScreen } from "@/components/ui/LoadingScreen"

describe("LoadingScreen", () => {
  it("renders without a message", async () => {
    await render(<LoadingScreen />)
    expect(screen.queryByText("Chargement…")).toBeNull()
  })

  it("renders the message when provided", async () => {
    await render(<LoadingScreen message="Chargement…" />)
    expect(screen.getByText("Chargement…")).toBeTruthy()
  })
})
