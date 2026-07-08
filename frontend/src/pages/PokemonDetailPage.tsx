import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PokemonDetail } from "../components/PokemonDetail";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useGames } from "../hooks/useGames";
import type { Game, Pokemon } from "../types";

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

export function PokemonDetailPage() {
  const { pokemonName, gameId } = useParams<{
    pokemonName: string;
    gameId: string;
  }>();
  const navigate = useNavigate();
  const { data: games = [] } = useGames();

  if (!pokemonName) return null;

  const numericGameId = gameId ? Number(gameId) : undefined;

  const game: Game = numericGameId
    ? (games.find((g) => g.id === numericGameId) ?? {
        id: numericGameId,
        name: "unknown",
        generation: 0,
        region: "",
      })
    : { id: 0, name: "any", generation: 0, region: "" };

  const pokemon: Pokemon = {
    id: 0,
    name: pokemonName,
    types: [],
    sprite_url: "",
  };

  return (
    <PageWrapper>
      <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
        Back
      </BackButton>
      <ErrorBoundary>
        <PokemonDetail pokemon={pokemon} game={game} />
      </ErrorBoundary>
    </PageWrapper>
  );
}
