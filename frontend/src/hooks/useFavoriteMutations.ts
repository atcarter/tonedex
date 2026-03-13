// src/hooks/useFavoriteMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addFavorite,
  removeFavorite,
  reorderFavorites,
} from "../services/api";
import { useAppContext } from "./useAppContext";
import type { Pokemon } from "../types";

export function useFavoriteMutations() {
  const { token } = useAppContext();
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: (pokemon: Pokemon) => addFavorite(pokemon.id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const remove = useMutation({
    mutationFn: (favoriteId: number) => removeFavorite(favoriteId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const reorder = useMutation({
    mutationFn: (ordered: Pokemon[]) =>
      reorderFavorites(
        ordered.map((p) => p.favorite_id!),
        token!,
      ),
    // Optimistic update: reflect new order in cache immediately
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: ["favorites"] });
      const previous = queryClient.getQueryData<Pokemon[]>(["favorites"]);
      queryClient.setQueryData(["favorites"], ordered);
      return { previous };
    },
    onError: (_err, _ordered, context) => {
      // Revert to previous order on failure
      if (context?.previous) {
        queryClient.setQueryData(["favorites"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  return { add, remove, reorder };
}
