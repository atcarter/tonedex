import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { TeamBuilderPage } from "./TeamBuilderPage";
import { buildTheme } from "../theme";
import type { Pokemon } from "../types";

vi.mock("../hooks/useGames", () => ({ useGames: vi.fn() }));
vi.mock("../hooks/useGame", () => ({ useGame: vi.fn() }));
// Its own behaviour is covered elsewhere; stubbed to keep the picker in focus
vi.mock("../components/team/TeamAnalysis", () => ({
  TeamAnalysis: () => <div data-testid="analysis" />,
}));

const { useGames } = await import("../hooks/useGames");
const { useGame } = await import("../hooks/useGame");

const theme = buildTheme("light");

const POKEMONS: Pokemon[] = [
  "sprigatito",
  "fuecoco",
  "quaxly",
  "pawmi",
  "lechonk",
  "tarountula",
  "nymble",
].map((name, i) => ({
  id: 100_001 + i,
  name,
  types: ["normal"],
  sprite_url: "",
  pokedex_number: i + 1,
}));

function setup(
  initialTeam: Pokemon[] = [],
  {
    route = "/game/scarlet/team",
    gamesQuery = {
      data: [{ id: 1, name: "scarlet", generation: 9, region: "paldea" }],
    } as object,
  } = {},
) {
  localStorage.setItem("pokedex_team_1", JSON.stringify(initialTeam));
  vi.mocked(useGames).mockReturnValue(
    gamesQuery as unknown as ReturnType<typeof useGames>,
  );
  vi.mocked(useGame).mockReturnValue({
    data: { pages: [{ pokemons: POKEMONS }] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  } as unknown as ReturnType<typeof useGame>);

  render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/game/:gameId/team" element={<TeamBuilderPage />} />
            <Route
              path="/game/:gameId/pokemon/:pokemonName"
              element={<p>detail page</p>}
            />
          </Routes>
        </MemoryRouter>
      </SCThemeProvider>
    </ThemeProvider>,
  );
}

const toggle = () => screen.getByRole("button", { name: /picker/ });
const addByName = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name, "i") }));

afterEach(() => localStorage.clear());

describe("TeamBuilderPage picker", () => {
  it("collapses automatically when the sixth member is added", async () => {
    setup(POKEMONS.slice(0, 5));
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    addByName("tarountula");

    expect(screen.getAllByTestId("team-slot")).toHaveLength(6);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("Show picker");
    await waitFor(() =>
      expect(screen.getByLabelText("Add a Pokémon")).not.toBeVisible(),
    );
    // Focus lands on the toggle, not <body>
    expect(toggle()).toHaveFocus();
    expect(screen.getByTestId("analysis")).toBeInTheDocument();
  });

  it("starts collapsed for a team that is already full", () => {
    setup(POKEMONS.slice(0, 6));
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the picker by hand with a partial or full team", () => {
    setup(POKEMONS.slice(0, 2));
    const button = toggle();
    expect(button).toHaveAttribute(
      "aria-controls",
      screen.getByLabelText("Add a Pokémon").closest(".MuiCollapse-root")!.id,
    );

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    addByName("pawmi");
    addByName("lechonk");
    addByName("tarountula");
    addByName("nymble");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("re-opens on removal after an automatic collapse", () => {
    setup(POKEMONS.slice(0, 5));
    addByName("tarountula");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "remove fuecoco" }));

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("stays collapsed on removal when the user collapsed it", () => {
    setup(POKEMONS.slice(0, 6));
    fireEvent.click(toggle()); // show
    fireEvent.click(toggle()); // hide by hand

    fireEvent.click(screen.getByRole("button", { name: "remove fuecoco" }));

    expect(screen.getAllByTestId("team-slot")).toHaveLength(5);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("TeamBuilderPage slots", () => {
  it("opens the member's detail page for the current game", () => {
    setup(POKEMONS.slice(0, 2));

    const link = screen.getByRole("link", { name: /Sprigatito/ });
    expect(link).toHaveAttribute("href", "/game/scarlet/pokemon/sprigatito");

    fireEvent.click(link);
    expect(screen.getByText("detail page")).toBeInTheDocument();
  });

  it("removes a member without navigating", () => {
    setup(POKEMONS.slice(0, 2));

    fireEvent.click(screen.getByRole("button", { name: "remove sprigatito" }));

    expect(screen.queryByText("detail page")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("team-slot")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /Sprigatito/ }),
    ).not.toBeInTheDocument();
  });
});

describe("TeamBuilderPage game lookup", () => {
  it("reports an unknown game name", () => {
    setup([], { route: "/game/not-a-game/team" });
    expect(screen.getByText("Game not found")).toBeInTheDocument();
    expect(screen.queryByText("Team Builder")).not.toBeInTheDocument();
  });

  it("reports a failed games list for a name URL", () => {
    setup([], {
      gamesQuery: { isPending: false, error: new Error("Network down") },
    });
    expect(screen.getByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("Team Builder")).not.toBeInTheDocument();
  });
});
