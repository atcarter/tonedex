// src/hooks/useCaughtPokemons.ts
import { useQuery } from "@tanstack/react-query";
import { getCaughtPokemons } from "../services/api";
import { useAppContext } from "./useAppContext";
import type { CaughtEntry } from "../types";

// staleTime: 0 — user-owned data should be fresh on every mount
export function useCaughtPokemons(gameId: number) {
  const { token } = useAppContext();

  return useQuery<CaughtEntry[]>({
    queryKey: ["caught", gameId],
    queryFn: () => getCaughtPokemons(gameId, token!),
    enabled: !!token && !!gameId,
    staleTime: 0,
  });
}
