import { useRef, useState, useEffect } from "react";
import styled from "styled-components";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useAppContext } from "../hooks/useAppContext";
import { useFavorites } from "../hooks/useFavorites";
import { useFavoriteMutations } from "../hooks/useFavoriteMutations";
import { PokemonCard } from "../components/PokemonCard";
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
  color: #cc0000 !important;
  font-size: 28px !important;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
`;

const Count = styled.span`
  font-size: 0.875rem;
  color: #888;
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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  color: #bbb;
  gap: 16px;
`;

const EmptyIcon = styled(FavoriteIcon)`
  font-size: 48px !important;
  color: #e0e0e0 !important;
`;

const EmptyText = styled.p`
  font-size: 1rem;
  color: #888;
  margin: 0;
`;

const EmptyHint = styled.p`
  font-size: 0.875rem;
  color: #bbb;
  margin: 0;
`;

const DragHint = styled.p`
  font-size: 0.75rem;
  color: #bbb;
  margin-top: 20px;
  text-align: center;
`;

export function FavoritesPage() {
  const { currentUser, signIn } = useAppContext();
  const { data: favorites = [] } = useFavorites();
  const { reorder } = useFavoriteMutations();

  // Local ordered state for optimistic drag reordering
  const [ordered, setOrdered] = useState<Pokemon[]>(favorites);
  const dragIndex = useRef<number | null>(null);

  // Sync when favorites change externally (add/remove)
  useEffect(() => setOrdered(favorites), [favorites]);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;

    // Reorder in place for live visual feedback
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setOrdered(next);
    dragIndex.current = index;
  };

  const handleDrop = () => {
    dragIndex.current = null;
    reorder.mutate(ordered);
  };

  const handleDragEnd = () => {
    // Safety reset if drop fires outside a valid target
    dragIndex.current = null;
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
            $dragging={dragIndex.current === index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <PokemonCard pokemon={pokemon} showFavoriteButton />
          </DragItem>
        ))}
      </Grid>
      <DragHint>Drag cards to reorder your favorites</DragHint>
    </PageWrapper>
  );
}
