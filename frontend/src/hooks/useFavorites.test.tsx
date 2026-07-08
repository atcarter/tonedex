import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useFavorites } from "./useFavorites";
import { getFavorites } from "../services/api";
import type { Pokemon } from "../types";

// Mock the API module — we control return values per test below
vi.mock("../services/api", () => ({
  getFavorites: vi.fn(),
}));

// Mock useAppContext so we can control the token without a full React tree
vi.mock("./useAppContext", () => ({
  useAppContext: vi.fn(),
}));

// Import the mocked versions so TypeScript knows they are vi.Mock
const mockGetFavorites = vi.mocked(getFavorites);

// Re-import useAppContext after vi.mock so we get the mocked module
const { useAppContext } = await import("./useAppContext");
const mockUseAppContext = vi.mocked(useAppContext);

// Each test gets a fresh QueryClient to avoid cached state leaking between tests
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const FAKE_FAVORITES: Pokemon[] = [
  {
    id: 1,
    name: "bulbasaur",
    types: ["grass", "poison"],
    sprite_url: "",
    favorite_id: 10,
  },
  {
    id: 4,
    name: "charmander",
    types: ["fire"],
    sprite_url: "",
    favorite_id: 11,
  },
];

describe("useFavorites", () => {
  it("returns fetched favorites when a token is present", async () => {
    mockUseAppContext.mockReturnValue({ token: "test-jwt" } as ReturnType<
      typeof useAppContext
    >);
    mockGetFavorites.mockResolvedValue(FAKE_FAVORITES);

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(FAKE_FAVORITES);
    expect(mockGetFavorites).toHaveBeenCalledWith("test-jwt");
  });

  it("does not call the API when token is null", () => {
    mockUseAppContext.mockReturnValue({ token: null } as ReturnType<
      typeof useAppContext
    >);

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    // query is disabled — status stays 'pending', API never called
    expect(result.current.isPending).toBe(true);
    expect(mockGetFavorites).not.toHaveBeenCalled();
  });

  it("surfaces errors from the API", async () => {
    mockUseAppContext.mockReturnValue({ token: "test-jwt" } as ReturnType<
      typeof useAppContext
    >);
    mockGetFavorites.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
