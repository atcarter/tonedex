import { render, screen, within } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { TypeMatchups } from "./TypeMatchups";
import { buildTheme } from "../../theme";
import type { AbilityInfo } from "../../types";

const theme = buildTheme("light");

const ability = (name: string, hidden = false): AbilityInfo => ({
  name,
  hidden,
  description: null,
  short_effect: null,
});

function renderMatchups(props: ComponentProps<typeof TypeMatchups>) {
  return render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <TypeMatchups {...props} />
      </SCThemeProvider>
    </ThemeProvider>,
  );
}

const listed = (name: string) =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

const GENGAR = ["ghost", "poison"];

describe("TypeMatchups", () => {
  it("drops Gengar's Ground weakness in a Gen 4 game (Levitate)", () => {
    renderMatchups({
      types: GENGAR,
      abilities: [ability("levitate")],
      generation: 4,
    });

    expect(listed("2 times damage from")).toEqual(["psychic", "ghost", "dark"]);
    // Its only ability, so no tag
    expect(listed("Immune to")).toEqual(["normal", "fighting", "ground"]);
    expect(
      screen.getByText("Types not listed do normal 1× damage."),
    ).toBeInTheDocument();
  });

  it("lists Ground again in a Gen 8 game (Cursed Body)", () => {
    renderMatchups({
      types: GENGAR,
      abilities: [ability("cursed-body")],
      generation: 8,
    });

    expect(listed("2 times damage from")).toEqual([
      "ground",
      "psychic",
      "ghost",
      "dark",
    ]);
    expect(listed("Immune to")).toEqual(["normal", "fighting"]);
  });

  it("notes when abilities couldn't be loaded and keeps Ground", () => {
    renderMatchups({ types: GENGAR, abilities: null, generation: 4 });

    expect(listed("2 times damage from")).toContain("ground");
    expect(
      screen.getByText("Ability data unavailable, so matchups use types only."),
    ).toBeInTheDocument();
  });

  it.each([
    ["an empty list", []],
    ["missing", null],
  ])(
    "has no unavailable note in a Gen 2 game with abilities %s",
    (_label, abilities) => {
      renderMatchups({ types: GENGAR, abilities, generation: 2 });

      expect(listed("2 times damage from")).toContain("ground");
      expect(screen.queryByText(/Ability data unavailable/)).toBeNull();
    },
  );

  it("tags Bronzong's Ground immunity with Levitate", () => {
    renderMatchups({
      types: ["steel", "psychic"],
      abilities: [
        ability("levitate"),
        ability("heatproof"),
        ability("heavy-metal", true),
      ],
      generation: 9,
    });

    expect(listed("Immune to")).toEqual(["poison", "ground with Levitate"]);
    expect(listed("2 times damage from")).toEqual(["fire", "ghost", "dark"]);
  });

  it("follows the game's generation (Bronzong in Diamond)", () => {
    renderMatchups({
      types: ["steel", "psychic"],
      abilities: [],
      generation: 4,
    });

    expect(listed("2 times damage from")).toEqual(["fire", "ground"]);
  });

  it("shows a tagged 1× row and other multipliers from abilities", () => {
    renderMatchups({
      types: ["ice", "ground"],
      abilities: [ability("oblivious"), ability("thick-fat", true)],
      generation: 9,
    });
    expect(listed("Normal damage from")).toEqual(["fire with Thick Fat"]);
  });

  it("labels a non-standard multiplier for screen readers (Dry Skin)", () => {
    renderMatchups({
      types: ["poison", "fighting"],
      abilities: [ability("anticipation"), ability("dry-skin")],
      generation: 9,
    });
    expect(listed("1.25 times damage from")).toEqual(["fire with Dry Skin"]);
    expect(screen.getByText("1.25×")).toHaveAttribute("aria-hidden", "true");
  });
});
