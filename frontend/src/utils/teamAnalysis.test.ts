import {
  ALL_TYPES,
  TYPE_CHART,
  effectivenessAgainst,
} from "../constants/typeChart";
import { memberDefense, offensiveCoverage } from "./teamAnalysis";
import type { Pokemon } from "../types";

function mon(name: string, types: string[]): Pokemon {
  return { id: name.length, name, types, sprite_url: "" };
}

describe("TYPE_CHART", () => {
  it("covers all 18 types with valid multipliers on both axes", () => {
    expect(ALL_TYPES).toHaveLength(18);
    for (const [attacker, matchups] of Object.entries(TYPE_CHART)) {
      for (const [defender, multiplier] of Object.entries(matchups)) {
        expect(ALL_TYPES, `${attacker} → ${defender}`).toContain(defender);
        expect([0, 0.5, 2], `${attacker} → ${defender}`).toContain(multiplier);
      }
    }
  });
});

describe("effectivenessAgainst", () => {
  it("multiplies across dual types (electric vs water/flying = 4×)", () => {
    expect(effectivenessAgainst("electric", ["water", "flying"])).toBe(4);
  });

  it("respects immunities (electric vs ground = 0×)", () => {
    expect(effectivenessAgainst("electric", ["ground"])).toBe(0);
    expect(effectivenessAgainst("electric", ["water", "ground"])).toBe(0);
  });

  it("stacks resistances (fire vs water/dragon = 0.25×)", () => {
    expect(effectivenessAgainst("fire", ["water", "dragon"])).toBe(0.25);
  });

  it("cancels weakness against resistance (grass vs water/grass = 1×)", () => {
    expect(effectivenessAgainst("grass", ["water", "grass"])).toBe(1);
  });

  it("treats unlisted matchups as neutral", () => {
    expect(effectivenessAgainst("normal", ["fire"])).toBe(1);
  });
});

describe("memberDefense", () => {
  const types = (tiers: ReturnType<typeof memberDefense>) =>
    Object.fromEntries(tiers.map((tier) => [tier.multiplier, tier.types]));

  it("splits a dual type into all five tiers (Bastiodon, rock/steel)", () => {
    const tiers = memberDefense(mon("bastiodon", ["rock", "steel"]));

    expect(tiers.map((tier) => tier.multiplier)).toEqual([4, 2, 0.5, 0.25, 0]);
    expect(types(tiers)).toEqual({
      4: ["fighting", "ground"],
      2: ["water"],
      0.5: ["ice", "psychic", "bug", "rock", "dragon", "fairy"],
      0.25: ["normal", "flying"],
      // immunity is its own tier, not a resistance
      0: ["poison"],
    });
  });

  it("omits empty tiers and neutral types (Blastoise, water)", () => {
    const tiers = memberDefense(mon("blastoise", ["water"]));

    expect(types(tiers)).toEqual({
      2: ["electric", "grass"],
      0.5: ["fire", "water", "ice", "steel"],
    });
  });

  it("matches the type chart for every listed type", () => {
    const member = mon("gyarados", ["water", "flying"]);
    for (const { multiplier, types } of memberDefense(member)) {
      for (const type of types) {
        expect(effectivenessAgainst(type, member.types), type).toBe(multiplier);
      }
    }
    const listed = memberDefense(member).flatMap((tier) => tier.types);
    for (const type of ALL_TYPES.filter((t) => !listed.includes(t))) {
      expect(effectivenessAgainst(type, member.types), type).toBe(1);
    }
  });
});

describe("offensiveCoverage", () => {
  it("reports coverage from the union of member (STAB) types", () => {
    const { covered, uncovered } = offensiveCoverage([
      mon("blastoise", ["water"]),
    ]);

    expect(covered.sort()).toEqual(["fire", "ground", "rock"]);
    expect(uncovered).toContain("water");
    expect(uncovered).toContain("dragon");
    expect(covered.length + uncovered.length).toBe(18);
  });

  it("a dual-type member contributes both types", () => {
    const { covered } = offensiveCoverage([
      mon("magnezone", ["electric", "steel"]),
    ]);

    // electric hits water/flying; steel hits ice/rock/fairy
    for (const type of ["water", "flying", "ice", "rock", "fairy"]) {
      expect(covered, type).toContain(type);
    }
  });

  it("everything is uncovered for an empty team", () => {
    expect(offensiveCoverage([]).uncovered).toHaveLength(18);
  });
});
