import styled from "styled-components";
import { useParams } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import { PokemonPager } from "../components/pokemon/PokemonPager";
import { useAppContext } from "../hooks/useAppContext";
import { useGames } from "../hooks/useGames";
import { useRouteGame } from "../hooks/useRouteGame";

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
`;

export function PokemonDetailPage() {
  const { pokemonName, gameId } = useParams<{
    pokemonName: string;
    gameId: string;
  }>();
  const { selectedGame } = useAppContext();
  const { data: games, isLoading: gamesLoading } = useGames();
  const { game: routeGame } = useRouteGame();

  if (!pokemonName) return null;

  // Wait for the games list so the first pokemon fetch already carries the
  // right game_id (types/moves for that game).
  if (gamesLoading) {
    return (
      <LoadingContainer>
        <CircularProgress size={28} sx={{ color: "primary.main" }} />
      </LoadingContainer>
    );
  }

  const gameList = games ?? [];
  // Game-scoped URLs use their game. The game-less route (search, compare,
  // evolution links) still deserves a moves section — default to the game
  // being browsed, else the app default (mirroring GameSelector's choice).
  const game = gameId
    ? routeGame
    : (selectedGame ??
      gameList.find((g) => g.name === "scarlet") ??
      gameList[0] ??
      null);

  return <PokemonPager pokemonName={pokemonName} game={game} />;
}
