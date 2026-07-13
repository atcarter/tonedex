import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { GamePage } from "./GamePage";
import { buildTheme } from "../theme";
import type { GameResponse, Pokemon } from "../types";

vi.mock("../hooks/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../hooks/useGames", () => ({ useGames: vi.fn() }));
vi.mock("../hooks/useGame", () => ({ useGame: vi.fn() }));
vi.mock("../hooks/useCaughtPokemons", () => ({ useCaughtPokemons: vi.fn() }));
// Stub the card — its own behaviour is covered in PokemonCard.test.tsx
vi.mock("../components/PokemonCard", () => ({
  PokemonCard: ({ pokemon }: { pokemon: Pokemon }) => (
    <div data-testid="card">{pokemon.name}</div>
  ),
}));

const { useAppContext } = await import("../hooks/useAppContext");
const { useGames } = await import("../hooks/useGames");
const { useGame } = await import("../hooks/useGame");
const { useCaughtPokemons } = await import("../hooks/useCaughtPokemons");

const mockUseAppContext = vi.mocked(useAppContext);
const mockUseGames = vi.mocked(useGames);
const mockUseGame = vi.mocked(useGame);
const mockUseCaughtPokemons = vi.mocked(useCaughtPokemons);

const theme = buildTheme("light");

const POKEMONS: Pokemon[] = [
  {
    id: 1,
    name: "sprigatito",
    types: ["grass"],
    sprite_url: "",
    pokedex_number: 1,
  },
  {
    id: 2,
    name: "fuecoco",
    types: ["fire"],
    sprite_url: "",
    pokedex_number: 4,
  },
  {
    id: 3,
    name: "quaquaval",
    types: ["water", "fighting"],
    sprite_url: "",
    pokedex_number: 9,
  },
];

function gamePage(pokemons: Pokemon[], overrides = {}): GameResponse {
  return {
    game: { id: 1, name: "scarlet", generation: 9, region: "paldea" },
    pokemons,
    available_types: ["grass", "fire", "water", "fighting", "electric"],
    pagination: {
      total: 400,
      limit: 40,
      offset: 0,
      has_more: false,
      seeding: false,
    },
    ...overrides,
  };
}

function setup({ pages = [gamePage(POKEMONS)], hasNextPage = false } = {}) {
  const fetchNextPage = vi.fn();
  mockUseAppContext.mockReturnValue({
    setSelectedGame: vi.fn(),
    currentUser: null,
  } as unknown as ReturnType<typeof useAppContext>);
  mockUseGames.mockReturnValue({ data: [] } as unknown as ReturnType<
    typeof useGames
  >);
  mockUseCaughtPokemons.mockReturnValue({ data: [] } as unknown as ReturnType<
    typeof useCaughtPokemons
  >);
  mockUseGame.mockReturnValue({
    data: { pages, pageParams: [0] },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: false,
  } as unknown as ReturnType<typeof useGame>);

  render(
    <MemoryRouter initialEntries={["/game/1"]}>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <Routes>
            <Route path="/game/:gameId" element={<GamePage />} />
          </Routes>
        </SCThemeProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { fetchNextPage };
}

const cardNames = () => screen.getAllByTestId("card").map((c) => c.textContent);

describe("GamePage filtering", () => {
  it("renders all loaded pokemon with no filter", () => {
    setup();
    expect(cardNames()).toEqual(["sprigatito", "fuecoco", "quaquaval"]);
  });

  it("applies type filters with AND logic", () => {
    setup();
    fireEvent.click(screen.getByText("water"));
    expect(cardNames()).toEqual(["quaquaval"]);

    fireEvent.click(screen.getByText("fighting"));
    expect(cardNames()).toEqual(["quaquaval"]);

    // fire AND water matches nothing
    fireEvent.click(screen.getByText("fighting")); // deselect
    fireEvent.click(screen.getByText("fire"));
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
  });

  it("caps type selection at two", () => {
    setup();
    fireEvent.click(screen.getByText("water"));
    fireEvent.click(screen.getByText("fighting"));
    // Third selection is ignored → quaquaval (water+fighting) still matches
    fireEvent.click(screen.getByText("electric"));
    expect(cardNames()).toEqual(["quaquaval"]);
  });

  it("auto-fetches remaining pages while a type filter is active", async () => {
    const { fetchNextPage } = setup({ hasNextPage: true });
    expect(fetchNextPage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("water"));

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
    expect(screen.getByText(/searching entire dex/i)).toBeInTheDocument();
  });
});
