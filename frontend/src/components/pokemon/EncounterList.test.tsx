import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { COLLAPSED_ROWS, EncounterList } from "./EncounterList";
import { buildTheme } from "../../theme";
import type { EncounterLocation, EncountersResponse, Game } from "../../types";

const theme = buildTheme("light");

const SWORD: Game = { id: 1, name: "sword", generation: 8, region: "galar" };

const ROUTE_4: EncounterLocation = {
  area: "galar-route-4-area",
  method: "overworld",
  dlc: null,
  min_level: 14,
  max_level: 16,
  chance: 5,
  chance_varies: false,
  conditions: [],
  varies_with: [],
};

const FIELDS_OF_HONOR: EncounterLocation = {
  ...ROUTE_4,
  area: "fields-of-honor-area",
  method: "wanderer",
  dlc: "The Isle of Armor",
  min_level: 15,
  max_level: 60,
  chance: 100,
  conditions: ["weather-thunderstorm"],
  varies_with: ["story-progress-hall-of-fame"],
};

const PICHU = {
  name: "pichu",
  pokemon_name: "pichu",
  evolves_from: null,
  evolution_details: [],
};

function renderList(
  encounters: EncountersResponse | undefined,
  props: Partial<ComponentProps<typeof EncounterList>> = {},
) {
  const onSelect = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <EncounterList
          encounters={encounters}
          isError={false}
          game={SWORD}
          earlier={null}
          onSelect={onSelect}
          {...props}
        />
      </SCThemeProvider>
    </ThemeProvider>,
  );
  return { onSelect };
}

describe("EncounterList", () => {
  it("lists each area with its method, levels, chance, DLC and conditions", () => {
    renderList({ status: "found", locations: [ROUTE_4, FIELDS_OF_HONOR] });

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Route 4");
    expect(rows[0]).toHaveTextContent("Overworld");
    expect(rows[0]).toHaveTextContent("Lv. 14–16");
    expect(rows[0]).toHaveTextContent("5% chance");
    expect(rows[1]).toHaveTextContent("Fields of Honor");
    expect(rows[1]).toHaveTextContent("The Isle of Armor");
    expect(rows[1]).toHaveTextContent(
      "Thunderstorm · Varies with story progress",
    );
  });

  it("shows the first rows, then all of them on request", () => {
    const locations = Array.from({ length: COLLAPSED_ROWS + 2 }, (_, i) => ({
      ...ROUTE_4,
      area: `galar-route-${i}-area`,
    }));
    renderList({ status: "found", locations });

    expect(screen.getAllByRole("listitem")).toHaveLength(COLLAPSED_ROWS);
    const toggle = screen.getByRole("button", {
      name: `Show all ${locations.length} locations`,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(locations.length);
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("says the game has no location data rather than that it can't be caught", () => {
    renderList({ status: "unavailable", locations: [] });

    expect(
      screen.getByText("Location data isn't available for Sword."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not found in the wild/i),
    ).not.toBeInTheDocument();
  });

  it("points to the earlier stage when it isn't found in the wild", () => {
    const { onSelect } = renderList(
      { status: "none", locations: [] },
      { earlier: PICHU },
    );

    expect(
      screen.getByText(/Not found in the wild in Sword\./),
    ).toHaveTextContent(
      "Not found in the wild in Sword. Evolve it from Pichu.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pichu" }));
    expect(onSelect).toHaveBeenCalledWith("pichu");
  });

  it("just says it isn't found in the wild without an earlier stage", () => {
    renderList({ status: "none", locations: [] });

    expect(
      screen.getByText("Not found in the wild in Sword."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a checking state while the data is cached", () => {
    renderList({ status: "pending", locations: [] });

    expect(screen.getByText("Checking where to find it…")).toBeInTheDocument();
  });
});
