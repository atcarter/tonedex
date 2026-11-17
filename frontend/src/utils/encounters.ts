import type { EncounterLocation } from "../types";
import { formatName } from "./formatters";

const METHOD_LABELS: Record<string, string> = {
  walk: "Walking",
  surf: "Surfing",
  "gift-egg": "Gift egg",
  static: "Stationary",
  wanderer: "Wandering",
  "wanderer-water": "Wandering (water)",
  "overworld-water": "Overworld (water)",
  "overworld-flying": "Overworld (flying)",
  "dark-grass": "Dark grass",
  "grass-spots": "Shaking grass",
  "cave-spots": "Dust cloud",
  "bridge-spots": "Bridge shadow",
  "surf-spots": "Rippling water",
  "super-rod-spots": "Fishing ripples",
  "roaming-grass": "Roaming",
  "roaming-water": "Roaming (water)",
  "npc-trade": "In-game trade",
  sos: "SOS battle",
  pokeflute: "Poké Flute",
};

const CONDITION_LABELS: Record<string, string> = {
  "swarm-yes": "During a swarm",
  "swarm-no": "No swarm",
  "radar-on": "Poké Radar",
  "radar-off": "No Poké Radar",
  "radio-off": "Radio off",
  "radio-hoenn": "Hoenn Sound",
  "radio-sinnoh": "Sinnoh Sound",
  "slot2-none": "Empty GBA slot",
  "weather-normal": "Normal weather",
};

// Condition groups, named as "varies with …"; the longest matching prefix wins
const DIMENSIONS: Record<string, string> = {
  time: "time of day",
  season: "season",
  swarm: "swarms",
  radar: "the Poké Radar",
  radio: "the radio",
  slot2: "the GBA slot",
  weather: "weather",
  "story-progress": "story progress",
  "max-den-rarity": "the den",
  "max-den-rating": "the den",
  "headbutt-tree": "the tree",
  weekday: "the day",
};

// Groups whose values read alone once the prefix goes (time-night is "Night")
const BARE_VALUE_DIMENSIONS = new Set(["time", "season", "weather"]);

function sentence(slug: string) {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function dimensionOf(value: string) {
  return Object.keys(DIMENSIONS)
    .filter((prefix) => value.startsWith(`${prefix}-`))
    .sort((a, b) => b.length - a.length)[0];
}

function listJoin(items: string[]) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const MINOR_WORDS = new Set(["of", "the", "and", "in", "on", "to"]);

// "johto-route-29-area" in Johto is "Route 29"; another region's prefix stays
export function formatArea(area: string, region?: string) {
  let slug = area.replace(/-area$/, "");
  if (region && slug.startsWith(`${region}-`))
    slug = slug.slice(region.length + 1);
  return slug
    .split("-")
    .map((word, i) => {
      if (/^b?\d+f$/.test(word)) return word.toUpperCase();
      if (i > 0 && MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function formatMethod(method: string) {
  return METHOD_LABELS[method] ?? formatName(method);
}

export function formatLevels({ min_level, max_level }: EncounterLocation) {
  return min_level === max_level
    ? `Lv. ${min_level}`
    : `Lv. ${min_level}–${max_level}`;
}

export function formatChance({ chance, chance_varies }: EncounterLocation) {
  return `${chance_varies ? "Up to " : ""}${chance}% chance`;
}

export function formatCondition(value: string) {
  if (CONDITION_LABELS[value]) return CONDITION_LABELS[value];
  const dimension = dimensionOf(value);
  if (dimension && BARE_VALUE_DIMENSIONS.has(dimension))
    return sentence(value.slice(dimension.length + 1));
  if (dimension === "slot2")
    return `${formatName(value.slice(6))} in the GBA slot`;
  return sentence(value);
}

// "Night · Varies with the radio": conditions every slot needs, then what the rest depend on
export function formatConditions(location: EncounterLocation) {
  const varying = [
    ...new Set(
      location.varies_with.map(
        (value) => DIMENSIONS[dimensionOf(value) ?? ""] ?? "other conditions",
      ),
    ),
  ];
  return [
    ...location.conditions.map(formatCondition),
    ...(varying.length ? [`Varies with ${listJoin(varying)}`] : []),
  ].join(" · ");
}
