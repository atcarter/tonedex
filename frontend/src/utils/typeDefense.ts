import {
  effectivenessAgainst,
  typesInGeneration,
} from "../constants/typeChart";

// The attacking types that hit a typing for one multiplier.
export interface DefenseTier {
  multiplier: number;
  types: string[]; // chart order
}

// Each attacking type's multiplier against a typing; no generation means the modern chart.
export function typeMultipliers(
  types: string[],
  generation?: number | null,
): Map<string, number> {
  return new Map(
    typesInGeneration(generation).map((attackType) => [
      attackType,
      effectivenessAgainst(attackType, types, generation),
    ]),
  );
}

// Most damage first, empty tiers omitted; 1× is left out unless a type is kept.
export function groupTiers(
  multipliers: Map<string, number>,
  keepNeutral: string[] = [],
): DefenseTier[] {
  const tiers = new Map<number, string[]>();
  for (const [type, multiplier] of multipliers) {
    if (multiplier === 1 && !keepNeutral.includes(type)) continue;
    tiers.set(multiplier, [...(tiers.get(multiplier) ?? []), type]);
  }
  return [...tiers]
    .sort(([a], [b]) => b - a)
    .map(([multiplier, types]) => ({ multiplier, types }));
}

// A typing's non-neutral matchups (4×, 2×, ½×, ¼× and 0×).
export function defenseTiers(
  types: string[],
  generation?: number | null,
): DefenseTier[] {
  return groupTiers(typeMultipliers(types, generation));
}
