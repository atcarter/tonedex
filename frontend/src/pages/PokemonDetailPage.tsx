import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PokemonDetail } from "../components/PokemonDetail";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useGames } from "../hooks/useGames";

const PageWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;

  @media (min-width: 600px) {
    padding: 24px;
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
  const { data: games, isLoading: gamesLoading } = useGames();

  if (!pokemonName) return null;

  const numericGameId = gameId ? Number(gameId) : undefined;

  // When the URL scopes to a game, wait for the games list so the first
  // pokemon fetch already carries game_id (types/moves for that game).
  if (numericGameId && gamesLoading) {
    return (
      <LoadingContainer>
        <CircularProgress size={28} sx={{ color: "primary.main" }} />
      </LoadingContainer>
    );
  }

  const game = numericGameId
    ? ((games ?? []).find((g) => g.id === numericGameId) ?? null)
    : null;

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
