import { ALL_TYPES, effectivenessAgainst } from "../constants/typeChart";
import type { Pokemon } from "../types";

// Defensive tiers in display order; 1× is left out.
export const DEFENSE_TIERS = [4, 2, 0.5, 0.25, 0] as const;
export type DefenseMultiplier = (typeof DEFENSE_TIERS)[number];

// The attacking types that hit a member for one multiplier.
export interface DefenseTier {
  multiplier: DefenseMultiplier;
  types: string[]; // chart order
}

// One member's non-neutral matchups, empty tiers omitted.
export function memberDefense(member: Pokemon): DefenseTier[] {
  return DEFENSE_TIERS.map((multiplier) => ({
    multiplier,
    types: ALL_TYPES.filter(
      (attackType) =>
        effectivenessAgainst(attackType, member.types) === multiplier,
    ),
  })).filter((tier) => tier.types.length > 0);
}

// Which defending types the team can hit super-effectively with STAB
// (same-type attack bonus — each member is assumed to carry moves of its own
// types, the standard first-pass coverage heuristic).
export function offensiveCoverage(team: Pokemon[]): {
  covered: string[];
  uncovered: string[];
} {
  const stabTypes = [...new Set(team.flatMap((member) => member.types))];
  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const defendType of ALL_TYPES) {
    const hit = stabTypes.some(
      (stab) => effectivenessAgainst(stab, [defendType]) > 1,
    );
    (hit ? covered : uncovered).push(defendType);
  }

  return { covered, uncovered };
}
