import type { AbilityInfo } from "../types";
import { groupTiers, typeMultipliers } from "./typeDefense";
import type { DefenseTier } from "./typeDefense";

interface AbilityEffect {
  immune?: string[];
  scale?: Record<string, number>; // multiplies that type's damage
  superEffective?: number; // multiplies super-effective damage
  onlySuperEffective?: true;
  since?: number; // first generation with the effect, when later than the ability
}

// Abilities that change the damage a type does to their holder, by PokeAPI name.
export const MATCHUP_ABILITIES: Record<string, AbilityEffect> = {
  levitate: { immune: ["ground"] },
  "earth-eater": { immune: ["ground"] },
  "flash-fire": { immune: ["fire"] },
  "well-baked-body": { immune: ["fire"] },
  "water-absorb": { immune: ["water"] },
  "storm-drain": { immune: ["water"], since: 5 },
  "dry-skin": { immune: ["water"], scale: { fire: 1.25 } },
  "volt-absorb": { immune: ["electric"] },
  "lightning-rod": { immune: ["electric"], since: 5 },
  "motor-drive": { immune: ["electric"] },
  "sap-sipper": { immune: ["grass"] },
  "thick-fat": { scale: { fire: 0.5, ice: 0.5 } },
  heatproof: { scale: { fire: 0.5 } },
  "water-bubble": { scale: { fire: 0.5 } },
  "purifying-salt": { scale: { ghost: 0.5 } },
  fluffy: { scale: { fire: 2 } },
  "wonder-guard": { onlySuperEffective: true },
  filter: { superEffective: 0.75 },
  "solid-rock": { superEffective: 0.75 },
  "prism-armor": { superEffective: 0.75 },
};

export function withAbility(
  effect: AbilityEffect,
  attackType: string,
  multiplier: number,
): number {
  if (effect.onlySuperEffective) return multiplier > 1 ? multiplier : 0;
  if (effect.immune?.includes(attackType)) return 0;
  const scaled = multiplier * (effect.scale?.[attackType] ?? 1);
  return multiplier > 1 ? scaled * (effect.superEffective ?? 1) : scaled;
}

// The first ability, regular slots before hidden, that changes a matchup in the generation.
export function matchupAbility(
  abilities: AbilityInfo[],
  generation: number | null,
): string | null {
  const ordered = [
    ...abilities.filter((a) => !a.hidden),
    ...abilities.filter((a) => a.hidden),
  ];
  const found = ordered.find(({ name }) => {
    const effect = MATCHUP_ABILITIES[name];
    return effect && !(generation && effect.since && generation < effect.since);
  });
  return found?.name ?? null;
}

export interface AbilityDefense {
  tiers: DefenseTier[];
  ability: string | null; // the one folded into the tiers
  tagged: string[]; // types it moved, when the Pokémon may have another ability
}

// The type chart with the first matchup-changing ability folded in.
export function abilityDefense(
  types: string[],
  abilities: AbilityInfo[],
  generation: number | null,
): AbilityDefense {
  const multipliers = typeMultipliers(types, generation);
  const ability = matchupAbility(abilities, generation);
  if (!ability) return { tiers: groupTiers(multipliers), ability, tagged: [] };

  const effect = MATCHUP_ABILITIES[ability];
  const changed: string[] = [];
  for (const [type, multiplier] of multipliers) {
    const adjusted = withAbility(effect, type, multiplier);
    if (adjusted === multiplier) continue;
    multipliers.set(type, adjusted);
    changed.push(type);
  }
  const tagged = abilities.length > 1 ? changed : [];
  // A tagged type that drops to 1× stays listed so the change shows
  return { tiers: groupTiers(multipliers, tagged), ability, tagged };
}
