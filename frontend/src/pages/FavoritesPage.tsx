import { useState, useEffect } from "react";
import styled from "styled-components";
import IconButton from "@mui/material/IconButton";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useAppContext } from "../hooks/useAppContext";
import { useFavorites } from "../hooks/useFavorites";
import { useFavoriteMutations } from "../hooks/useFavoriteMutations";
import { PokemonCard } from "../components/PokemonCard";
import { formatName } from "../utils/formatters";
import type { Pokemon } from "../types";

const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
`;

const HeaderIcon = styled(FavoriteIcon)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
  font-size: 28px !important;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const Count = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const DragItem = styled.div<{ $dragging: boolean }>`
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  cursor: grab;
  transition: opacity 0.15s ease;

  &:active {
    cursor: grabbing;
  }
`;

// Keyboard alternative to drag-and-drop: revealed on hover or when a button
// inside receives focus (so Tab users can find it), space always reserved
const MoveControls = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  height: 30px;
  opacity: 0;
  transition: opacity 0.15s ease;

  ${DragItem}:hover &,
  &:focus-within {
    opacity: 1;
  }

  svg {
    font-size: 18px;
    color: ${({ theme }) => theme.palette.text.secondary};
  }
`;

// Visually hidden, announced to screen readers on reorder
const LiveRegion = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  color: ${({ theme }) => theme.palette.text.disabled};
  gap: 16px;
`;

const EmptyIcon = styled(FavoriteIcon)`
  font-size: 48px !important;
  color: ${({ theme }) => theme.palette.action.disabled} !important;
`;

const EmptyText = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

const EmptyHint = styled.p`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.disabled};
  margin: 0;
`;

const DragHint = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.disabled};
  margin-top: 20px;
  text-align: center;
`;

export function FavoritesPage() {
  const { currentUser, signIn } = useAppContext();
  const { data: favorites = [] } = useFavorites();
  const { reorder } = useFavoriteMutations();

  // Local ordered state for optimistic drag reordering
  const [ordered, setOrdered] = useState<Pokemon[]>(favorites);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Sync ordered when the server-side favorites list changes (add/remove/load)
  useEffect(() => {
    setOrdered(favorites);
  }, [favorites]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    // Reorder in place for live visual feedback
    const next = [...ordered];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setOrdered(next);
    setDragIndex(index);
  };

  const handleDrop = () => {
    setDragIndex(null);
    reorder.mutate(ordered);
  };

  const handleDragEnd = () => {
    // Safety reset if drop fires outside a valid target
    setDragIndex(null);
  };

  // Keyboard-accessible alternative to drag and drop: moves one position and
  // persists immediately (announced via the live region below)
  const [announcement, setAnnouncement] = useState("");
  const moveByOne = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrdered(next);
    reorder.mutate(next);
    setAnnouncement(
      `${formatName(moved.name)} moved to position ${to + 1} of ${next.length}`,
    );
  };

  if (!currentUser) {
    return (
      <PageWrapper>
        <PageHeader>
          <HeaderIcon />
          <Title>Favorites</Title>
        </PageHeader>
        <EmptyState>
          <EmptyIcon />
          <EmptyText>Sign in to save and view your favorites</EmptyText>
          <GoogleLogin
            onSuccess={(res: CredentialResponse) => {
              if (res.credential) signIn(res.credential).catch(console.error);
            }}
            onError={() => console.error("Google sign-in failed")}
            shape="pill"
          />
        </EmptyState>
      </PageWrapper>
    );
  }

  if (ordered.length === 0) {
    return (
      <PageWrapper>
        <PageHeader>
          <HeaderIcon />
          <Title>Favorites</Title>
        </PageHeader>
        <EmptyState>
          <EmptyIcon />
          <EmptyText>No favorites yet</EmptyText>
          <EmptyHint>Click the ♥ on any Pokémon card to save it here</EmptyHint>
        </EmptyState>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader>
        <HeaderIcon />
        <Title>Favorites</Title>
        <Count>({ordered.length})</Count>
      </PageHeader>
      <Grid>
        {ordered.map((pokemon, index) => (
          <DragItem
            key={pokemon.id}
            $dragging={dragIndex === index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <PokemonCard pokemon={pokemon} showFavoriteButton />
            <MoveControls>
              <IconButton
                size="small"
                aria-label={`move ${pokemon.name} earlier`}
                disabled={index === 0}
                onClick={() => moveByOne(index, index - 1)}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`move ${pokemon.name} later`}
                disabled={index === ordered.length - 1}
                onClick={() => moveByOne(index, index + 1)}
              >
                <ChevronRightIcon />
              </IconButton>
            </MoveControls>
          </DragItem>
        ))}
      </Grid>
      <DragHint>
        Drag cards — or use a card's arrow buttons — to reorder your favorites
      </DragHint>
      <LiveRegion aria-live="polite">{announcement}</LiveRegion>
    </PageWrapper>
  );
}
