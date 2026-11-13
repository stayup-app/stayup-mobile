import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import { LoginForm } from "@/components/auth/LoginForm"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { renderWithProviders } from "./render"

function inputs() {
  return screen.container.queryAll((n) => n.type === "TextInput")
}

describe("LoginForm", () => {
  it("submits the trimmed credentials", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    await renderWithProviders(<LoginForm onSubmit={onSubmit} loading={false} error={null} />)

    const [email, password] = inputs()
    await fireEvent.changeText(email, "jean@example.com")
    await fireEvent.changeText(password, "password")
    await fireEvent.press(screen.getByText("Se connecter"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("jean@example.com", "password"))
  })

  it("rejects an invalid email", async () => {
    const onSubmit = jest.fn()
    await renderWithProviders(<LoginForm onSubmit={onSubmit} loading={false} error={null} />)

    await fireEvent.changeText(inputs()[0], "pas-un-email")
    await fireEvent.changeText(inputs()[1], "password")
    await fireEvent.press(screen.getByText("Se connecter"))

    await waitFor(() => expect(screen.getByText("Email invalide")).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("requires a non-empty password", async () => {
    const onSubmit = jest.fn()
    await renderWithProviders(<LoginForm onSubmit={onSubmit} loading={false} error={null} />)

    await fireEvent.changeText(inputs()[0], "jean@example.com")
    await fireEvent.changeText(inputs()[1], "a")
    await fireEvent.changeText(inputs()[1], "")
    await fireEvent.press(screen.getByText("Se connecter"))

    await waitFor(() => expect(screen.getByText("Mot de passe requis")).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows the server error", async () => {
    await renderWithProviders(
      <LoginForm onSubmit={jest.fn()} loading={false} error="Identifiants invalides." />,
    )
    expect(screen.getByText("Identifiants invalides.")).toBeTruthy()
  })

  it("hides the label while loading", async () => {
    await renderWithProviders(<LoginForm onSubmit={jest.fn()} loading error={null} />)
    expect(screen.queryByText("Se connecter")).toBeNull()
  })
})

describe("RegisterForm", () => {
  it("submits name, email and password", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    await renderWithProviders(<RegisterForm onSubmit={onSubmit} loading={false} error={null} />)

    const [name, email, password] = inputs()
    await fireEvent.changeText(name, "Jean")
    await fireEvent.changeText(email, "jean@example.com")
    await fireEvent.changeText(password, "password123")
    await fireEvent.press(screen.getByText("Créer un compte"))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Jean", "jean@example.com", "password123"),
    )
  })

  it("requires a non-empty name", async () => {
    await renderWithProviders(<RegisterForm onSubmit={jest.fn()} loading={false} error={null} />)

    await fireEvent.changeText(inputs()[0], "a")
    await fireEvent.changeText(inputs()[0], "")
    await fireEvent.changeText(inputs()[1], "jean@example.com")
    await fireEvent.changeText(inputs()[2], "password123")
    await fireEvent.press(screen.getByText("Créer un compte"))

    await waitFor(() => expect(screen.getByText("Nom requis")).toBeTruthy())
  })

  it("rejects a password shorter than 8 characters", async () => {
    const onSubmit = jest.fn()
    await renderWithProviders(<RegisterForm onSubmit={onSubmit} loading={false} error={null} />)

    await fireEvent.changeText(inputs()[0], "Jean")
    await fireEvent.changeText(inputs()[1], "jean@example.com")
    await fireEvent.changeText(inputs()[2], "court")
    await fireEvent.press(screen.getByText("Créer un compte"))

    await waitFor(() => expect(screen.getByText("8 caractères minimum")).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("rejects an invalid email", async () => {
    await renderWithProviders(<RegisterForm onSubmit={jest.fn()} loading={false} error={null} />)

    await fireEvent.changeText(inputs()[0], "Jean")
    await fireEvent.changeText(inputs()[1], "nope")
    await fireEvent.changeText(inputs()[2], "password123")
    await fireEvent.press(screen.getByText("Créer un compte"))

    await waitFor(() => expect(screen.getByText("Email invalide")).toBeTruthy())
  })

  it("shows the server error", async () => {
    await renderWithProviders(
      <RegisterForm
        onSubmit={jest.fn()}
        loading={false}
        error="Un compte existe déjà avec cet email."
      />,
    )
    expect(screen.getByText("Un compte existe déjà avec cet email.")).toBeTruthy()
  })

  it("hides the label while loading", async () => {
    await renderWithProviders(<RegisterForm onSubmit={jest.fn()} loading error={null} />)
    expect(screen.queryByText("Créer un compte")).toBeNull()
  })
})

describe("OAuthButtons", () => {
  it("reports the chosen provider", async () => {
    const onPress = jest.fn().mockResolvedValue(undefined)
    await renderWithProviders(<OAuthButtons onPress={onPress} loading={false} />)

    await fireEvent.press(screen.getByText("Continuer avec GitHub"))
    expect(onPress).toHaveBeenCalledWith("github")

    await fireEvent.press(screen.getByText("Continuer avec Google"))
    expect(onPress).toHaveBeenCalledWith("google")
  })

  it("hides both labels while loading", async () => {
    await renderWithProviders(<OAuthButtons onPress={jest.fn()} loading />)

    expect(screen.queryByText("Continuer avec GitHub")).toBeNull()
    expect(screen.queryByText("Continuer avec Google")).toBeNull()
  })

  it("renders only the providers it is told to", async () => {
    await renderWithProviders(
      <OAuthButtons
        onPress={jest.fn()}
        loading={false}
        providers={{ github: false, google: true }}
      />,
    )

    expect(screen.queryByText("Continuer avec GitHub")).toBeNull()
    expect(screen.getByText("Continuer avec Google")).toBeTruthy()
  })

  it("renders nothing when no provider is offered", async () => {
    const { toJSON } = await renderWithProviders(
      <OAuthButtons
        onPress={jest.fn()}
        loading={false}
        providers={{ github: false, google: false }}
      />,
    )

    expect(toJSON()).toBeNull()
  })
})
