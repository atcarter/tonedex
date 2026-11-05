// Abilities arrived in Gen 3; earlier games have none.
const FIRST_ABILITY_GENERATION = 3;

export function isPreAbilityGeneration(generation: number | null | undefined) {
  return (
    generation != null &&
    generation > 0 &&
    generation < FIRST_ABILITY_GENERATION
  );
}
