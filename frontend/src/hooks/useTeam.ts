// src/hooks/useTeam.ts
import { useState } from "react";
import type { Pokemon } from "../types";

export const MAX_TEAM_SIZE = 6;

function storageKey(gameId: number) {
  return `pokedex_team_${gameId}`;
}

function loadTeam(gameId: number): Pokemon[] {
  try {
    const raw = window.localStorage.getItem(storageKey(gameId));
    return raw ? (JSON.parse(raw) as Pokemon[]) : [];
  } catch {
    return [];
  }
}

// Per-game team, persisted to localStorage (client-only: teams are scratch
// work and usable signed-out; cross-device persistence is a possible
// follow-up, mirroring favorites).
export function useTeam(gameId: number) {
  const [team, setTeam] = useState<Pokemon[]>(() => loadTeam(gameId));

  // Reload when navigating between games (render-time reset, no effect flash)
  const [prevGameId, setPrevGameId] = useState(gameId);
  if (prevGameId !== gameId) {
    setPrevGameId(gameId);
    setTeam(loadTeam(gameId));
  }

  const persist = (next: Pokemon[]) => {
    setTeam(next);
    try {
      window.localStorage.setItem(storageKey(gameId), JSON.stringify(next));
    } catch {
      // localStorage may be unavailable (private browsing quota) — the team
      // still works for the session
    }
  };

  const hasMember = (pokemonId: number) =>
    team.some((member) => member.id === pokemonId);

  const addMember = (pokemon: Pokemon) => {
    if (team.length >= MAX_TEAM_SIZE || hasMember(pokemon.id)) return;
    // Store a slim copy — enough to render slots and run the type analysis
    persist([
      ...team,
      {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types,
        sprite_url: pokemon.sprite_url,
        pokedex_number: pokemon.pokedex_number,
      },
    ]);
  };

  const removeMember = (pokemonId: number) =>
    persist(team.filter((member) => member.id !== pokemonId));

  const clearTeam = () => persist([]);

  return {
    team,
    addMember,
    removeMember,
    clearTeam,
    hasMember,
    isFull: team.length >= MAX_TEAM_SIZE,
  };
}
