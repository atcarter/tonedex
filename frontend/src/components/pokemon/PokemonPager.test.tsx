import { render, screen, fireEvent } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { PokemonPager } from "./PokemonPager";
import { buildTheme } from "../../theme";
import type { NeighborSource } from "../../hooks/useNeighbors";

vi.mock("../PokemonDetail", () => ({ PokemonDetail: () => null }));
vi.mock("../../hooks/useNeighbors", () => ({ useNeighbors: vi.fn() }));

const { useNeighbors } = await import("../../hooks/useNeighbors");
const mockUseNeighbors = vi.mocked(useNeighbors);

const theme = buildTheme("light");
const GAME = { id: 1, name: "scarlet", generation: 9, region: "paldea" };

const SOURCE: NeighborSource = {
  neighbors: {
    previous: { name: "sprigatito", pokedex_number: 1 },
    next: { name: "meowscarada", pokedex_number: 3 },
  },
  loading: false,
  pathFor: (name) => `/game/scarlet/pokemon/${name}`,
};

function Probe() {
  const { pathname } = useLocation();
  return (
    <output data-testid="at">{`${useNavigationType()} ${pathname}`}</output>
  );
}

function renderPager(source: NeighborSource = SOURCE) {
  mockUseNeighbors.mockReturnValue(source);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <MemoryRouter initialEntries={["/game/scarlet/pokemon/floragato"]}>
            <Routes>
              <Route
                path="/game/:gameId/pokemon/:pokemonName"
                element={
                  <>
                    <PokemonPager pokemonName="floragato" game={GAME} />
                    <input aria-label="search" />
                    <Probe />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </SCThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const at = () => screen.getByTestId("at").textContent;

describe("PokemonPager", () => {
  it("moves with the arrow keys, replacing the history entry", () => {
    renderPager();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(at()).toBe("REPLACE /game/scarlet/pokemon/meowscarada");
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["auto-repeat", { repeat: true }],
  ])("ignores an arrow key with %s", (_, modifiers) => {
    renderPager();

    fireEvent.keyDown(window, { key: "ArrowLeft", ...modifiers });
    expect(at()).toBe("POP /game/scarlet/pokemon/floragato");
  });

  it("ignores arrow keys typed into a field", () => {
    renderPager();

    fireEvent.keyDown(screen.getByLabelText("search"), { key: "ArrowLeft" });
    expect(at()).toBe("POP /game/scarlet/pokemon/floragato");
  });

  it("shows no controls when there is nothing to move through", () => {
    renderPager({ ...SOURCE, neighbors: null });

    expect(
      screen.queryByRole("navigation", { name: "Previous and next Pokémon" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the controls while the neighbors load", () => {
    renderPager({ ...SOURCE, neighbors: null, loading: true });

    expect(
      screen.getByRole("navigation", { name: "Previous and next Pokémon" }),
    ).toBeInTheDocument();
  });
});
