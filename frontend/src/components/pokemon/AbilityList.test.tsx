import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { AbilityList } from "./AbilityList";
import { buildTheme } from "../../theme";
import type { AbilityInfo } from "../../types";

const theme = buildTheme("light");

const STATIC: AbilityInfo = {
  name: "static",
  hidden: false,
  description: "Contact with the Pokémon may cause paralysis.",
  short_effect: "Has a 30% chance of paralyzing attacking Pokémon on contact.",
};

const LIGHTNING_ROD: AbilityInfo = {
  name: "lightning-rod",
  hidden: true,
  description: "Draws in all Electric-type moves.",
  short_effect: "Draws in all Electric-type moves.",
};

function renderList(props: ComponentProps<typeof AbilityList>) {
  return render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <AbilityList {...props} />
      </SCThemeProvider>
    </ThemeProvider>,
  );
}

describe("AbilityList", () => {
  it("expands one ability at a time and collapses on a second tap", () => {
    renderList({ abilities: [STATIC, LIGHTNING_ROD], generation: 9 });
    const staticChip = screen.getByRole("button", { name: "Static" });
    const rodChip = screen.getByRole("button", { name: "Lightning Rod" });

    expect(staticChip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    fireEvent.click(staticChip);
    expect(staticChip).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "Static ability" });
    expect(staticChip).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent(STATIC.description!);

    fireEvent.click(rodChip);
    expect(staticChip).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("region", { name: "Lightning Rod ability" }),
    ).toBeInTheDocument();

    fireEvent.click(rodChip);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("adds an In battle line only when the short effect differs", () => {
    renderList({ abilities: [STATIC, LIGHTNING_ROD], generation: 9 });

    fireEvent.click(screen.getByRole("button", { name: "Static" }));
    expect(
      screen.getByText(`In battle: ${STATIC.short_effect}`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lightning Rod" }));
    expect(screen.queryByText(/In battle:/)).not.toBeInTheDocument();
  });

  it("labels a hidden ability inside the panel", () => {
    renderList({ abilities: [STATIC, LIGHTNING_ROD], generation: 9 });

    fireEvent.click(screen.getByRole("button", { name: "Static" }));
    expect(screen.queryByText("Hidden ability")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lightning Rod" }));
    expect(screen.getByText("Hidden ability")).toBeInTheDocument();
  });

  it("says so when the description is not cached yet", () => {
    renderList({
      abilities: [{ ...STATIC, description: null, short_effect: null }],
      generation: 9,
    });

    fireEvent.click(screen.getByRole("button", { name: "Static" }));
    expect(
      screen.getByText("No description available yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/In battle:/)).not.toBeInTheDocument();
  });

  it("notes that abilities arrived in Gen 3 for Gen 1–2 games", () => {
    renderList({ abilities: [], generation: 2 });
    expect(screen.getByText("Abilities arrived in Gen 3.")).toBeInTheDocument();
  });

  it("renders nothing without abilities in a later game or outside one", () => {
    const { container, rerender } = renderList({
      abilities: [],
      generation: 9,
    });
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <AbilityList abilities={[]} generation={null} />
        </SCThemeProvider>
      </ThemeProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
