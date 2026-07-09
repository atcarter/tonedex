import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import styled from "styled-components";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import type { Pokemon } from "../types";
import { TYPE_COLORS } from "../constants/typeColors";
import { useAppContext } from "../hooks/useAppContext";
import { useGames } from "../hooks/useGames";
import { useGame } from "../hooks/useGame";
import { useCaughtPokemons } from "../hooks/useCaughtPokemons";
import { PokemonCard } from "../components/PokemonCard";

const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
`;

const FilterBar = styled.div`
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const Sentinel = styled.div`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  color: ${({ theme }) => theme.palette.text.disabled};
  font-size: 0.8rem;
  gap: 8px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 12px;
`;

const LoadingText = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const RedSpinner = styled(CircularProgress)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.palette.error.main};
  font-size: 0.875rem;
  padding: 24px;
  margin: 0;
`;

const CountText = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const CaughtCounter = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const CaughtDot = styled.span`
  color: ${({ theme }) => theme.palette.primary.main};
  font-size: 0.6rem;
  line-height: 1;
`;

const TypeFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
`;

// Amber tones stay recognisable as a "heads up" in both color modes
const SeedingBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(255, 193, 7, 0.12);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { setSelectedGame, currentUser } = useAppContext();
  const { data: games = [] } = useGames();

  const numericGameId = Number(gameId);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGame(numericGameId);

  const { data: caught = [] } = useCaughtPokemons(numericGameId);

  const [filter, setFilter] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [prevGameId, setPrevGameId] = useState(numericGameId);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset client-side filters when game changes (during render, not in an effect)
  if (prevGameId !== numericGameId) {
    setPrevGameId(numericGameId);
    setFilter("");
    setSelectedTypes([]);
  }

  // Sync selectedGame context with URL on game change
  useEffect(() => {
    if (games.length > 0 && numericGameId) {
      const game = games.find((g) => g.id === numericGameId) ?? null;
      setSelectedGame(game);
    }
  }, [numericGameId, games, setSelectedGame]);

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // An active filter means the user is searching the whole dex — pull the
  // remaining pages so matches aren't limited to what's been scrolled past.
  const filterActive = filter.trim() !== "" || selectedTypes.length > 0;
  useEffect(() => {
    if (filterActive && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [filterActive, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const availableTypes: string[] = data?.pages[0]?.available_types ?? [];
  const pagination = data?.pages[data.pages.length - 1]?.pagination ?? null;

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= 2) return prev;
      return [...prev, type];
    });
  }, []);

  const filtered = useMemo(() => {
    const pokemons: Pokemon[] = data?.pages.flatMap((p) => p.pokemons) ?? [];
    return pokemons.filter((p) => {
      const nameMatch =
        !filter || p.name.toLowerCase().includes(filter.toLowerCase());
      const typeMatch =
        selectedTypes.length === 0 ||
        selectedTypes.every((t) => p.types.includes(t));
      return nameMatch && typeMatch;
    });
  }, [data, filter, selectedTypes]);

  if (isLoading) {
    return (
      <LoadingContainer>
        <RedSpinner size={28} />
        <LoadingText>Loading Pokémon...</LoadingText>
      </LoadingContainer>
    );
  }

  // Only surface a full-page error when nothing has loaded at all. A failed
  // fetchNextPage (e.g. a transient rate limit mid-scroll) keeps the grid and
  // shows an inline notice at the sentinel instead.
  if (isError && !data) {
    return (
      <ErrorText>
        {error instanceof Error ? error.message : "Failed to load Pokémon"}
      </ErrorText>
    );
  }

  return (
    <PageWrapper>
      {pagination?.seeding && (
        <SeedingBanner>
          <CircularProgress
            size={16}
            sx={{ color: "text.secondary", flexShrink: 0 }}
          />
          Pokémon data is being loaded in the background for the first time. The
          Pokédex will appear here automatically in a minute.
        </SeedingBanner>
      )}

      <FilterBar>
        <TextField
          size="small"
          placeholder="Filter Pokémon..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{
            width: 240,
            "& .MuiOutlinedInput-root": {
              "&.Mui-focused fieldset": { borderColor: "primary.main" },
            },
          }}
        />
        {pagination && pagination.total > 0 && (
          <CountText>
            {filtered.length} / {pagination.total}
            {filterActive && hasNextPage && " — searching entire dex…"}
          </CountText>
        )}
        {currentUser && pagination && pagination.total > 0 && (
          <CaughtCounter>
            <CaughtDot>●</CaughtDot>
            {caught.filter((c) => c.game_id === numericGameId).length} /{" "}
            {pagination.total} caught
          </CaughtCounter>
        )}
        <Button
          size="small"
          component={Link}
          to={`/game/${numericGameId}/team`}
          sx={{ ml: "auto", fontWeight: 700, flexShrink: 0 }}
        >
          Team builder
        </Button>
      </FilterBar>

      {availableTypes.length > 0 && (
        <TypeFilters>
          {availableTypes.map((type) => {
            const c = TYPE_COLORS[type] ?? { bg: "#999", color: "#fff" };
            const selected = selectedTypes.includes(type);
            return (
              <Chip
                key={type}
                label={type}
                size="small"
                onClick={() => toggleType(type)}
                sx={{
                  height: "22px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  bgcolor: selected ? c.bg : "transparent",
                  color: selected ? c.color : c.bg,
                  border: `2px solid ${c.bg}`,
                  opacity: selectedTypes.length === 2 && !selected ? 0.4 : 1,
                  "& .MuiChip-label": { px: "8px" },
                  "&:hover": {
                    bgcolor: selected ? c.bg : `${c.bg}22`,
                  },
                }}
              />
            );
          })}
          {selectedTypes.length > 0 && (
            <Chip
              label="clear"
              size="small"
              onClick={() => setSelectedTypes([])}
              sx={{
                height: "22px",
                fontSize: "0.7rem",
                cursor: "pointer",
                bgcolor: "transparent",
                color: "text.secondary",
                border: "2px solid",
                borderColor: "divider",
                "& .MuiChip-label": { px: "8px" },
              }}
            />
          )}
        </TypeFilters>
      )}

      <Grid>
        {filtered.map((pokemon) => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
            gameId={numericGameId}
          />
        ))}
      </Grid>

      <Sentinel ref={sentinelRef}>
        {isFetchingNextPage && (
          <>
            <CircularProgress size={14} sx={{ color: "primary.main" }} />
            <span>Loading more...</span>
          </>
        )}
        {isError && !isFetchingNextPage && (
          <span>
            {error instanceof Error
              ? error.message
              : "Couldn't load more Pokémon"}
          </span>
        )}
      </Sentinel>
    </PageWrapper>
  );
}
