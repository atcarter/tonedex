// src/hooks/useGame.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { getGame } from "../services/api";
import type { GameResponse } from "../types";

const PAGE_SIZE = 40;

export function useGame(gameId: number) {
  return useInfiniteQuery<GameResponse>({
    queryKey: ["game", gameId],
    queryFn: ({ pageParam }) =>
      getGame(gameId, { limit: PAGE_SIZE, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    // staleTime: Infinity because Pokemon data is seeded once and never changes.
    // Known limitation: if a game is first visited while seeding (backend returns
    // pagination.seeding: true with empty pokemons), that empty page is cached
    // permanently. The user must hard-refresh after seeding completes to see data.
    // The SeedingBanner in GamePage prompts the user to do this.
    staleTime: Infinity,
    enabled: !!gameId,
  });
}
