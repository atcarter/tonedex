import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { FavoritesPage } from "./FavoritesPage";
import { buildTheme } from "../theme";
import type { Pokemon, User } from "../types";

vi.mock("../hooks/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../hooks/useFavorites", () => ({ useFavorites: vi.fn() }));
vi.mock("../hooks/useFavoriteMutations", () => ({
  useFavoriteMutations: vi.fn(),
}));
vi.mock("../components/PokemonCard", () => ({
  PokemonCard: ({ pokemon }: { pokemon: Pokemon }) => (
    <div data-testid="card">{pokemon.name}</div>
  ),
}));
vi.mock("@react-oauth/google", () => ({ GoogleLogin: () => null }));

const { useAppContext } = await import("../hooks/useAppContext");
const { useFavorites } = await import("../hooks/useFavorites");
const { useFavoriteMutations } = await import("../hooks/useFavoriteMutations");

const mockUseAppContext = vi.mocked(useAppContext);
const mockUseFavorites = vi.mocked(useFavorites);
const mockUseFavoriteMutations = vi.mocked(useFavoriteMutations);

const theme = buildTheme("light");

const FAVORITES: Pokemon[] = [
  {
    id: 1,
    name: "bulbasaur",
    types: ["grass"],
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
  {
    id: 7,
    name: "squirtle",
    types: ["water"],
    sprite_url: "",
    favorite_id: 12,
  },
];

function setup() {
  const reorderMutate = vi.fn();
  mockUseAppContext.mockReturnValue({
    currentUser: { id: 1, email: "t@e.com", name: "T", avatar_url: "" } as User,
    signIn: vi.fn(),
  } as unknown as ReturnType<typeof useAppContext>);
  mockUseFavorites.mockReturnValue({ data: FAVORITES } as ReturnType<
    typeof useFavorites
  >);
  mockUseFavoriteMutations.mockReturnValue({
    reorder: { mutate: reorderMutate },
  } as unknown as ReturnType<typeof useFavoriteMutations>);

  render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <FavoritesPage />
      </SCThemeProvider>
    </ThemeProvider>,
  );
  return { reorderMutate };
}

const cardNames = () => screen.getAllByTestId("card").map((c) => c.textContent);

describe("FavoritesPage keyboard reorder", () => {
  it("moves a favorite later and persists the new order", () => {
    const { reorderMutate } = setup();

    fireEvent.click(
      screen.getByRole("button", { name: "move bulbasaur later" }),
    );

    expect(cardNames()).toEqual(["charmander", "bulbasaur", "squirtle"]);
    expect(reorderMutate).toHaveBeenCalledTimes(1);
    expect(
      (reorderMutate.mock.calls[0][0] as Pokemon[]).map((p) => p.name),
    ).toEqual(["charmander", "bulbasaur", "squirtle"]);
  });

  it("moves a favorite earlier and announces the change", () => {
    setup();

    fireEvent.click(
      screen.getByRole("button", { name: "move squirtle earlier" }),
    );

    expect(cardNames()).toEqual(["bulbasaur", "squirtle", "charmander"]);
    expect(
      screen.getByText("Squirtle moved to position 2 of 3"),
    ).toBeInTheDocument();
  });

  it("disables the boundary buttons", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "move bulbasaur earlier" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "move squirtle later" }),
    ).toBeDisabled();
  });
});
