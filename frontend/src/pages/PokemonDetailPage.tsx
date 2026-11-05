import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PokemonDetail } from "../components/PokemonDetail";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useAppContext } from "../hooks/useAppContext";
import { useGames } from "../hooks/useGames";

const PageWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    /* A centred flex item shrinks to its content; phones fill the screen */
    width: 100%;
    padding: 16px max(16px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
  }
`;

const BackButton = styled(Button)`
  margin-bottom: 16px !important;
  color: ${({ theme }) => theme.palette.primary.main} !important;
  font-weight: 600 !important;
` as typeof Button;

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
  const navigate = useNavigate();
  const { selectedGame } = useAppContext();
  const { data: games, isLoading: gamesLoading } = useGames();

  if (!pokemonName) return null;

  const numericGameId = gameId ? Number(gameId) : undefined;

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
  const game = numericGameId
    ? (gameList.find((g) => g.id === numericGameId) ?? null)
    : (selectedGame ??
      gameList.find((g) => g.name === "scarlet") ??
      gameList[0] ??
      null);

  return (
    <PageWrapper>
      <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
        Back
      </BackButton>
      <ErrorBoundary>
        <PokemonDetail pokemonName={pokemonName} game={game} />
      </ErrorBoundary>
    </PageWrapper>
  );
}
