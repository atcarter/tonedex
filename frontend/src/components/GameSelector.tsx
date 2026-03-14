import { useEffect } from "react";
import styled from "styled-components";
import { useNavigate, useMatch } from "react-router-dom";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ListSubheader from "@mui/material/ListSubheader";
import type { Game } from "../types";
import { useAppContext } from "../hooks/useAppContext";
import { useGames } from "../hooks/useGames";

const StyledFormControl = styled(FormControl)`
  min-width: 200px;

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
  const { setSelectedGame } = useAppContext();
  const { data: games = [], isLoading, isError, error } = useGames();

  // Derive the active game ID from the URL — this is the source of truth.
  const gameMatch = useMatch("/game/:gameId");
  const urlGameId = gameMatch ? Number(gameMatch.params.gameId) : null;

  // Auto-navigate to scarlet (or first game) when no game is in the URL and
  // games have loaded. Must be inside useEffect — calling navigate/setSelectedGame
  // during render causes the React "state update during render" error.
  useEffect(() => {
    if (games.length > 0 && !urlGameId) {
      const scarlet = games.find((g: Game) => g.name === "scarlet");
      const defaultGame = scarlet ?? games[0];
      if (defaultGame) {
        setSelectedGame(defaultGame);
        navigate(`/game/${defaultGame.id}`, { replace: true });
      }
    }
  }, [games, urlGameId, setSelectedGame, navigate]);

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

  const gamesByGeneration = games.reduce<Record<number, Game[]>>((acc, game) => {
    const gen = game.generation;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(game);
    return acc;
  }, {});

  const menuItems = Object.entries(gamesByGeneration)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([gen, genGames]) => [
      <ListSubheader
        key={`gen-${gen}`}
        sx={{
          bgcolor: "#f5f5f5",
          lineHeight: "30px",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#999",
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
          if (game) {
            setSelectedGame(game);
            navigate(`/game/${game.id}`);
          }
        }}
        displayEmpty
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
