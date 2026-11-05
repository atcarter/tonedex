// src/hooks/usePokemon.ts
import { useQuery } from "@tanstack/react-query";
import { getPokemon } from "../services/api";
import type { DexView, PokemonResponse } from "../types";

// GameSelector prefetches with this same key
export function pokemonQueryKey(
  name: string,
  gameId: number | undefined,
  dex: DexView,
) {
  return ["pokemon", name, gameId, dex] as const;
}

export function usePokemon(
  name: string,
  gameId?: number,
  dex: DexView = "regional",
) {
  return useQuery<PokemonResponse>({
    queryKey: pokemonQueryKey(name, gameId, dex),
    queryFn: () => getPokemon(name, gameId, dex),
    staleTime: Infinity, // Pokemon data is seeded once, never changes
    enabled: !!name,
  });
}
