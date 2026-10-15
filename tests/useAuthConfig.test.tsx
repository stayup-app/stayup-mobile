import { renderHook, waitFor } from "@testing-library/react-native"
import { useAuthConfig } from "@/hooks/useAuthConfig"
import { fetchAuthConfig } from "@/lib/api"

jest.mock("@/lib/api", () => ({ fetchAuthConfig: jest.fn() }))

const mockedFetch = fetchAuthConfig as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockedFetch.mockResolvedValue({
    emailPassword: true,
    oauth: { github: true, google: false },
  })
})

describe("useAuthConfig", () => {
  it("reads the API config on mount", async () => {
    const { result } = renderHook(() => useAuthConfig())

    await waitFor(() => expect(result.current.config).not.toBeNull())
    expect(result.current.config?.oauth).toEqual({ github: true, google: false })
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it("leaves config null when the API has no /auth/config", async () => {
    mockedFetch.mockResolvedValue(null)
    const { result } = renderHook(() => useAuthConfig())

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(result.current.config).toBeNull()
  })
})
