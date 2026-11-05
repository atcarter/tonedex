import { render, screen, within } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { TeamAnalysis } from "./TeamAnalysis";
import { buildTheme } from "../../theme";
import type { Pokemon } from "../../types";

const theme = buildTheme("light");

function mon(name: string, types: string[]): Pokemon {
  return { id: name.length, name, types, sprite_url: "" };
}

function renderAnalysis(team: Pokemon[]) {
  return render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <TeamAnalysis team={team} />
      </SCThemeProvider>
    </ThemeProvider>,
  );
}

// The attacking types under each tier label in one member's entry
function tiers(name: string) {
  const entry = screen
    .getAllByTestId("defense-member")
    .find((li) => within(li).queryByText(name))!;
  return Object.fromEntries(
    within(entry)
      .queryAllByRole("list")
      .map((list) => [
        list.getAttribute("aria-label"),
        within(list)
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ]),
  );
}

describe("TeamAnalysis defensive overview", () => {
  it("gives every member an entry with its sprite and name", () => {
    renderAnalysis([
      mon("bastiodon", ["rock", "steel"]),
      mon("snorlax", ["normal"]),
    ]);

    const entries = screen.getAllByTestId("defense-member");
    expect(entries.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Bastiodon"),
      expect.stringContaining("Snorlax"),
    ]);
    for (const entry of entries) {
      expect(entry.querySelector("img")).toBeTruthy();
    }
  });

  it("lists 4×, 2×, ½×, ¼× and 0× separately for a dual type", () => {
    renderAnalysis([mon("bastiodon", ["rock", "steel"])]);

    expect(tiers("Bastiodon")).toEqual({
      "4 times damage from": ["fighting", "ground"],
      "2 times damage from": ["water"],
      "Half damage from": ["ice", "psychic", "bug", "rock", "dragon", "fairy"],
      "Quarter damage from": ["normal", "flying"],
      "Immune to": ["poison"],
    });
    // Symbols are visible but hidden from screen readers
    for (const symbol of ["4×", "2×", "½×", "¼×", "0×"]) {
      expect(screen.getByText(symbol).getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("omits empty tiers and says unlisted types are neutral", () => {
    renderAnalysis([mon("blastoise", ["water"])]);

    expect(tiers("Blastoise")).toEqual({
      "2 times damage from": ["electric", "grass"],
      "Half damage from": ["fire", "water", "ice", "steel"],
    });
    expect(screen.queryByText("4×")).toBeNull();
    expect(screen.queryByText("0×")).toBeNull();
    expect(
      screen.getByText(
        /Types not listed hit that Pokémon for normal 1× damage/,
      ),
    ).toBeTruthy();
  });
});

describe("TeamAnalysis offensive coverage", () => {
  it("lists the types the team has no strong attack against", () => {
    renderAnalysis([mon("blastoise", ["water"])]);

    expect(screen.getByText("Offensive Coverage")).toBeTruthy();
    expect(screen.getByText("No strong attack against:")).toBeTruthy();
    expect(screen.getByText("dragon")).toBeTruthy();
    expect(screen.queryByText(/super-effective answer/)).toBeNull();
    expect(screen.queryByText(/STAB/)).toBeNull();
  });

  it("says so when the team covers every type", () => {
    renderAnalysis([
      mon("lucario", ["fighting", "steel"]),
      mon("garchomp", ["dragon", "ground"]),
      mon("weavile", ["dark", "ice"]),
      mon("gardevoir", ["psychic", "fairy"]),
      mon("arcanine", ["fire"]),
      mon("rillaboom", ["grass"]),
    ]);

    expect(
      screen.getByText("Your team's types hit every type super-effectively."),
    ).toBeTruthy();
    expect(screen.queryByText("No strong attack against:")).toBeNull();
  });
});
