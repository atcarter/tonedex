import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { Game } from "../../types";
import { PokemonDetail } from "../PokemonDetail";
import { ErrorBoundary } from "../ErrorBoundary";

const PageWrapper = styled.div`
  /* A centred flex item shrinks to its content; fill up to the max instead */
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
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

interface PokemonPagerProps {
  pokemonName: string;
  game: Game | null;
}

// The detail page once the games list has loaded
export function PokemonPager({ pokemonName, game }: PokemonPagerProps) {
  const navigate = useNavigate();

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
