import { useState } from "react";
import styled from "styled-components";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import PanoramaFishEyeIcon from "@mui/icons-material/PanoramaFishEye";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import { useNavigate } from "react-router-dom";
import type { Pokemon } from "../types";
import { useAppContext } from "../hooks/useAppContext";
import { useFavorites } from "../hooks/useFavorites";
import { useFavoriteMutations } from "../hooks/useFavoriteMutations";
import { useCaughtPokemons } from "../hooks/useCaughtPokemons";
import { useCaughtMutations } from "../hooks/useCaughtMutations";
import { TypeBadge } from "./TypeBadge";
import { formatName } from "../utils/formatters";

interface PokemonCardProps {
  pokemon: Pokemon;
  gameId?: number;
  showFavoriteButton?: boolean;
}

const Card = styled.div<{ $caught: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${({ theme }) => theme.palette.background.paper};
  border-radius: 12px;
  padding: 16px 12px 12px;
  border: 2px solid
    ${({ theme, $caught }) =>
      $caught ? theme.palette.primary.main : theme.palette.divider};
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    border-color: ${({ theme }) => theme.palette.primary.main};
    box-shadow: 0 4px 12px rgba(204, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 4px 2px;

    img {
      width: 64px;
      height: 64px;
    }
  }
`;

const PokedexNum = styled.span`
  font-size: 0.68rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  font-weight: 700;
  letter-spacing: 0.04em;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    line-height: 1;
  }
`;

// Shown when the sprite fails to load (e.g. upstream throttling) — same
// footprint as the img so the card layout doesn't shift
const SpriteFallback = styled.div`
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    font-size: 40px;
    color: ${({ theme }) => theme.palette.action.disabled};
  }

  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 64px;
    height: 64px;

    svg {
      font-size: 32px;
    }
  }
`;

const PokemonName = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.primary};
  text-align: center;
  margin: 6px 0 8px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    font-size: 0.75rem;
    line-height: 1.2;
    margin: 2px 0 3px;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const TypesRow = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    row-gap: 2px;
  }
`;

// Padding makes 44px tap targets; negative offsets keep icons where they were.
const CAUGHT_ICON = 14;
const FAVORITE_ICON = 16;
const TAP_TARGET = 44;
const ICON_INSET = 8;
const caughtPad = (TAP_TARGET - CAUGHT_ICON) / 2;
const favoritePad = (TAP_TARGET - FAVORITE_ICON) / 2;

const TopLeft = styled.div`
  position: absolute;
  top: ${ICON_INSET - caughtPad}px;
  left: ${ICON_INSET - caughtPad}px;
`;

const TopRight = styled.div`
  position: absolute;
  top: ${ICON_INSET - favoritePad}px;
  right: ${ICON_INSET - favoritePad}px;
`;

export function PokemonCard({
  pokemon,
  gameId,
  showFavoriteButton = true,
}: PokemonCardProps) {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const { data: favorites = [] } = useFavorites();
  const { add: addFav, remove: removeFav } = useFavoriteMutations();
  const { data: caught = [] } = useCaughtPokemons(gameId ?? 0);
  const { catch_, uncatch } = useCaughtMutations(gameId ?? 0);
  const [spriteFailed, setSpriteFailed] = useState(false);

  const isFavorite = favorites.some((f) => f.id === pokemon.id);
  const isCaught = gameId
    ? caught.some((c) => c.pokemon_id === pokemon.id && c.game_id === gameId)
    : false;

  const handleClick = () => {
    navigate(
      gameId
        ? `/game/${gameId}/pokemon/${pokemon.name}`
        : `/pokemon/${pokemon.name}`,
    );
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorite) {
      const fav = favorites.find((f) => f.id === pokemon.id);
      if (fav?.favorite_id) removeFav.mutate(fav.favorite_id);
    } else {
      addFav.mutate(pokemon);
    }
  };

  const handleCaughtClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gameId) return;
    const existing = caught.find(
      (c) => c.pokemon_id === pokemon.id && c.game_id === gameId,
    );
    if (existing) {
      // Guard against double-clicking while an optimistic catch_ is in flight.
      // The temporary entry uses id=-1 until the server responds; calling
      // uncatch(-1) would 404. Wait for onSettled to replace it with a real id.
      if (existing.id === -1) return;
      uncatch.mutate(existing.id);
    } else {
      catch_.mutate(pokemon.id);
    }
  };

  return (
    <Card onClick={handleClick} $caught={isCaught}>
      {gameId && (
        <TopLeft>
          <Tooltip
            title={currentUser ? "" : "Sign in to track caught Pokémon"}
            placement="top"
            disableHoverListener={!!currentUser}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleCaughtClick}
                disabled={!currentUser}
                aria-label={`mark ${pokemon.name} caught`}
                aria-pressed={isCaught}
                sx={{ p: `${caughtPad}px` }}
              >
                {isCaught ? (
                  <Brightness1Icon
                    sx={{ fontSize: CAUGHT_ICON, color: "primary.main" }}
                  />
                ) : (
                  <PanoramaFishEyeIcon
                    sx={{ fontSize: CAUGHT_ICON, color: "action.disabled" }}
                  />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </TopLeft>
      )}

      {showFavoriteButton && (
        <TopRight>
          <Tooltip
            title={currentUser ? "" : "Sign in to save favorites"}
            placement="top"
            disableHoverListener={!!currentUser}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleFavoriteClick}
                disabled={!currentUser}
                aria-label={`favorite ${pokemon.name}`}
                aria-pressed={isFavorite}
                sx={{ p: `${favoritePad}px` }}
              >
                {isFavorite ? (
                  <FavoriteIcon
                    sx={{ fontSize: FAVORITE_ICON, color: "primary.main" }}
                  />
                ) : (
                  <FavoriteBorderIcon
                    sx={{ fontSize: FAVORITE_ICON, color: "action.disabled" }}
                  />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </TopRight>
      )}

      {pokemon.pokedex_number && (
        <PokedexNum>
          #{String(pokemon.pokedex_number).padStart(3, "0")}
        </PokedexNum>
      )}
      {spriteFailed ? (
        <SpriteFallback title={pokemon.name}>
          <CatchingPokemonIcon />
        </SpriteFallback>
      ) : (
        <img
          src={pokemon.sprite_url}
          alt={pokemon.name}
          loading="lazy"
          onError={() => setSpriteFailed(true)}
        />
      )}
      <PokemonName>{formatName(pokemon.name)}</PokemonName>
      <TypesRow>
        {pokemon.types.map((type) => (
          <TypeBadge key={type} type={type} size="small" />
        ))}
      </TypesRow>
    </Card>
  );
}
