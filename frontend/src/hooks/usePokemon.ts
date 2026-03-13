// src/hooks/usePokemon.ts
import { useQuery } from "@tanstack/react-query";
import { getPokemon } from "../services/api";
import type { PokemonResponse } from "../types";

export function usePokemon(name: string, gameId?: number) {
  return useQuery<PokemonResponse>({
    queryKey: ["pokemon", name, gameId],
    queryFn: () => getPokemon(name, gameId),
    staleTime: Infinity, // Pokemon data is seeded once, never changes
    enabled: !!name,
  });
}
