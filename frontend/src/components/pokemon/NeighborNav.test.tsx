import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { NeighborNav } from "./NeighborNav";
import { buildTheme } from "../../theme";

const theme = buildTheme("light");

function renderNav(props: ComponentProps<typeof NeighborNav>) {
  return render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <NeighborNav {...props} />
      </SCThemeProvider>
    </ThemeProvider>,
  );
}

describe("NeighborNav", () => {
  it("names each neighbor with its number", () => {
    renderNav({
      neighbors: {
        previous: { name: "victini", pokedex_number: 0 },
        next: { name: "servine", pokedex_number: 2 },
      },
      onGo: vi.fn(),
    });

    const previous = screen.getByRole("button", {
      name: "Previous Pokémon: #000 Victini",
    });
    expect(previous).toHaveTextContent("#000 Victini");
    expect(previous).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
    expect(
      screen.getByRole("button", { name: "Next Pokémon: #002 Servine" }),
    ).toHaveAttribute("aria-keyshortcuts", "ArrowRight");
  });

  it("shows the name alone when a neighbor has no number", () => {
    renderNav({
      neighbors: { previous: null, next: { name: "mr-mime" } },
      onGo: vi.fn(),
    });

    expect(
      screen.getByRole("button", { name: "Next Pokémon: Mr Mime" }),
    ).toHaveTextContent(/^Mr Mime$/);
  });

  it("marks a missing neighbor aria-disabled, and a click on it does nothing", () => {
    const onGo = vi.fn();
    renderNav({
      neighbors: { previous: null, next: { name: "floragato" } },
      onGo,
    });

    const previous = screen.getByRole("button", {
      name: "No previous Pokémon",
    });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).not.toBeDisabled();
    fireEvent.click(previous);
    expect(onGo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Next Pokémon/ }));
    expect(onGo).toHaveBeenCalledWith("next");
  });

  it("keeps both buttons, disabled, while the neighbors load", () => {
    renderNav({ neighbors: null, onGo: vi.fn() });

    for (const name of ["Previous Pokémon", "Next Pokémon"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
});
