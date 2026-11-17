import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { EvolutionChain } from "./EvolutionChain";
import { buildTheme } from "../../theme";
import type { EvolutionStep } from "../../types";

const theme = buildTheme("light");

const step = (
  name: string,
  pokemon_name: string,
  evolves_from: string | null = null,
): EvolutionStep => ({
  name,
  pokemon_name,
  evolves_from,
  evolution_details: [],
  sprite_url: null,
});

// Species whose default variety carries a form suffix
const CHAINS = {
  lechonk: [
    step("lechonk", "lechonk"),
    step("oinkologne", "oinkologne-male", "lechonk"),
  ],
  burmy: [step("burmy", "burmy"), step("wormadam", "wormadam-plant", "burmy")],
  rockruff: [
    step("rockruff", "rockruff"),
    step("lycanroc", "lycanroc-midday", "rockruff"),
  ],
};

function renderChain(chain: EvolutionStep[], currentName: string) {
  const onSelect = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <EvolutionChain
          chain={chain}
          currentName={currentName}
          onSelect={onSelect}
        />
      </SCThemeProvider>
    </ThemeProvider>,
  );
  return onSelect;
}

describe("EvolutionChain", () => {
  for (const [base, chain] of Object.entries(CHAINS)) {
    const evolved = chain[1];

    it(`links ${evolved.name} by its default variety, ${evolved.pokemon_name}`, () => {
      const onSelect = renderChain(chain, base);

      fireEvent.click(screen.getByText(new RegExp(`^${evolved.name}$`, "i")));

      expect(onSelect).toHaveBeenCalledWith(evolved.pokemon_name);
    });

    it(`marks ${evolved.name} current on ${evolved.pokemon_name}'s page`, () => {
      renderChain(chain, evolved.pokemon_name);

      // The current stage's name is bold
      const weights = screen
        .getAllByTestId("evolution-stage")
        .map(
          (stage) => getComputedStyle(stage.querySelector("span")!).fontWeight,
        );
      expect(weights).toEqual(["500", "700"]);
    });
  }
});
