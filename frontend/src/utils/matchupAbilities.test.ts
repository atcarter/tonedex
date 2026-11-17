import {
  MATCHUP_ABILITIES,
  abilityDefense,
  matchupAbility,
  withAbility,
} from "./matchupAbilities";
import type { AbilityInfo } from "../types";

const ability = (name: string, hidden = false): AbilityInfo => ({
  name,
  hidden,
  description: null,
  short_effect: null,
});

const byTier = (tiers: ReturnType<typeof abilityDefense>["tiers"]) =>
  Object.fromEntries(tiers.map((tier) => [tier.multiplier, tier.types]));

describe("MATCHUP_ABILITIES", () => {
  it("keys every entry by its PokeAPI name", () => {
    for (const name of Object.keys(MATCHUP_ABILITIES)) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it.each([
    // [ability, attacking type, multiplier before, after]
    ["levitate", "ground", 2, 0],
    ["levitate", "fire", 2, 2],
    ["earth-eater", "ground", 1, 0],
    ["flash-fire", "fire", 0.5, 0],
    ["well-baked-body", "fire", 2, 0],
    ["water-absorb", "water", 2, 0],
    ["storm-drain", "water", 1, 0],
    ["volt-absorb", "electric", 4, 0],
    ["lightning-rod", "electric", 2, 0],
    ["motor-drive", "electric", 1, 0],
    ["sap-sipper", "grass", 2, 0],
    ["dry-skin", "water", 1, 0],
    ["dry-skin", "fire", 2, 2.5],
    ["thick-fat", "fire", 2, 1],
    ["thick-fat", "ice", 1, 0.5],
    ["heatproof", "fire", 2, 1],
    ["water-bubble", "fire", 0.5, 0.25],
    ["purifying-salt", "ghost", 1, 0.5],
    ["fluffy", "fire", 2, 4],
    ["filter", "fighting", 2, 1.5],
    ["solid-rock", "water", 4, 3],
    ["prism-armor", "ice", 0.5, 0.5],
    ["wonder-guard", "fire", 2, 2],
    ["wonder-guard", "normal", 1, 0],
    ["wonder-guard", "grass", 0.5, 0],
  ])("%s: %s %s× becomes %s×", (name, type, before, after) => {
    expect(withAbility(MATCHUP_ABILITIES[name], type, before)).toBe(after);
  });
});

describe("matchupAbility", () => {
  it("takes the first matchup ability, regular slots before hidden", () => {
    const lanturn = [
      ability("water-absorb", true),
      ability("illuminate"),
      ability("volt-absorb"),
    ];
    expect(matchupAbility(lanturn, 9)).toBe("volt-absorb");
    expect(matchupAbility([ability("overgrow")], 9)).toBeNull();
  });

  it("skips Lightning Rod and Storm Drain's immunity before Gen 5", () => {
    const rhydon = [ability("lightning-rod"), ability("rock-head")];

    expect(matchupAbility(rhydon, 4)).toBeNull();
    expect(matchupAbility(rhydon, 5)).toBe("lightning-rod");
    // Current mechanics outside a game
    expect(matchupAbility(rhydon, null)).toBe("lightning-rod");
  });
});

describe("abilityDefense", () => {
  const gengar = ["ghost", "poison"];

  it("folds Levitate into Gengar's chart in Gen 4, with no tag", () => {
    const {
      tiers,
      ability: folded,
      tagged,
    } = abilityDefense(gengar, [ability("levitate")], 4);

    expect(folded).toBe("levitate");
    expect(tagged).toEqual([]);
    expect(byTier(tiers)).toEqual({
      2: ["psychic", "ghost", "dark"],
      0.5: ["grass"],
      0.25: ["poison", "bug"],
      0: ["normal", "fighting", "ground"],
    });
  });

  it("keeps Ground as Gengar's weakness in Gen 8 (Cursed Body)", () => {
    const { tiers, ability: folded } = abilityDefense(
      gengar,
      [ability("cursed-body")],
      8,
    );

    expect(folded).toBeNull();
    expect(byTier(tiers)[2]).toEqual(["ground", "psychic", "ghost", "dark"]);
  });

  it("tags what Levitate moves when Bronzong may have another ability", () => {
    const {
      tiers,
      ability: folded,
      tagged,
    } = abilityDefense(
      ["steel", "psychic"],
      [ability("levitate"), ability("heatproof"), ability("heavy-metal", true)],
      9,
    );

    expect(folded).toBe("levitate");
    expect(tagged).toEqual(["ground"]);
    expect(byTier(tiers)[2]).toEqual(["fire", "ghost", "dark"]);
    expect(byTier(tiers)[0]).toEqual(["poison", "ground"]);
  });

  it("lists a tagged type that drops to 1× (Mamoswine's Thick Fat)", () => {
    const { tiers, tagged } = abilityDefense(
      ["ice", "ground"],
      [ability("oblivious"), ability("snow-cloak"), ability("thick-fat", true)],
      9,
    );

    expect(tagged).toEqual(["fire", "ice"]);
    expect(byTier(tiers)[1]).toEqual(["fire"]);
    expect(byTier(tiers)[0.5]).toEqual(["ice", "poison"]);
  });

  it("lets only super-effective types hit through Wonder Guard", () => {
    const { tiers } = abilityDefense(
      ["bug", "ghost"],
      [ability("wonder-guard")],
      9,
    );

    expect(tiers.map((tier) => tier.multiplier)).toEqual([2, 0]);
    expect(byTier(tiers)[2]).toEqual([
      "fire",
      "flying",
      "rock",
      "ghost",
      "dark",
    ]);
  });

  it("matches the types-only chart without abilities", () => {
    const { tiers, ability: folded } = abilityDefense(gengar, [], 2);

    expect(folded).toBeNull();
    expect(byTier(tiers)[2]).toEqual(["ground", "psychic", "ghost", "dark"]);
  });
});
