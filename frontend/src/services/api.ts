import type {
  CaughtEntry,
  Game,
  GameResponse,
  MoveDetails,
  Pokemon,
  PokemonResponse,
  User,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export class UnauthorizedError extends Error {
  constructor() {
    super("Session expired. Please sign in again.");
    this.name = "UnauthorizedError";
  }
}

async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, options);

  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function signInWithGoogle(
  idToken: string,
): Promise<{ token: string; user: User }> {
  return fetchJson("/api/v1/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function getFavorites(token: string): Promise<Pokemon[]> {
  return fetchJson<Pokemon[]>("/api/v1/favorites", {
    headers: authHeaders(token),
  });
}

export async function addFavorite(
  pokemonId: number,
  token: string,
): Promise<{ id: number; pokemon_id: number }> {
  return fetchJson("/api/v1/favorites", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ pokemon_id: pokemonId }),
  });
}

export async function reorderFavorites(
  favoriteIds: number[],
  token: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/favorites/reorder`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ ids: favoriteIds }),
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}

export async function removeFavorite(
  favoriteId: number,
  token: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/favorites/${favoriteId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}

export async function getGames(): Promise<Game[]> {
  return fetchJson<Game[]>("/api/v1/games");
}

export interface GetGameOptions {
  limit?: number;
  offset?: number;
}

export async function getGame(
  id: number,
  options: GetGameOptions = {},
): Promise<GameResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));

  const queryString = params.toString();
  const url = `/api/v1/games/${id}${queryString ? `?${queryString}` : ""}`;
  return fetchJson<GameResponse>(url);
}

export async function getPokemon(
  nameOrId: string | number,
  gameId?: number,
): Promise<PokemonResponse> {
  const params = gameId ? `?game_id=${gameId}` : "";
  return fetchJson<PokemonResponse>(`/api/v1/pokemon/${nameOrId}${params}`);
}

export async function searchPokemon(
  query: string,
): Promise<Pokemon | Pokemon[]> {
  return fetchJson<Pokemon | Pokemon[]>(
    `/api/v1/pokemon/search?q=${encodeURIComponent(query)}`,
  );
}

export async function getMove(name: string): Promise<MoveDetails> {
  return fetchJson<MoveDetails>(`/api/v1/moves/${encodeURIComponent(name)}`);
}

export async function getCaughtPokemons(
  gameId: number,
  token: string,
): Promise<CaughtEntry[]> {
  return fetchJson<CaughtEntry[]>(`/api/v1/caught_pokemons?game_id=${gameId}`, {
    headers: authHeaders(token),
  });
}

export async function catchPokemon(
  pokemonId: number,
  gameId: number,
  token: string,
): Promise<CaughtEntry> {
  return fetchJson<CaughtEntry>("/api/v1/caught_pokemons", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ pokemon_id: pokemonId, game_id: gameId }),
  });
}

export async function uncatchPokemon(
  caughtId: number,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/v1/caught_pokemons/${caughtId}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}
