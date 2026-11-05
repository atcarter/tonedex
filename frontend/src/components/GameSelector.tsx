import { useEffect, useRef } from "react";
import styled from "styled-components";
import {
  useNavigate,
  useMatch,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ListSubheader from "@mui/material/ListSubheader";
import type { Game } from "../types";
import { useAppContext } from "../hooks/useAppContext";
import { useGames } from "../hooks/useGames";
import { getPokemon } from "../services/api";
import { pokemonQueryKey } from "../hooks/usePokemon";
import { parseDexView, dexSearch } from "../hooks/useDexView";

const StyledFormControl = styled(FormControl)`
  min-width: 200px;

  /* Phones: fill the header row's flexible slot */
  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-width: 0;
    width: 100%;
  }

  .MuiOutlinedInput-root {
    background: rgba(255, 255, 255, 0.15);
    color: white;

    fieldset {
      border-color: rgba(255, 255, 255, 0.4);
    }
    &:hover fieldset {
      border-color: rgba(255, 255, 255, 0.8);
    }
    &.Mui-focused fieldset {
      border-color: white;
    }
  }

  .MuiSelect-icon {
    color: white;
  }
`;

export function GameSelector() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  // The dex view carries over to the new game
  const dex = parseDexView(searchParams.get("dex"));
  const { setSelectedGame } = useAppContext();
  const { data: games = [], isLoading, isError, error } = useGames();
  const queryClient = useQueryClient();
  const teamMatch = useMatch("/game/:gameId/team");
  const detailMatch = useMatch("/game/:gameId/pokemon/:pokemonName");
  // Bumped per switch and per navigation so a stale membership check can't redirect.
  const switchRequest = useRef(0);
  useEffect(() => {
    switchRequest.current++;
  }, [pathname]);

  // Derive the active game ID from the URL — this is the source of truth.
  // Match both /game/:gameId and deeper routes like /game/:gameId/pokemon/:name
  // so the selector stays on the right game while viewing a Pokémon detail.
  const gameMatch = useMatch("/game/:gameId");
  const gameSubMatch = useMatch("/game/:gameId/*");
  const matchedGameId = (gameMatch ?? gameSubMatch)?.params.gameId;
  const urlGameId = matchedGameId ? Number(matchedGameId) : null;

  // Auto-navigate to scarlet (or first game) when landing on the bare root.
  // Scoped strictly to "/" — navigating from any other game-less route (e.g.
  // /pokemon/:name or /favorites) must not hijack the user's location.
  // Must be inside useEffect — calling navigate/setSelectedGame during render
  // causes the React "state update during render" error.
  useEffect(() => {
    if (games.length > 0 && pathname === "/") {
      const scarlet = games.find((g: Game) => g.name === "scarlet");
      const defaultGame = scarlet ?? games[0];
      if (defaultGame) {
        setSelectedGame(defaultGame);
        navigate(`/game/${defaultGame.id}`, { replace: true });
      }
    }
  }, [games, pathname, setSelectedGame, navigate]);

  // Team builder and detail page keep their page for the new game when they can.
  const switchGame = async (game: Game) => {
    const request = ++switchRequest.current;
    const go = (path: string) => {
      if (request !== switchRequest.current) return;
      setSelectedGame(game);
      navigate(path);
    };

    const search = dexSearch(dex);
    if (teamMatch) return go(`/game/${game.id}/team${search}`);

    const name = detailMatch?.params.pokemonName;
    if (!name) return go(`/game/${game.id}${search}`);

    try {
      // Same query as usePokemon, so the detail page renders from cache.
      const data = await queryClient.fetchQuery({
        queryKey: pokemonQueryKey(name, game.id, dex),
        queryFn: () => getPokemon(name, game.id, dex),
        staleTime: Infinity,
      });
      go(
        data.pokemon.pokedex_number != null
          ? `/game/${game.id}/pokemon/${name}${search}`
          : `/game/${game.id}${search}`,
      );
    } catch {
      go(`/game/${game.id}${search}`);
    }
  };

  if (isLoading)
    return (
      <span style={{ color: "white", fontSize: "0.875rem" }}>
        Loading games...
      </span>
    );
  if (isError)
    return (
      <span style={{ color: "#ffcdd2" }}>
        Error: {error instanceof Error ? error.message : "Failed to load"}
      </span>
    );

  const gamesByGeneration = games.reduce<Record<number, Game[]>>(
    (acc, game) => {
      const gen = game.generation;
      if (!acc[gen]) acc[gen] = [];
      acc[gen].push(game);
      return acc;
    },
    {},
  );

  const menuItems = Object.entries(gamesByGeneration)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([gen, genGames]) => [
      <ListSubheader
        key={`gen-${gen}`}
        sx={{
          bgcolor: "background.default",
          lineHeight: "30px",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "text.secondary",
        }}
      >
        GENERATION {gen}
      </ListSubheader>,
      ...genGames.map((game: Game) => (
        <MenuItem key={game.id} value={game.id} dense>
          {formatGameName(game.name)}
        </MenuItem>
      )),
    ]);

  return (
    <StyledFormControl size="small">
      <Select
        value={urlGameId ?? ""}
        onChange={(e) => {
          const game = games.find((g: Game) => g.id === Number(e.target.value));
          if (game) void switchGame(game);
        }}
        displayEmpty
        inputProps={{ "aria-label": "select game" }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 400 } } }}
      >
        <MenuItem value="" disabled>
          <em>Choose a game</em>
        </MenuItem>
        {menuItems}
      </Select>
    </StyledFormControl>
  );
}

function formatGameName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
