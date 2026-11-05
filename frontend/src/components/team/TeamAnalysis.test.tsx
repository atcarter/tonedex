import { render, screen } from "@testing-library/react";
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

describe("TeamAnalysis offensive coverage", () => {
  it("lists the types the team has no strong attack against", () => {
    renderAnalysis([mon("blastoise", ["water"])]);

    expect(screen.getByText("Offensive Coverage")).toBeTruthy();
    expect(screen.getByText("No strong attack against:")).toBeTruthy();
    // once in the defense grid, once in the uncovered list
    expect(screen.getAllByText("dragon")).toHaveLength(2);
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
