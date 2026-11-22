export function formatName(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Three digits wide, as the games print them
export function formatDexNumber(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

export function formatStatName(stat: string): string {
  const statNames: Record<string, string> = {
    hp: "HP",
    attack: "ATK",
    defense: "DEF",
    "special-attack": "Sp.Atk",
    "special-defense": "Sp.Def",
    speed: "SPD",
  };
  return statNames[stat] || stat;
}

export function formatEvolutionDetails(details?: {
  trigger?: string;
  min_level?: number;
  item?: string;
  min_happiness?: number;
}): string {
  if (!details) return "";
  if (details.min_level) return `Lv. ${details.min_level}`;
  if (details.item) return formatName(details.item);
  if (details.min_happiness) return "Happiness";
  if (details.trigger) return formatName(details.trigger);
  return "";
}
