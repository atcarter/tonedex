import { ALL_TYPES, effectivenessAgainst } from "../constants/typeChart";
import type { Pokemon } from "../types";

// How the team as a whole holds up against one attacking type.
export interface DefenseRow {
  type: string; // the attacking type
  weak: number; // members taking >1× from it
  resist: number; // members taking <1× (immunities included)
  immune: number; // members taking 0×
}

// One row per attacking type, in chart order.
export function defenseSummary(team: Pokemon[]): DefenseRow[] {
  return ALL_TYPES.map((attackType) => {
    let weak = 0;
    let resist = 0;
    let immune = 0;

    for (const member of team) {
      const multiplier = effectivenessAgainst(attackType, member.types);
      if (multiplier > 1) weak++;
      else if (multiplier < 1) {
        resist++;
        if (multiplier === 0) immune++;
      }
    }

    return { type: attackType, weak, resist, immune };
  });
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
