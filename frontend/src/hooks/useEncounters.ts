// src/hooks/useEncounters.ts
import { useQuery } from "@tanstack/react-query";
import { getEncounters } from "../services/api";
import type { EncountersResponse } from "../types";

// Polls while the backend's job caches the data, like useGame's seeding state
export function useEncounters(pokemonId: number, gameId: number | undefined) {
  return useQuery<EncountersResponse>({
    queryKey: ["encounters", pokemonId, gameId],
    queryFn: () => getEncounters(pokemonId, gameId!),
    staleTime: Infinity,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 5000 : false,
    enabled: !!pokemonId && !!gameId,
  });
}
