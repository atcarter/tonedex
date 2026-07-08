// src/hooks/useMove.ts
import { useQuery } from "@tanstack/react-query";
import { getMove } from "../services/api";
import type { MoveDetails } from "../types";

// Move data is seeded once and never changes; fetch lazily (enabled when the
// row is expanded) and cache for the session.
export function useMove(name: string, enabled: boolean) {
  return useQuery<MoveDetails>({
    queryKey: ["move", name],
    queryFn: () => getMove(name),
    staleTime: Infinity,
    enabled,
  });
}
