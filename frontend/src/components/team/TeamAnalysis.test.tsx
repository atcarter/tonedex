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

// Against electric: gyarados 4×, lapras 2×, dragapult ½×, zekrom ¼×, garchomp 0×
const TEAM = [
  mon("gyarados", ["water", "flying"]),
  mon("lapras", ["water", "ice"]),
  mon("snorlax", ["normal"]),
  mon("dragapult", ["dragon", "ghost"]),
  mon("zekrom", ["dragon", "electric"]),
  mon("garchomp", ["dragon", "ground"]),
];

// Alt texts of the sprites after one type's badge in a group
function sprites(group: string, type: string) {
  const entry = within(screen.getByRole("list", { name: group }))
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(type));
  return entry
    ? within(entry)
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt"))
    : [];
}

describe("TeamAnalysis defensive overview", () => {
  it("lists affected members per group, marking only 4× and ¼×", () => {
    renderAnalysis(TEAM);

    expect(sprites("Weak (2× or 4×)", "electric")).toEqual([
      "Gyarados (4×)",
      "Lapras",
    ]);
    expect(sprites("Resists (½× or ¼×)", "electric")).toEqual([
      "Dragapult",
      "Zekrom (¼×)",
    ]);
    expect(sprites("Immune (0×)", "electric")).toEqual(["Garchomp"]);
    // A type can appear in more than one row; 1× members are left out
    expect(sprites("Weak (2× or 4×)", "electric")).not.toContain("Snorlax");
  });

  it("says None for an empty group and explains what is not shown", () => {
    renderAnalysis([mon("blastoise", ["water"])]);

    const immune = screen
      .getAllByTestId("defense-row")
      .find((el) => within(el).queryByText("Immune (0×)"))!;
    expect(within(immune).getByText("None")).toBeTruthy();
    expect(
      screen.getByText("Types and Pokémon not shown take normal 1× damage."),
    ).toBeTruthy();
    expect(screen.queryByText(/net weakness/i)).toBeNull();
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
