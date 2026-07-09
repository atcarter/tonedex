import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import { PokemonCard } from "./PokemonCard";
import { buildTheme } from "../theme";
import type { CaughtEntry, Pokemon, User } from "../types";

vi.mock("../hooks/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../hooks/useFavorites", () => ({ useFavorites: vi.fn() }));
vi.mock("../hooks/useFavoriteMutations", () => ({
  useFavoriteMutations: vi.fn(),
}));
vi.mock("../hooks/useCaughtPokemons", () => ({ useCaughtPokemons: vi.fn() }));
vi.mock("../hooks/useCaughtMutations", () => ({
  useCaughtMutations: vi.fn(),
}));

const { useAppContext } = await import("../hooks/useAppContext");
const { useFavorites } = await import("../hooks/useFavorites");
const { useFavoriteMutations } = await import("../hooks/useFavoriteMutations");
const { useCaughtPokemons } = await import("../hooks/useCaughtPokemons");
const { useCaughtMutations } = await import("../hooks/useCaughtMutations");

const mockUseAppContext = vi.mocked(useAppContext);
const mockUseFavorites = vi.mocked(useFavorites);
const mockUseFavoriteMutations = vi.mocked(useFavoriteMutations);
const mockUseCaughtPokemons = vi.mocked(useCaughtPokemons);
const mockUseCaughtMutations = vi.mocked(useCaughtMutations);

const PIKACHU: Pokemon = {
  id: 25,
  name: "pikachu",
  types: ["electric"],
  sprite_url: "",
  pokedex_number: 25,
};

const USER: User = { id: 1, email: "t@e.com", name: "T", avatar_url: "" };

const theme = buildTheme("light");

function renderCard(ui: ReactNode) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>{ui}</SCThemeProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// Minimal mutation-result stand-ins — the component only calls .mutate
function fakeMutations() {
  return {
    add: { mutate: vi.fn() },
    remove: { mutate: vi.fn() },
    catch_: { mutate: vi.fn() },
    uncatch: { mutate: vi.fn() },
  };
}

function setup({
  user = USER,
  favorites = [] as Pokemon[],
  caught = [] as CaughtEntry[],
} = {}) {
  const m = fakeMutations();
  mockUseAppContext.mockReturnValue({ currentUser: user } as ReturnType<
    typeof useAppContext
  >);
  mockUseFavorites.mockReturnValue({ data: favorites } as ReturnType<
    typeof useFavorites
  >);
  mockUseCaughtPokemons.mockReturnValue({ data: caught } as ReturnType<
    typeof useCaughtPokemons
  >);
  mockUseFavoriteMutations.mockReturnValue({
    add: m.add,
    remove: m.remove,
  } as unknown as ReturnType<typeof useFavoriteMutations>);
  mockUseCaughtMutations.mockReturnValue({
    catch_: m.catch_,
    uncatch: m.uncatch,
  } as unknown as ReturnType<typeof useCaughtMutations>);
  return m;
}

// Buttons are icon-only: caught toggle is the first, favorite the second
function getButtons() {
  const buttons = screen.getAllByRole("button");
  return { caughtBtn: buttons[0], favoriteBtn: buttons[1] };
}

describe("PokemonCard", () => {
  it("marks as caught when not yet caught", () => {
    const m = setup();
    renderCard(<PokemonCard pokemon={PIKACHU} gameId={1} />);

    fireEvent.click(getButtons().caughtBtn);

    expect(m.catch_.mutate).toHaveBeenCalledWith(25);
    expect(m.uncatch.mutate).not.toHaveBeenCalled();
  });

  it("uncatches with the entry id when already caught", () => {
    const m = setup({ caught: [{ id: 77, pokemon_id: 25, game_id: 1 }] });
    renderCard(<PokemonCard pokemon={PIKACHU} gameId={1} />);

    fireEvent.click(getButtons().caughtBtn);

    expect(m.uncatch.mutate).toHaveBeenCalledWith(77);
    expect(m.catch_.mutate).not.toHaveBeenCalled();
  });

  it("ignores clicks while an optimistic catch (id: -1) is in flight", () => {
    const m = setup({ caught: [{ id: -1, pokemon_id: 25, game_id: 1 }] });
    renderCard(<PokemonCard pokemon={PIKACHU} gameId={1} />);

    fireEvent.click(getButtons().caughtBtn);

    // uncatch(-1) would 404 server-side; catch_ would duplicate
    expect(m.uncatch.mutate).not.toHaveBeenCalled();
    expect(m.catch_.mutate).not.toHaveBeenCalled();
  });

  it("adds a favorite when not favorited, removes by favorite_id when it is", () => {
    const m = setup();
    const { unmount } = renderCard(
      <PokemonCard pokemon={PIKACHU} gameId={1} />,
    );
    fireEvent.click(getButtons().favoriteBtn);
    expect(m.add.mutate).toHaveBeenCalledWith(PIKACHU);
    unmount();

    const fav = { ...PIKACHU, favorite_id: 9 };
    const m2 = setup({ favorites: [fav] });
    renderCard(<PokemonCard pokemon={PIKACHU} gameId={1} />);
    fireEvent.click(getButtons().favoriteBtn);
    expect(m2.remove.mutate).toHaveBeenCalledWith(9);
  });

  it("disables both toggles when signed out", () => {
    setup({ user: null as unknown as User });
    renderCard(<PokemonCard pokemon={PIKACHU} gameId={1} />);

    const { caughtBtn, favoriteBtn } = getButtons();
    expect(caughtBtn).toBeDisabled();
    expect(favoriteBtn).toBeDisabled();
  });
});
