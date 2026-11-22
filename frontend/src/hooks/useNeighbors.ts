// src/hooks/useNeighbors.ts
import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { DexView, Game, Pokemon } from "../types";
import { usePokemon } from "./usePokemon";
import { useFavorites } from "./useFavorites";
import { dexSearch } from "./useDexView";

export type Neighbor = "previous" | "next";

// What previous/next shows of a neighbor
export type NeighborEntry = Pick<Pokemon, "name"> &
  Partial<Pick<Pokemon, "pokedex_number" | "sprite_url">>;

export type Neighbors = Record<Neighbor, NeighborEntry | null>;

// The list a detail page was opened from, when it isn't the dex view. It rides
// in history state, set by the opening link and carried by every move.
export type PagerOrigin =
  { from: "favorites" } | { from: "compare"; pair: string[] };

export interface NeighborSource {
  // null when there is nothing to move through, or while loading
  neighbors: Neighbors | null;
  loading: boolean;
  pathFor: (name: string) => string;
  origin?: PagerOrigin;
}

// The entries either side of a name in a list the client holds
export function neighborsIn(
  list: readonly NeighborEntry[],
  name: string,
): Neighbors | null {
  const i = list.findIndex((p) => p.name === name);
  if (i < 0) return null;
  return { previous: list[i - 1] ?? null, next: list[i + 1] ?? null };
}

function originOf(state: unknown): PagerOrigin | undefined {
  const origin = (state as { origin?: PagerOrigin } | null)?.origin;
  return origin?.from === "favorites" || origin?.from === "compare"
    ? origin
    : undefined;
}

const gameless = (name: string) => `/pokemon/${name}`;

// The list a detail page moves through: the one it was opened from, else on a
// game route the URL's dex view
export function useNeighbors(
  pokemonName: string,
  game: Game | null,
  dex: DexView,
): NeighborSource {
  const { gameId } = useParams<{ gameId?: string }>();
  const origin = originOf(useLocation().state);
  // The same query as PokemonDetail, so this adds no request
  const { data, isLoading } = usePokemon(pokemonName, game?.id, dex);
  const favorites = useFavorites(origin?.from === "favorites");

  const list = useMemo((): NeighborEntry[] | null => {
    if (origin?.from === "favorites") return favorites.data ?? null;
    if (origin?.from === "compare") {
      return [...new Set(origin.pair)].map((name) => ({ name }));
    }
    return null;
  }, [origin, favorites.data]);
  const fromList = useMemo(
    () => (list ? neighborsIn(list, pokemonName) : null),
    [list, pokemonName],
  );

  if (origin) {
    return {
      neighbors: fromList,
      loading: origin.from === "favorites" && favorites.isLoading,
      pathFor: gameless,
      origin,
    };
  }
  if (!gameId || !game) {
    return { neighbors: null, loading: false, pathFor: gameless };
  }
  return {
    neighbors: data?.neighbors ?? null,
    loading: isLoading,
    pathFor: (name) => `/game/${game.name}/pokemon/${name}${dexSearch(dex)}`,
  };
}
