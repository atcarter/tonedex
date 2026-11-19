import { ALL_TYPES, typesInGeneration } from "../constants/typeChart";
import { defenseTiers } from "./typeDefense";

const byTier = (tiers: ReturnType<typeof defenseTiers>) =>
  Object.fromEntries(tiers.map((tier) => [tier.multiplier, tier.types]));

describe("typesInGeneration", () => {
  it("adds Dark and Steel in Gen 2 and Fairy in Gen 6", () => {
    expect(typesInGeneration(1)).toHaveLength(15);
    expect(typesInGeneration(1)).not.toContain("steel");
    expect(typesInGeneration(5)).toHaveLength(17);
    expect(typesInGeneration(5)).not.toContain("fairy");
    expect(typesInGeneration(6)).toEqual(ALL_TYPES);
  });

  it("uses every type without a generation", () => {
    expect(typesInGeneration(null)).toEqual(ALL_TYPES);
    expect(typesInGeneration(undefined)).toEqual(ALL_TYPES);
    expect(typesInGeneration(0)).toEqual(ALL_TYPES);
  });
});

describe("defenseTiers", () => {
  it("uses the modern chart without a generation (Bronzong, steel/psychic)", () => {
    expect(byTier(defenseTiers(["steel", "psychic"]))).toEqual({
      2: ["fire", "ground", "ghost", "dark"],
      0.5: [
        "normal",
        "grass",
        "ice",
        "flying",
        "rock",
        "dragon",
        "steel",
        "fairy",
      ],
      0.25: ["psychic"],
      0: ["poison"],
    });
  });

  it("has Steel resist Ghost and Dark in Gen 2–5", () => {
    const tiers = byTier(defenseTiers(["steel", "psychic"], 4));

    expect(tiers[2]).toEqual(["fire", "ground"]);
    expect(tiers[0.5]).not.toContain("fairy");
  });

  it("leaves Fairy out before Gen 6 (Dragonite's dragon/flying)", () => {
    expect(byTier(defenseTiers(["dragon", "flying"], 5))[2]).toEqual([
      "rock",
      "dragon",
    ]);
    expect(byTier(defenseTiers(["dragon", "flying"], 5))[4]).toEqual(["ice"]);
    expect(byTier(defenseTiers(["dragon", "flying"], 6))[2]).toEqual([
      "rock",
      "dragon",
      "fairy",
    ]);
  });

  it("applies Gen 1's chart (Ghost can't hit Psychic, Bug hits Poison)", () => {
    expect(byTier(defenseTiers(["psychic"], 1))).toEqual({
      2: ["bug"],
      0.5: ["fighting", "psychic"],
      0: ["ghost"],
    });
    expect(byTier(defenseTiers(["poison"], 1))[2]).toEqual([
      "ground",
      "psychic",
      "bug",
    ]);
    expect(byTier(defenseTiers(["bug"], 1))[2]).toEqual([
      "fire",
      "poison",
      "flying",
      "rock",
    ]);
    // Ice was neutral on Fire
    expect(byTier(defenseTiers(["fire"], 1))[0.5]).not.toContain("ice");
    expect(byTier(defenseTiers(["fire"], 2))[0.5]).toContain("ice");
  });
});
