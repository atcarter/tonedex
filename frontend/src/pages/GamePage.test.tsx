import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { GamePage } from "./GamePage";
import { buildTheme } from "../theme";
import type { GameResponse, Pokemon } from "../types";

vi.mock("../hooks/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../hooks/useGames", () => ({ useGames: vi.fn() }));
vi.mock("../hooks/useGame", () => ({ useGame: vi.fn(), PAGE_SIZE: 40 }));
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

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// A regional dex numbered 1..total unless overridden
function gamePage(
  pokemons: Pokemon[],
  overrides: Partial<GameResponse> = {},
): GameResponse {
  const total = overrides.pagination?.total ?? 400;
  return {
    game: SCARLET,
    pokemons,
    available_types: ["grass", "fire", "water", "fighting", "electric"],
    pokemon_ids: range(1, total),
    dex_numbers: range(1, total),
    pagination: {
      total,
      limit: 40,
      offset: 0,
      has_more: false,
      seeding: false,
    },
    ...overrides,
  };
}

const SCARLET = { id: 1, name: "scarlet", generation: 9, region: "paldea" };

function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <>
      <div data-testid="pathname">{pathname}</div>
      <div data-testid="search">{search}</div>
    </>
  );
}

function setup({
  pages = [gamePage(POKEMONS)],
  hasNextPage = false,
  route = "/game/scarlet",
  caught = [] as { id: number; pokemon_id: number; game_id: number }[],
  gamesQuery = { data: [SCARLET] } as object,
} = {}) {
  const fetchNextPage = vi.fn();
  mockUseAppContext.mockReturnValue({
    setSelectedGame: vi.fn(),
    currentUser: { id: 1 },
  } as unknown as ReturnType<typeof useAppContext>);
  mockUseGames.mockReturnValue(
    gamesQuery as unknown as ReturnType<typeof useGames>,
  );
  mockUseCaughtPokemons.mockReturnValue({
    data: caught,
  } as unknown as ReturnType<typeof useCaughtPokemons>);
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
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <Routes>
            <Route path="/game/:gameId" element={<GamePage />} />
          </Routes>
          <LocationProbe />
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

  it("section quick-jump loads pages toward the target", async () => {
    const { fetchNextPage } = setup({ hasNextPage: true });

    fireEvent.click(screen.getByRole("button", { name: "51–100" }));

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });

  it("hides quick-jump sections while type-filtering", () => {
    setup();
    expect(screen.getByRole("button", { name: "1–50" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("water"));

    expect(
      screen.queryByRole("button", { name: "1–50" }),
    ).not.toBeInTheDocument();
  });

  it("renders the clear chip first and clears the filter with it", () => {
    setup();
    expect(screen.queryByText("clear")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("water"));

    const chips = screen.getAllByRole("button", {
      name: /^(clear|grass|fire|water|fighting|electric)$/,
    });
    expect(chips[0]).toHaveTextContent("clear");

    fireEvent.click(screen.getByText("clear"));
    expect(cardNames()).toEqual(["sprigatito", "fuecoco", "quaquaval"]);
    expect(screen.queryByText("clear")).not.toBeInTheDocument();
  });

  it("folds a short final section into the one before it", () => {
    setup({
      pages: [
        gamePage(POKEMONS, {
          pagination: {
            total: 151,
            limit: 40,
            offset: 0,
            has_more: false,
            seeding: false,
          },
        }),
      ],
    });

    const jumps = screen
      .getAllByRole("button", { name: /^\d+–\d+$/ })
      .map((b) => b.textContent);
    expect(jumps).toEqual(["1–50", "51–100", "101–151"]);
  });

  it("restores loaded depth from the ?loaded= URL param", async () => {
    // Page one is loaded (offset 0); ?loaded=80 asks for two more pages
    const { fetchNextPage } = setup({
      hasNextPage: true,
      route: "/game/scarlet?loaded=80",
    });

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });
});

describe("GamePage URL", () => {
  it("rewrites a legacy id URL to the game's name, keeping the query", async () => {
    setup({ route: "/game/1?dex=national" });
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/game/scarlet"),
    );
    expect(screen.getByTestId("search")).toHaveTextContent("?dex=national");
    expect(mockUseGame).toHaveBeenLastCalledWith(1, "national");
  });

  it("reports an unknown game name", () => {
    setup({ route: "/game/not-a-game" });
    expect(screen.getByText("Game not found")).toBeInTheDocument();
  });

  it("reports a failed games list for a name URL", () => {
    setup({
      gamesQuery: { isPending: false, error: new Error("Network down") },
    });
    expect(screen.getByText("Network down")).toBeInTheDocument();
    expect(mockUseGame).toHaveBeenLastCalledWith(0, "regional");
  });

  it("still loads an id URL's dex when the games list fails", () => {
    setup({
      route: "/game/1",
      gamesQuery: { isPending: false, error: new Error("Network down") },
    });
    expect(screen.queryByText("Network down")).not.toBeInTheDocument();
    expect(mockUseGame).toHaveBeenLastCalledWith(1, "regional");
    expect(cardNames()).toHaveLength(POKEMONS.length);
  });
});

describe("GamePage dex view", () => {
  it("defaults to the regional view", () => {
    setup();
    expect(mockUseGame).toHaveBeenLastCalledWith(1, "regional");
    expect(screen.getByRole("button", { name: "Regional" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reads ?dex=national from the URL", () => {
    setup({ route: "/game/scarlet?dex=national" });
    expect(mockUseGame).toHaveBeenLastCalledWith(1, "national");
    expect(screen.getByRole("button", { name: "National" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches views through the URL and drops the loaded depth", () => {
    setup({ route: "/game/scarlet?loaded=80" });

    fireEvent.click(screen.getByRole("button", { name: "National" }));
    expect(screen.getByTestId("search")).toHaveTextContent("?dex=national");
    expect(mockUseGame).toHaveBeenLastCalledWith(1, "national");

    fireEvent.click(screen.getByRole("button", { name: "Regional" }));
    expect(screen.getByTestId("search")).toBeEmptyDOMElement();
  });

  it("carries the view onto the team builder link", () => {
    setup({ route: "/game/scarlet?dex=national" });
    expect(screen.getByRole("link", { name: "Team builder" })).toHaveAttribute(
      "href",
      "/game/scarlet/team?dex=national",
    );
  });

  it("counts only caught Pokémon in the list being shown", () => {
    setup({
      pages: [
        gamePage(POKEMONS, {
          pokemon_ids: [1, 2, 3],
          pagination: {
            total: 3,
            limit: 40,
            offset: 0,
            has_more: false,
            seeding: false,
          },
        }),
      ],
      caught: [
        { id: 10, pokemon_id: 1, game_id: 1 },
        // National-only catch: not in this list
        { id: 11, pokemon_id: 151, game_id: 1 },
      ],
    });
    expect(screen.getByText(/1 \/ 3 caught/)).toBeInTheDocument();
  });

  it("builds quick-jump sections from the national numbers present", () => {
    const numbers = [...range(1, 60), ...range(120, 179), 900];
    setup({
      route: "/game/scarlet?dex=national",
      pages: [
        gamePage(POKEMONS, {
          dex_numbers: numbers,
          pagination: {
            total: numbers.length,
            limit: 40,
            offset: 0,
            has_more: false,
            seeding: false,
          },
        }),
      ],
    });

    const jumps = screen
      .getAllByRole("button", { name: /^\d+–\d+$/ })
      .map((b) => b.textContent);
    expect(jumps).toEqual(["1–50", "51–60", "120–150", "151–900"]);
  });

  it("explains the national seeding wait", () => {
    setup({
      route: "/game/scarlet?dex=national",
      pages: [
        gamePage([], {
          pokemon_ids: [],
          dex_numbers: [],
          pagination: {
            total: 0,
            limit: 40,
            offset: 0,
            has_more: false,
            seeding: true,
          },
        }),
      ],
    });
    expect(
      screen.getByText(/national dex is being built/i),
    ).toBeInTheDocument();
  });
});
