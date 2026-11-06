import { useState } from "react";
import styled from "styled-components";
import IconButton from "@mui/material/IconButton";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useAppContext } from "../hooks/useAppContext";
import { useFavorites } from "../hooks/useFavorites";
import { useFavoriteMutations } from "../hooks/useFavoriteMutations";
import { moveItem, usePointerReorder } from "../hooks/usePointerReorder";
import { PokemonCard } from "../components/PokemonCard";
import { formatName } from "../utils/formatters";
import type { Pokemon } from "../types";

const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px max(16px, env(safe-area-inset-right))
      max(24px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
  }
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

// The card's 100% height fills the first row, so the controls stay in the cell
const DragItem = styled.div<{ $dragging: boolean }>`
  display: grid;
  grid-template-rows: 1fr auto;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  cursor: grab;
  transition: opacity 0.15s ease;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

// Touch and pen drag from here; elsewhere a swipe scrolls the page
const DragHandle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  touch-action: none;
  -webkit-touch-callout: none;
`;

// Move buttons (the keyboard alternative) and the drag handle: revealed on hover
// or when a button inside receives focus (so Tab users can find it), space always reserved
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

  /* Touch screens have no hover */
  @media (hover: none) {
    opacity: 1;
  }

  ${({ theme }) => theme.breakpoints.down("sm")} {
    height: auto;
    margin-top: 4px;
    opacity: 1;

    .MuiIconButton-root,
    ${DragHandle} {
      min-width: 44px;
      min-height: 44px;
    }
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
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

const DragHint = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin-top: 20px;
  text-align: center;
`;

// Stable fallback so the sync check below doesn't see a new [] every render
const NO_FAVORITES: Pokemon[] = [];

export function FavoritesPage() {
  const { currentUser, signIn } = useAppContext();
  const { data } = useFavorites();
  const favorites = data ?? NO_FAVORITES;
  const { reorder } = useFavoriteMutations();

  // Local ordered state for optimistic drag reordering
  const [ordered, setOrdered] = useState<Pokemon[]>(favorites);
  const [syncedFrom, setSyncedFrom] = useState<Pokemon[]>(favorites);

  // Re-sync ordered during render when the server list changes (add/remove/load)
  if (favorites !== syncedFrom) {
    setSyncedFrom(favorites);
    setOrdered(favorites);
  }

  // Reorders live while dragging and saves on drop
  const { dragIndex, itemProps } = usePointerReorder(
    ordered,
    setOrdered,
    reorder.mutate,
  );

  // Keyboard-accessible alternative to drag and drop: moves one position and
  // persists immediately (announced via the live region below)
  const [announcement, setAnnouncement] = useState("");
  const moveByOne = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return;
    const next = moveItem(ordered, from, to);
    const moved = next[to];
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
            {...itemProps(index)}
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
              <DragHandle data-reorder-handle aria-hidden="true">
                <DragIndicatorIcon />
              </DragHandle>
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
        Drag a card by its handle — or use its arrow buttons — to reorder your
        favorites
      </DragHint>
      <LiveRegion aria-live="polite">{announcement}</LiveRegion>
    </PageWrapper>
  );
}
