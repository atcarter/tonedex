import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCaughtPokemons } from "./useCaughtPokemons";
import { getCaughtPokemons } from "../services/api";
import type { CaughtEntry } from "../types";

vi.mock("../services/api", () => ({
  getCaughtPokemons: vi.fn(),
}));

vi.mock("./useAppContext", () => ({
  useAppContext: vi.fn(),
}));

const mockGetCaughtPokemons = vi.mocked(getCaughtPokemons);

const { useAppContext } = await import("./useAppContext");
const mockUseAppContext = vi.mocked(useAppContext);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const CAUGHT: CaughtEntry[] = [
  { id: 1, pokemon_id: 1, game_id: 5 },
  { id: 2, pokemon_id: 4, game_id: 5 },
];

describe("useCaughtPokemons", () => {
  it("fetches caught entries for a given game when signed in", async () => {
    mockUseAppContext.mockReturnValue({ token: "test-jwt" } as ReturnType<
      typeof useAppContext
    >);
    mockGetCaughtPokemons.mockResolvedValue(CAUGHT);

    const { result } = renderHook(() => useCaughtPokemons(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(CAUGHT);
    expect(mockGetCaughtPokemons).toHaveBeenCalledWith(5, "test-jwt");
  });

  it("does not call the API when token is null", () => {
    mockUseAppContext.mockReturnValue({ token: null } as ReturnType<
      typeof useAppContext
    >);

    const { result } = renderHook(() => useCaughtPokemons(5), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockGetCaughtPokemons).not.toHaveBeenCalled();
  });

  it("does not call the API when gameId is 0", () => {
    mockUseAppContext.mockReturnValue({ token: "test-jwt" } as ReturnType<
      typeof useAppContext
    >);

    const { result } = renderHook(() => useCaughtPokemons(0), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockGetCaughtPokemons).not.toHaveBeenCalled();
  });

  it("uses gameId in the query key so each game is cached independently", async () => {
    mockUseAppContext.mockReturnValue({ token: "test-jwt" } as ReturnType<
      typeof useAppContext
    >);
    mockGetCaughtPokemons.mockResolvedValue(CAUGHT);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result: r5 } = renderHook(() => useCaughtPokemons(5), { wrapper });
    const { result: r6 } = renderHook(() => useCaughtPokemons(6), { wrapper });

    await waitFor(() => expect(r5.current.isSuccess).toBe(true));

    // game 5 was queried; game 6 also fires a separate query
    expect(mockGetCaughtPokemons).toHaveBeenCalledWith(5, "test-jwt");
    expect(mockGetCaughtPokemons).toHaveBeenCalledWith(6, "test-jwt");
    // both hooks share the same QueryClient but store results under different keys
    expect(qc.getQueryData(["caught", 5])).toEqual(CAUGHT);

    // suppress unused variable warning
    void r6;
  });
});
