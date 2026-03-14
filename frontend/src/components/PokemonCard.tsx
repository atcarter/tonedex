import styled from "styled-components";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Brightness1Icon from "@mui/icons-material/Brightness1";
import PanoramaFishEyeIcon from "@mui/icons-material/PanoramaFishEye";
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
  background: white;
  border-radius: 12px;
  padding: 16px 12px 12px;
  border: 2px solid ${({ $caught }) => ($caught ? "#cc0000" : "#f0f0f0")};
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    border-color: #cc0000;
    box-shadow: 0 4px 12px rgba(204, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;

const PokedexNum = styled.span`
  font-size: 0.68rem;
  color: #bbb;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const PokemonName = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: #1a1a1a;
  text-align: center;
  margin: 6px 0 8px;
`;

const TypesRow = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
`;

const TopLeft = styled.div`
  position: absolute;
  top: 4px;
  left: 4px;
`;

const TopRight = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
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

  const isFavorite = favorites.some((f) => f.id === pokemon.id);
  const isCaught = gameId
    ? caught.some((c) => c.pokemon_id === pokemon.id && c.game_id === gameId)
    : false;

  const handleClick = () => {
    navigate(gameId ? `/game/${gameId}/pokemon/${pokemon.name}` : `/pokemon/${pokemon.name}`);
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
                sx={{ p: "4px" }}
              >
                {isCaught ? (
                  <Brightness1Icon sx={{ fontSize: 14, color: "#cc0000" }} />
                ) : (
                  <PanoramaFishEyeIcon sx={{ fontSize: 14, color: "#ddd" }} />
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
                sx={{ p: "4px" }}
              >
                {isFavorite ? (
                  <FavoriteIcon sx={{ fontSize: 16, color: "#cc0000" }} />
                ) : (
                  <FavoriteBorderIcon sx={{ fontSize: 16, color: "#ccc" }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </TopRight>
      )}

      {pokemon.pokedex_number && (
        <PokedexNum>#{String(pokemon.pokedex_number).padStart(3, "0")}</PokedexNum>
      )}
      <img src={pokemon.sprite_url} alt={pokemon.name} />
      <PokemonName>{formatName(pokemon.name)}</PokemonName>
      <TypesRow>
        {pokemon.types.map((type) => (
          <TypeBadge key={type} type={type} size="small" />
        ))}
      </TypesRow>
    </Card>
  );
}
