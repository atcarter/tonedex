// src/hooks/useNeighbors.ts
import { useParams } from "react-router-dom";
import type { DexView, Game, Pokemon } from "../types";
import { usePokemon } from "./usePokemon";
import { dexSearch } from "./useDexView";

export type Neighbor = "previous" | "next";

// What previous/next shows of a neighbor
export type NeighborEntry = Pick<Pokemon, "name"> &
  Partial<Pick<Pokemon, "pokedex_number" | "sprite_url">>;

export type Neighbors = Record<Neighbor, NeighborEntry | null>;

export interface NeighborSource {
  // null when there is nothing to move through, or while loading
  neighbors: Neighbors | null;
  loading: boolean;
  pathFor: (name: string) => string;
}

const NONE: NeighborSource = {
  neighbors: null,
  loading: false,
  pathFor: () => "",
};

// The list a detail page moves through: on a game route, the URL's dex view
export function useNeighbors(
  pokemonName: string,
  game: Game | null,
  dex: DexView,
): NeighborSource {
  const { gameId } = useParams<{ gameId?: string }>();
  // The same query as PokemonDetail, so this adds no request
  const { data, isLoading } = usePokemon(pokemonName, game?.id, dex);

  if (!gameId || !game) return NONE;
  return {
    neighbors: data?.neighbors ?? null,
    loading: isLoading,
    pathFor: (name) => `/game/${game.name}/pokemon/${name}${dexSearch(dex)}`,
  };
}
