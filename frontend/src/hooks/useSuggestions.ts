// src/hooks/useSuggestions.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSuggestions } from "../services/api";
import type { Pokemon } from "../types";

// As-you-type search suggestions. Callers pass an already-debounced query;
// previous results are kept while the next keystroke's fetch is in flight so
// the dropdown doesn't flicker.
export function useSuggestions(query: string) {
  return useQuery<{ results: Pokemon[] }>({
    queryKey: ["suggestions", query],
    queryFn: () => getSuggestions(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
