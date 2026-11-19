// Gen 6+ type effectiveness chart: TYPE_CHART[attacker][defender] gives the
// damage multiplier; matchups not listed are neutral (1×). Pass a generation
// to the functions below for an older game's chart; the team builder doesn't.
export const TYPE_CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};

export const ALL_TYPES = Object.keys(TYPE_CHART);

type Change = [attacker: string, defender: string, multiplier: number];

// Gen 2–5: Steel also resisted Ghost and Dark.
const GEN_2_TO_5: Change[] = [
  ["ghost", "steel", 0.5],
  ["dark", "steel", 0.5],
];

// Gen 1 on top of those
const GEN_1: Change[] = [
  ["bug", "poison", 2],
  ["poison", "bug", 2],
  ["ghost", "psychic", 0],
  ["ice", "fire", 1],
];

function withChanges(changes: Change[]) {
  const chart = Object.fromEntries(
    Object.entries(TYPE_CHART).map(([type, row]) => [type, { ...row }]),
  );
  for (const [attacker, defender, multiplier] of changes) {
    chart[attacker][defender] = multiplier;
  }
  return chart;
}

const GEN_2_TO_5_CHART = withChanges(GEN_2_TO_5);
const GEN_1_CHART = withChanges([...GEN_2_TO_5, ...GEN_1]);

// null, or a generation outside 1–5, means the modern chart
const isOlder = (generation?: number | null): generation is number =>
  generation != null && generation >= 1 && generation < 6;

function chartFor(generation?: number | null) {
  if (!isOlder(generation)) return TYPE_CHART;
  return generation === 1 ? GEN_1_CHART : GEN_2_TO_5_CHART;
}

// The types that exist in a generation: Dark and Steel from Gen 2, Fairy from Gen 6.
export function typesInGeneration(generation?: number | null): string[] {
  if (!isOlder(generation)) return ALL_TYPES;
  const missing = generation === 1 ? ["dark", "steel", "fairy"] : ["fairy"];
  return ALL_TYPES.filter((type) => !missing.includes(type));
}

// Combined multiplier for one attacking type against a (mono or dual) typing.
export function effectivenessAgainst(
  attackType: string,
  defendTypes: string[],
  generation?: number | null,
): number {
  const chart = chartFor(generation);
  return defendTypes.reduce(
    (multiplier, defendType) =>
      multiplier * (chart[attackType]?.[defendType] ?? 1),
    1,
  );
}
