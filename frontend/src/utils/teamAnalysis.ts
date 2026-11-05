import { ALL_TYPES, effectivenessAgainst } from "../constants/typeChart";
import type { Pokemon } from "../types";

// A team member and the damage multiplier it takes from one attacking type.
export interface MemberHit {
  member: Pokemon;
  multiplier: number;
}

// Which members one attacking type hits harder, softer, or not at all.
export interface DefenseRow {
  type: string; // the attacking type
  weak: MemberHit[]; // 2× or 4×
  resist: MemberHit[]; // ½× or ¼×
  immune: MemberHit[]; // 0×
}

// One row per attacking type, in chart order; members keep team order.
export function defenseSummary(team: Pokemon[]): DefenseRow[] {
  return ALL_TYPES.map((attackType) => {
    const row: DefenseRow = {
      type: attackType,
      weak: [],
      resist: [],
      immune: [],
    };

    for (const member of team) {
      const multiplier = effectivenessAgainst(attackType, member.types);
      const hit = { member, multiplier };
      if (multiplier > 1) row.weak.push(hit);
      else if (multiplier === 0) row.immune.push(hit);
      else if (multiplier < 1) row.resist.push(hit);
    }

    return row;
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
