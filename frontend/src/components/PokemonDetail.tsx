import { useState, useCallback } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import PanoramaFishEyeIcon from "@mui/icons-material/PanoramaFishEye";
import type { IconButtonProps } from "@mui/material/IconButton";
import type { Game, Pokemon } from "../types";
import { getMove } from "../services/api";
import { useAppContext } from "../hooks/useAppContext";
import { usePokemon } from "../hooks/usePokemon";
import { useCaughtMutations } from "../hooks/useCaughtMutations";
import { useCaughtPokemons } from "../hooks/useCaughtPokemons";
import { StatBars } from "./pokemon/StatBars";
import { EvolutionChain } from "./pokemon/EvolutionChain";
import { MoveTable } from "./pokemon/MoveTable";
import { TypeBadge } from "./TypeBadge";
import { formatName } from "../utils/formatters";

interface PokemonDetailProps {
  pokemon: Pokemon;
  game: Game;
}

// ── Layout ───────────────────────────────────────────────────────────────────

const DetailWrapper = styled.div`
  max-width: 860px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 12px;
`;

const LoadingText = styled.span`
  font-size: 0.875rem;
  color: #888;
`;

const RedSpinner = styled(CircularProgress)`
  color: #cc0000 !important;
`;

const ErrorCard = styled(Paper)`
  padding: 24px !important;
  border-radius: 12px !important;
`;

const ErrorMessage = styled.span`
  color: #cc0000;
  font-size: 0.875rem;
`;

const SectionPaper = styled(Paper)`
  padding: 20px 24px !important;
  margin-bottom: 16px !important;
  border-radius: 12px !important;
`;

const SectionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #cc0000;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;

  &::after {
    content: "";
    flex: 1;
    height: 2px;
    background: #f0f0f0;
    border-radius: 1px;
  }
`;

// ── Header ───────────────────────────────────────────────────────────────────

const PokemonHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 5px solid #cc0000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const SpriteWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const SpriteCircle = styled.div`
  background: #f5f5f5;
  border-radius: 50%;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #e8e8e8;

  img {
    width: 100px;
    height: 100px;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;

const ShinyButton = styled(IconButton)<IconButtonProps & { $active: boolean }>`
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
  width: 28px !important;
  height: 28px !important;
  background: ${(props) => (props.$active ? "#cc0000" : "white")} !important;
  border: 2px solid #e8e8e8 !important;

  &:hover {
    background: ${(props) =>
      props.$active ? "#aa0000" : "#f5f5f5"} !important;
  }

  svg {
    font-size: 14px;
    color: ${(props) => (props.$active ? "white" : "#aaa")};
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const DexNumber = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #888;
  letter-spacing: 0.08em;
  margin-bottom: 2px;
`;

const PokemonName = styled.h2`
  font-size: 2rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
  margin: 0 0 12px;
`;

const TypeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const CaughtBadge = styled.button<{ $caught: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 2px solid ${({ $caught }) => ($caught ? "#cc0000" : "#ddd")};
  background: ${({ $caught }) => ($caught ? "#fff0f0" : "transparent")};
  color: ${({ $caught }) => ($caught ? "#cc0000" : "#aaa")};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  align-self: flex-start;

  &:hover {
    border-color: #cc0000;
    color: #cc0000;
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
    &:hover {
      border-color: #ddd;
      color: #aaa;
    }
  }

  svg {
    font-size: 12px;
  }
`;

// ── Component ────────────────────────────────────────────────────────────────

export function PokemonDetail({ pokemon, game }: PokemonDetailProps) {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId?: string }>();
  const { moveCache, cacheMoveDetails, currentUser } = useAppContext();

  const numericGameId = gameId ? Number(gameId) : undefined;

  const { data, isLoading, isError, error } = usePokemon(
    pokemon.name,
    game.id || undefined,
  );
  const { data: caught = [] } = useCaughtPokemons(numericGameId ?? 0);
  const { catch_, uncatch } = useCaughtMutations(numericGameId ?? 0);

  const [expandedMove, setExpandedMove] = useState<string | null>(null);
  const [loadingMove, setLoadingMove] = useState<string | null>(null);
  const [showShiny, setShowShiny] = useState(false);

  const handleMoveClick = useCallback(
    async (moveName: string) => {
      if (expandedMove === moveName) {
        setExpandedMove(null);
        return;
      }
      setExpandedMove(moveName);
      if (!moveCache[moveName]) {
        setLoadingMove(moveName);
        try {
          const details = await getMove(moveName);
          cacheMoveDetails(moveName, details);
        } catch (err) {
          console.error(`Failed to load move details for ${moveName}:`, err);
        } finally {
          setLoadingMove(null);
        }
      }
    },
    [expandedMove, moveCache, cacheMoveDetails],
  );

  const handleEvoClick = (name: string) => {
    if (name === pokemon.name) return;
    navigate(gameId ? `/game/${gameId}/pokemon/${name}` : `/pokemon/${name}`);
  };

  if (isLoading)
    return (
      <LoadingContainer>
        <RedSpinner size={28} />
        <LoadingText>Loading Pokémon...</LoadingText>
      </LoadingContainer>
    );

  if (isError)
    return (
      <ErrorCard elevation={1}>
        <ErrorMessage>
          Error: {error instanceof Error ? error.message : "Failed to load"}
        </ErrorMessage>
      </ErrorCard>
    );

  if (!data) return null;

  const { pokemon: details, moves, evolution_chain } = data;
  const dexNumber = pokemon.pokedex_number ?? details.pokedex_number;
  const isCaught = numericGameId
    ? caught.some(
        (c) => c.pokemon_id === details.id && c.game_id === numericGameId,
      )
    : false;

  return (
    <DetailWrapper>
      <PokemonHeader>
        <SpriteWrapper>
          <SpriteCircle>
            <img
              src={
                showShiny && details.shiny_sprite_url
                  ? details.shiny_sprite_url
                  : details.sprite_url
              }
              alt={details.name}
            />
          </SpriteCircle>
          {details.shiny_sprite_url && (
            <Tooltip title={showShiny ? "Show normal" : "Show shiny"}>
              <ShinyButton
                size="small"
                $active={showShiny}
                onClick={() => setShowShiny((s) => !s)}
              >
                <AutoAwesomeIcon />
              </ShinyButton>
            </Tooltip>
          )}
        </SpriteWrapper>

        <HeaderInfo>
          {dexNumber && (
            <DexNumber>#{String(dexNumber).padStart(3, "0")}</DexNumber>
          )}
          <PokemonName>{formatName(details.name)}</PokemonName>
          <TypeList>
            {details.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </TypeList>
          {numericGameId && (
            <Tooltip
              title={currentUser ? "" : "Sign in to track caught Pokémon"}
              placement="bottom-start"
              disableHoverListener={!!currentUser}
            >
              <span>
                <CaughtBadge
                  $caught={isCaught}
                  disabled={!currentUser}
                  onClick={() => {
                    if (!currentUser || !numericGameId) return;
                    const existing = caught.find(
                      (c) =>
                        c.pokemon_id === details.id &&
                        c.game_id === numericGameId,
                    );
                    if (existing) {
                      if (existing.id === -1) return; // optimistic in-flight
                      uncatch.mutate(existing.id);
                    } else {
                      catch_.mutate(details.id);
                    }
                  }}
                >
                  {isCaught ? <Brightness1Icon /> : <PanoramaFishEyeIcon />}
                  {isCaught ? "Caught" : "Not caught"}
                </CaughtBadge>
              </span>
            </Tooltip>
          )}
        </HeaderInfo>
      </PokemonHeader>

      <SectionPaper elevation={1}>
        <SectionTitle>Evolution Chain</SectionTitle>
        <EvolutionChain
          chain={evolution_chain}
          currentName={pokemon.name}
          onSelect={handleEvoClick}
        />
      </SectionPaper>

      <SectionPaper elevation={1}>
        <SectionTitle>Base Stats</SectionTitle>
        <StatBars baseStats={details.base_stats} />
      </SectionPaper>

      <SectionPaper elevation={1}>
        <SectionTitle>
          Moves in {formatName(game.name)} ({moves.length})
        </SectionTitle>
        <MoveTable
          moves={moves}
          expandedMove={expandedMove}
          loadingMove={loadingMove}
          moveCache={moveCache}
          onMoveClick={handleMoveClick}
        />
      </SectionPaper>
    </DetailWrapper>
  );
}
