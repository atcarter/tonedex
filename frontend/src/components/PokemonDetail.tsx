import { useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import PanoramaFishEyeIcon from "@mui/icons-material/PanoramaFishEye";
import type { IconButtonProps } from "@mui/material/IconButton";
import type { Game } from "../types";
import { useAppContext } from "../hooks/useAppContext";
import { usePokemon } from "../hooks/usePokemon";
import { useDexView, dexSearch } from "../hooks/useDexView";
import { MythicalTag } from "./MythicalTag";
import { useCaughtMutations } from "../hooks/useCaughtMutations";
import { useCaughtPokemons } from "../hooks/useCaughtPokemons";
import { StatBars } from "./pokemon/StatBars";
import { EvolutionChain } from "./pokemon/EvolutionChain";
import { MoveTable } from "./pokemon/MoveTable";
import { AbilityList } from "./pokemon/AbilityList";
import { AboutItem, AboutLabel } from "./pokemon/aboutStyles";
import { TypeBadge } from "./TypeBadge";
import { formatName } from "../utils/formatters";
import { isPreAbilityGeneration } from "../utils/abilities";

interface PokemonDetailProps {
  pokemonName: string;
  // null renders the game-agnostic view (no moves section, national types)
  game: Game | null;
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
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const RedSpinner = styled(CircularProgress)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
`;

const ErrorCard = styled(Paper)`
  padding: 24px !important;
  border-radius: 12px !important;
`;

const ErrorMessage = styled.span`
  color: ${({ theme }) => theme.palette.error.main};
  font-size: 0.875rem;
`;

const SectionPaper = styled(Paper)`
  padding: 20px 24px !important;
  margin-bottom: 16px !important;
  border-radius: 12px !important;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px !important;
  }
`;

const SectionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.primary.main};
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
    background: ${({ theme }) => theme.palette.divider};
    border-radius: 1px;
  }
`;

// ── Header ───────────────────────────────────────────────────────────────────

const PokemonHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px 24px;
  background: ${({ theme }) => theme.palette.background.paper};
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 5px solid ${({ theme }) => theme.palette.primary.main};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-direction: column;
    gap: 12px;
    padding: 20px 16px;
    text-align: center;
  }
`;

const SpriteWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const SpriteCircle = styled.div`
  background: ${({ theme }) => theme.palette.action.hover};
  border-radius: 50%;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid ${({ theme }) => theme.palette.divider};

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
  background: ${({ theme, $active }) =>
    $active
      ? theme.palette.primary.main
      : theme.palette.background.paper} !important;
  border: 2px solid ${({ theme }) => theme.palette.divider} !important;

  &:hover {
    background: ${({ theme, $active }) =>
      $active
        ? theme.palette.primary.dark
        : theme.palette.action.hover} !important;
  }

  svg {
    font-size: 14px;
    color: ${({ theme, $active }) =>
      $active
        ? theme.palette.primary.contrastText
        : theme.palette.text.disabled};
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    align-items: center;
  }
`;

const DexNumber = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};
  letter-spacing: 0.08em;
  margin-bottom: 2px;
`;

const PokemonName = styled.h2`
  font-size: 2rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  line-height: 1.1;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
`;

const HeaderTag = styled(MythicalTag)`
  align-self: flex-start;
  margin-bottom: 8px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    align-self: center;
  }
`;

const Genus = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: -8px 0 10px;
`;

const TypeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    justify-content: center;
  }
`;

// ── About section ────────────────────────────────────────────────────────────

const FlavorText = styled.p`
  font-size: 0.9rem;
  line-height: 1.55;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0 0 16px;
`;

const AboutGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
`;

const AboutValue = styled.span`
  font-size: 0.9rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.primary};
`;

const CaughtBadge = styled.button<{ $caught: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 2px solid
    ${({ theme, $caught }) =>
      $caught ? theme.palette.primary.main : theme.palette.divider};
  background: ${({ theme, $caught }) =>
    $caught ? alpha(theme.palette.primary.main, 0.08) : "transparent"};
  color: ${({ theme, $caught }) =>
    $caught ? theme.palette.primary.main : theme.palette.text.disabled};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  align-self: flex-start;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    align-self: center;
    min-height: 44px;
  }

  &:hover {
    border-color: ${({ theme }) => theme.palette.primary.main};
    color: ${({ theme }) => theme.palette.primary.main};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
    &:hover {
      border-color: ${({ theme }) => theme.palette.divider};
      color: ${({ theme }) => theme.palette.text.disabled};
    }
  }

  svg {
    font-size: 12px;
  }
`;

// ── Component ────────────────────────────────────────────────────────────────

export function PokemonDetail({ pokemonName, game }: PokemonDetailProps) {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId?: string }>();
  const { currentUser } = useAppContext();

  const numericGameId = gameId ? Number(gameId) : undefined;
  // Regional or national number, as on the game page this came from
  const [dex] = useDexView();

  const { data, isLoading, isError, error } = usePokemon(
    pokemonName,
    game?.id,
    dex,
  );
  const { data: caught = [] } = useCaughtPokemons(numericGameId ?? 0);
  const { catch_, uncatch } = useCaughtMutations(numericGameId ?? 0);

  const [expandedMove, setExpandedMove] = useState<string | null>(null);
  const [showShiny, setShowShiny] = useState(false);

  // Details are fetched by the expanded MoveRow itself (useMove) — this only
  // tracks which row is open.
  const handleMoveClick = (moveName: string) => {
    setExpandedMove((prev) => (prev === moveName ? null : moveName));
  };

  const handleEvoClick = (name: string) => {
    if (name === pokemonName) return;
    navigate(
      gameId
        ? `/game/${gameId}/pokemon/${name}${dexSearch(dex)}`
        : `/pokemon/${name}`,
    );
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

  const { pokemon: details, species, moves, evolution_chain } = data;
  const dexNumber = details.pokedex_number;
  const hasAboutSection =
    species &&
    (species.flavor_text ||
      species.abilities.length > 0 ||
      isPreAbilityGeneration(game?.generation));
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
          {species?.genus && <Genus>{species.genus}</Genus>}
          {details.mythical && <HeaderTag />}
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

      {hasAboutSection && (
        <SectionPaper elevation={1}>
          <SectionTitle>About</SectionTitle>
          {species.flavor_text && (
            <FlavorText>{species.flavor_text}</FlavorText>
          )}
          <AboutGrid>
            {species.height != null && (
              <AboutItem>
                <AboutLabel>Height</AboutLabel>
                <AboutValue>{(species.height / 10).toFixed(1)} m</AboutValue>
              </AboutItem>
            )}
            {species.weight != null && (
              <AboutItem>
                <AboutLabel>Weight</AboutLabel>
                <AboutValue>{(species.weight / 10).toFixed(1)} kg</AboutValue>
              </AboutItem>
            )}
            <AbilityList
              key={details.name}
              abilities={species.abilities}
              generation={game?.generation ?? null}
            />
          </AboutGrid>
        </SectionPaper>
      )}

      <SectionPaper elevation={1}>
        <SectionTitle>Evolution Chain</SectionTitle>
        <EvolutionChain
          chain={evolution_chain}
          currentName={pokemonName}
          onSelect={handleEvoClick}
        />
      </SectionPaper>

      <SectionPaper elevation={1}>
        <SectionTitle>Base Stats</SectionTitle>
        <StatBars baseStats={details.base_stats} />
      </SectionPaper>

      {game && (
        <SectionPaper elevation={1}>
          <SectionTitle>
            Moves in {formatName(game.name)} ({moves.length})
          </SectionTitle>
          <MoveTable
            moves={moves}
            expandedMove={expandedMove}
            onMoveClick={handleMoveClick}
          />
        </SectionPaper>
      )}
    </DetailWrapper>
  );
}
