// src/hooks/useCaughtMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catchPokemon, uncatchPokemon } from "../services/api";
import { useAppContext } from "./useAppContext";
import type { CaughtEntry } from "../types";

export function useCaughtMutations(gameId: number) {
  const { token } = useAppContext();
  const queryClient = useQueryClient();

  const catch_ = useMutation({
    mutationFn: (pokemonId: number) => catchPokemon(pokemonId, gameId, token!),
    // Optimistic update: add entry to cache immediately
    onMutate: async (pokemonId) => {
      await queryClient.cancelQueries({ queryKey: ["caught", gameId] });
      const previous = queryClient.getQueryData<CaughtEntry[]>(["caught", gameId]);
      // Temporary entry with id=-1; server response replaces it on settle
      queryClient.setQueryData<CaughtEntry[]>(["caught", gameId], (old = []) => [
        ...old,
        { id: -1, pokemon_id: pokemonId, game_id: gameId },
      ]);
      return { previous };
    },
    onError: (_err, _pokemonId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["caught", gameId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["caught", gameId] });
    },
  });

  const uncatch = useMutation({
    mutationFn: (caughtId: number) => uncatchPokemon(caughtId, token!),
    // Optimistic update: remove entry from cache immediately
    onMutate: async (caughtId) => {
      await queryClient.cancelQueries({ queryKey: ["caught", gameId] });
      const previous = queryClient.getQueryData<CaughtEntry[]>(["caught", gameId]);
      queryClient.setQueryData<CaughtEntry[]>(["caught", gameId], (old = []) =>
        old.filter((c) => c.id !== caughtId),
      );
      return { previous };
    },
    onError: (_err, _caughtId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["caught", gameId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["caught", gameId] });
    },
  });

  return { catch_, uncatch };
}
