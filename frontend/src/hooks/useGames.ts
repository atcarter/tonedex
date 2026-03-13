// src/hooks/useGames.ts
import { useQuery } from "@tanstack/react-query";
import { getGames } from "../services/api";
import type { Game } from "../types";

export function useGames() {
  return useQuery<Game[]>({
    queryKey: ["games"],
    queryFn: getGames,
    staleTime: Infinity, // game list never changes after seeding
  });
}
