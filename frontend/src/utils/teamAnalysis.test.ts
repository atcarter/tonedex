import {
  ALL_TYPES,
  TYPE_CHART,
  effectivenessAgainst,
} from "../constants/typeChart";
import { defenseSummary, offensiveCoverage } from "./teamAnalysis";
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

describe("defenseSummary", () => {
  // Dragapult: dragon/ghost — weak to ghost, dark, ice, dragon, fairy;
  // immune to normal and fighting; resists fire/water/electric/grass/poison/bug
  const dragapult = mon("dragapult", ["dragon", "ghost"]);

  function row(rows: ReturnType<typeof defenseSummary>, type: string) {
    return rows.find((r) => r.type === type)!;
  }

  it("counts weaknesses, resists, and immunities for a single member", () => {
    const rows = defenseSummary([dragapult]);

    for (const weakTo of ["ghost", "dark", "ice", "dragon", "fairy"]) {
      expect(row(rows, weakTo).weak, weakTo).toBe(1);
    }
    for (const immuneTo of ["normal", "fighting"]) {
      expect(row(rows, immuneTo).immune, immuneTo).toBe(1);
      // immunities count as resists
      expect(row(rows, immuneTo).resist, immuneTo).toBe(1);
    }
    expect(row(rows, "water").resist).toBe(1);
    expect(row(rows, "water").weak).toBe(0);
  });

  it("aggregates across members", () => {
    // Two ice-weak members and one ice-resisting member
    const rows = defenseSummary([
      dragapult,
      mon("garchomp", ["dragon", "ground"]),
      mon("lapras", ["water", "ice"]),
    ]);

    const ice = row(rows, "ice");
    expect(ice.weak).toBe(2); // dragapult, garchomp (4×)
    expect(ice.resist).toBe(1); // lapras
  });

  it("returns all-zero rows for an empty team", () => {
    for (const r of defenseSummary([])) {
      expect(r.weak + r.resist + r.immune).toBe(0);
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
