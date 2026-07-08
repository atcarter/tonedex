import {
  formatName,
  formatStatName,
  formatEvolutionDetails,
} from "./formatters";

describe("formatName", () => {
  it("capitalises a single word", () => {
    expect(formatName("pikachu")).toBe("Pikachu");
  });

  it("capitalises each hyphen-separated segment", () => {
    expect(formatName("bulbasaur-mega")).toBe("Bulbasaur Mega");
  });

  it("handles multi-segment names like held items", () => {
    expect(formatName("water-stone")).toBe("Water Stone");
  });

  it("returns an empty string unchanged", () => {
    expect(formatName("")).toBe("");
  });
});

describe("formatStatName", () => {
  it("maps hp to HP", () => {
    expect(formatStatName("hp")).toBe("HP");
  });

  it("maps special-attack to Sp.Atk", () => {
    expect(formatStatName("special-attack")).toBe("Sp.Atk");
  });

  it("maps special-defense to Sp.Def", () => {
    expect(formatStatName("special-defense")).toBe("Sp.Def");
  });

  it("maps speed to SPD", () => {
    expect(formatStatName("speed")).toBe("SPD");
  });

  it("returns the raw key for unknown stat names", () => {
    expect(formatStatName("unknown-stat")).toBe("unknown-stat");
  });
});

describe("formatEvolutionDetails", () => {
  it("returns empty string when details are undefined", () => {
    expect(formatEvolutionDetails(undefined)).toBe("");
  });

  it("returns empty string for an empty details object", () => {
    expect(formatEvolutionDetails({})).toBe("");
  });

  it("prefers min_level when present", () => {
    expect(formatEvolutionDetails({ min_level: 16, trigger: "level-up" })).toBe(
      "Lv. 16",
    );
  });

  it("formats item name when present and no level", () => {
    expect(
      formatEvolutionDetails({ item: "water-stone", trigger: "use-item" }),
    ).toBe("Water Stone");
  });

  it("returns 'Happiness' when min_happiness is set", () => {
    expect(formatEvolutionDetails({ min_happiness: 160 })).toBe("Happiness");
  });

  it("falls back to the formatted trigger name", () => {
    expect(formatEvolutionDetails({ trigger: "trade" })).toBe("Trade");
  });
});
