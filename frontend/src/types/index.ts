export interface Toast {
  message: string;
  severity: "error" | "info" | "success";
}

export interface CaughtEntry {
  id: number;
  pokemon_id: number;
  game_id: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url: string;
}

export interface Game {
  id: number;
  name: string;
  generation: number;
  region: string;
}

// regional: the game's main in-game dex; national: every species in the game's data
export type DexView = "regional" | "national";

export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  sprite_url: string;
  mythical?: boolean;
  pokedex_number?: number | null;
  favorite_id?: number;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  seeding?: boolean; // true while a background seed job fills this view
}

export interface PokemonDetail extends Pokemon {
  shiny_sprite_url?: string;
  base_stats: {
    hp: number;
    attack: number;
    defense: number;
    "special-attack": number;
    "special-defense": number;
    speed: number;
  };
}

// Basic move info (from Pokemon endpoint - fast)
export interface BasicMove {
  name: string;
  level_learned: number;
  learn_method: string;
}

// Full move details (requires separate API call)
export interface MoveDetails {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  damage_class: string;
}

// Combined for backwards compatibility
export type Move = BasicMove & Partial<Omit<MoveDetails, "name">>;

export interface EvolutionStep {
  name: string;
  evolves_from?: string | null;
  evolution_details: EvolutionDetail[];
}

export interface EvolutionDetail {
  trigger: string;
  min_level?: number;
  item?: string;
  held_item?: string;
  time_of_day?: string;
  location?: string;
  min_happiness?: number;
  known_move?: string;
  trade_species?: string;
}

export interface AbilityInfo {
  name: string;
  hidden: boolean;
  // The selected game's flavor text (or a fallback); null until its payload is cached
  description: string | null;
  // PokeAPI's current mechanics summary
  short_effect: string | null;
}

// Flavor/lore data from the PokeAPI species + pokemon payloads
export interface SpeciesInfo {
  genus: string | null;
  flavor_text: string | null;
  height: number | null; // decimetres
  weight: number | null; // hectograms
  abilities: AbilityInfo[];
}

export interface PokemonResponse {
  pokemon: PokemonDetail;
  species?: SpeciesInfo | null;
  moves: BasicMove[];
  evolution_chain: EvolutionStep[];
}

export interface GameResponse {
  game: Game;
  pokemons: Pokemon[];
  // The next three cover the whole view, but only page one fills them
  available_types: string[];
  pokemon_ids: number[];
  dex_numbers: number[]; // in list order
  pagination: Pagination;
}

export interface SearchResponse {
  results: Pokemon[];
  // true when the query resolved to a single exact PokeAPI match
  exact: boolean;
}
