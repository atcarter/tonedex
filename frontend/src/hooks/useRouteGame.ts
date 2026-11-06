// src/hooks/useRouteGame.ts
import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Game } from "../types";
import { useGames } from "./useGames";

const NUMERIC = /^\d+$/;

// A game URL segment is the game's name; a numeric id is the legacy form.
export function findGame(games: Game[], segment: string): Game | null {
  return (
    games.find((g) =>
      NUMERIC.test(segment) ? g.id === Number(segment) : g.name === segment,
    ) ?? null
  );
}

// Resolves the :gameId route segment to a game, and rewrites a legacy id URL
// to the name form in place.
export function useRouteGame() {
  const { gameId: segment = "" } = useParams<{ gameId: string }>();
  const { data: games, isPending, error } = useGames();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  const game = games ? findGame(games, segment) : null;
  const gameId = game?.id ?? 0;

  useEffect(() => {
    if (game && segment !== game.name) {
      navigate(
        {
          pathname: pathname.replace(`/game/${segment}`, `/game/${game.name}`),
          search,
          hash,
        },
        { replace: true },
      );
    }
  }, [game, segment, pathname, search, hash, navigate]);

  // slug is the segment links should use; it is the name once the list loads
  const slug = game?.name ?? segment;

  return {
    game,
    gameId,
    slug,
    isPending,
    notFound: !!games && !game,
    error,
  };
}
