// src/hooks/useGame.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { getGame } from "../services/api";
import type { DexView, GameResponse } from "../types";

export const PAGE_SIZE = 40;

export function useGame(gameId: number, dex: DexView = "regional") {
  return useInfiniteQuery<GameResponse>({
    queryKey: ["game", gameId, dex],
    queryFn: ({ pageParam }) =>
      getGame(gameId, { limit: PAGE_SIZE, offset: pageParam as number, dex }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    // staleTime: Infinity because Pokemon data is seeded once and never changes.
    // While the backend is still seeding (empty page with pagination.seeding:
    // true), poll every few seconds so the dex fills in without a manual
    // refresh; polling stops as soon as real data arrives.
    staleTime: Infinity,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages;
      return pages?.[pages.length - 1]?.pagination.seeding ? 5000 : false;
    },
    enabled: !!gameId,
  });
}
