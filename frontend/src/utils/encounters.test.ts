import type { EncounterLocation } from "../types";
import {
  formatArea,
  formatChance,
  formatConditions,
  formatLevels,
  formatMethod,
} from "./encounters";

const location = (
  overrides: Partial<EncounterLocation> = {},
): EncounterLocation => ({
  area: "johto-route-29-area",
  method: "walk",
  dlc: null,
  min_level: 2,
  max_level: 4,
  chance: 30,
  chance_varies: false,
  conditions: [],
  varies_with: [],
  ...overrides,
});

describe("formatArea", () => {
  it("drops the -area suffix and the game's own region", () => {
    expect(formatArea("johto-route-29-area", "johto")).toBe("Route 29");
    expect(formatArea("kanto-route-1-area", "johto")).toBe("Kanto Route 1");
  });

  it("keeps floor names upper case and small words lower case", () => {
    expect(formatArea("mt-moon-b2f", "kanto")).toBe("Mt Moon B2F");
    expect(formatArea("fields-of-honor-area", "galar")).toBe("Fields of Honor");
  });
});

describe("formatMethod", () => {
  it("names common methods and title-cases the rest", () => {
    expect(formatMethod("walk")).toBe("Walking");
    expect(formatMethod("super-rod")).toBe("Super Rod");
  });
});

describe("formatLevels and formatChance", () => {
  it("shows a range or a single level", () => {
    expect(formatLevels(location())).toBe("Lv. 2–4");
    expect(formatLevels(location({ max_level: 2 }))).toBe("Lv. 2");
  });

  it("marks a chance that depends on conditions as a maximum", () => {
    expect(formatChance(location())).toBe("30% chance");
    expect(formatChance(location({ chance_varies: true }))).toBe(
      "Up to 30% chance",
    );
  });
});

describe("formatConditions", () => {
  it("is empty with no conditions", () => {
    expect(formatConditions(location())).toBe("");
  });

  it("names shared conditions, then what the rest vary with", () => {
    expect(
      formatConditions(
        location({ conditions: ["time-night"], varies_with: ["radio-off"] }),
      ),
    ).toBe("Night · Varies with the radio");
  });

  it("groups many varying values into their kinds", () => {
    expect(
      formatConditions(
        location({
          conditions: ["weather-thunderstorm"],
          varies_with: [
            "story-progress-hall-of-fame",
            "story-progress-before-hall-of-fame",
            "time-morning",
            "swarm-yes",
          ],
        }),
      ),
    ).toBe("Thunderstorm · Varies with story progress, time of day and swarms");
  });

  it("labels the GBA slot and unknown conditions readably", () => {
    expect(formatConditions(location({ conditions: ["slot2-ruby"] }))).toBe(
      "Ruby in the GBA slot",
    );
    expect(formatConditions(location({ varies_with: ["coins-500"] }))).toBe(
      "Varies with other conditions",
    );
  });
});
