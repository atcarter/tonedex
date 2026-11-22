// src/hooks/usePokemon.ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPokemon } from "../services/api";
import type { DexView } from "../types";

// Shared by the prefetches, so the detail page renders from their cache
export function pokemonQueryOptions(
  name: string,
  gameId: number | undefined,
  dex: DexView,
) {
  return queryOptions({
    queryKey: ["pokemon", name, gameId, dex] as const,
    queryFn: () => getPokemon(name, gameId, dex),
    staleTime: Infinity, // Pokemon data is seeded once, never changes
  });
}

export function usePokemon(
  name: string,
  gameId?: number,
  dex: DexView = "regional",
) {
  return useQuery({
    ...pokemonQueryOptions(name, gameId, dex),
    enabled: !!name,
  });
}
