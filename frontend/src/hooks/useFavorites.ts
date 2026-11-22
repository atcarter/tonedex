// src/hooks/useFavorites.ts
import { useQuery } from "@tanstack/react-query";
import { getFavorites } from "../services/api";
import { useAppContext } from "./useAppContext";
import type { Pokemon } from "../types";

// staleTime: 0 — user-owned data should be fresh on every mount
// (multiple tabs/devices may have modified favorites)
export function useFavorites(enabled = true) {
  const { token } = useAppContext();

  return useQuery<Pokemon[]>({
    queryKey: ["favorites"],
    queryFn: () => getFavorites(token!),
    enabled: enabled && !!token,
    staleTime: 0,
  });
}
