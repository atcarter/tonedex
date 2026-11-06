import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type { Pokemon } from "../types";
import { TYPE_COLORS } from "../constants/typeColors";
import { useAppContext } from "../hooks/useAppContext";
import { useRouteGame } from "../hooks/useRouteGame";
import { useGame, PAGE_SIZE } from "../hooks/useGame";
import { useCaughtPokemons } from "../hooks/useCaughtPokemons";
import { useDexView, dexSearch } from "../hooks/useDexView";
import { PokemonCard } from "../components/PokemonCard";
import { DexToggle } from "../components/DexToggle";
import { dexSections, type DexSection } from "../utils/dexSections";
import {
  PageWrapper,
  FilterBar,
  DexToggleSlot,
  Grid,
  Sentinel,
  LoadingContainer,
  LoadingText,
  RedSpinner,
  ErrorText,
  CountText,
  CaughtCounter,
  CaughtDot,
  TypeFilters,
  JumpRow,
  JumpLabel,
  JumpChip,
  BackToTop,
  SeedingBanner,
} from "./GamePage.styles";

export function GamePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedGame, currentUser } = useAppContext();
  const {
    game,
    gameId: numericGameId,
    slug,
    isPending: gamesPending,
    notFound,
    error: gamesError,
  } = useRouteGame();
  const [dex, setDex] = useDexView();

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGame(numericGameId, dex);

  const { data: caught = [] } = useCaughtPokemons(numericGameId);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const viewKey = `${numericGameId}:${dex}`;
  const [prevViewKey, setPrevViewKey] = useState(viewKey);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Depth to restore on back/refresh, captured from ?loaded= before we start
  // rewriting it below. State rather than a ref because render reads it.
  const [restoreTarget, setRestoreTarget] = useState(
    () => Number(searchParams.get("loaded")) || 0,
  );

  // Reset per-list state when the game or dex view changes (during render, not in an effect)
  if (prevViewKey !== viewKey) {
    setPrevViewKey(viewKey);
    setSelectedTypes([]);
    setRestoreTarget(Number(searchParams.get("loaded")) || 0);
  }

  // Sync selectedGame context with URL on game change
  useEffect(() => {
    if (game || notFound) setSelectedGame(game);
  }, [game, notFound, setSelectedGame]);

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

  // An active type filter means the user is searching the whole dex — pull
  // the remaining pages so matches aren't limited to what's been scrolled
  // past. (Name lookups live in the AppBar search, which navigates directly.)
  const filterActive = selectedTypes.length > 0;
  useEffect(() => {
    if (filterActive && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [filterActive, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const loadedOffset = data
    ? (data.pages[data.pages.length - 1]?.pagination.offset ?? 0)
    : 0;

  // Dex-section quick-jump: load through the target's page, then scroll to it
  const [jumpTarget, setJumpTarget] = useState<DexSection | null>(null);
  const jumpOffsetNeeded = jumpTarget
    ? Math.floor(jumpTarget.index / PAGE_SIZE) * PAGE_SIZE
    : 0;

  // Refetch pages up to whichever depth is demanded — the ?loaded= restore
  // target (back-navigation / refresh keeps the grid's height for native
  // scroll restoration) or a pending section jump.
  const demandedOffset = Math.max(restoreTarget, jumpOffsetNeeded);
  useEffect(() => {
    if (
      demandedOffset > 0 &&
      loadedOffset < demandedOffset &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    demandedOffset,
    loadedOffset,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Once the jump target's card exists, scroll to it
  useEffect(() => {
    if (jumpTarget == null) return;
    const el = document.querySelector(`[data-dex="${jumpTarget.start}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Clearing the target depends on the DOM (has the card rendered yet?),
      // which render can't see, so it has to happen here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJumpTarget(null);
    }
  }, [jumpTarget, loadedOffset]);

  // Floating back-to-top once the user is a couple of screens down
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Record the loaded depth in the URL (replace — no history spam)
  useEffect(() => {
    if (loadedOffset > 0) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("loaded", String(loadedOffset));
          return next;
        },
        { replace: true },
      );
    }
  }, [loadedOffset, setSearchParams]);

  const availableTypes: string[] = data?.pages[0]?.available_types ?? [];
  // Caught entries count only when the Pokémon is in the list being shown
  const caughtInView = useMemo(() => {
    const ids = new Set(data?.pages[0]?.pokemon_ids ?? []);
    return caught.filter(
      (c) => c.game_id === numericGameId && ids.has(c.pokemon_id),
    ).length;
  }, [data, caught, numericGameId]);
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
    return pokemons.filter(
      (p) =>
        selectedTypes.length === 0 ||
        selectedTypes.every((t) => p.types.includes(t)),
    );
  }, [data, selectedTypes]);

  // Only large dexes get quick-jump sections; hidden while type-filtering
  // (filtered results don't align with dex-number sections)
  const sections = dexSections(data?.pages[0]?.dex_numbers ?? []);

  if (notFound) return <ErrorText>Game not found</ErrorText>;
  if (gamesError) return <ErrorText>{gamesError.message}</ErrorText>;

  // A name segment waits for the games list before its dex can load
  if (isLoading || (gamesPending && !numericGameId)) {
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
          {dex === "national"
            ? "The national dex is being built in the background for the first time. It will appear here automatically in a few minutes."
            : "Pokémon data is being loaded in the background for the first time. The dex will appear here automatically in a minute."}
        </SeedingBanner>
      )}

      <FilterBar>
        <DexToggleSlot>
          <DexToggle value={dex} onChange={setDex} />
        </DexToggleSlot>
        {pagination && pagination.total > 0 && (
          <CountText>
            {filtered.length} / {pagination.total}
            {filterActive && hasNextPage && " — searching entire dex…"}
          </CountText>
        )}
        {currentUser && pagination && pagination.total > 0 && (
          <CaughtCounter>
            <CaughtDot>●</CaughtDot>
            {caughtInView} / {pagination.total} caught
          </CaughtCounter>
        )}
        <Button
          size="small"
          component={Link}
          to={`/game/${slug}/team${dexSearch(dex)}`}
          sx={{ ml: "auto", fontWeight: 700, flexShrink: 0 }}
        >
          Team builder
        </Button>
        <Button
          size="small"
          component={Link}
          to="/compare"
          sx={{ fontWeight: 700, flexShrink: 0 }}
        >
          Compare
        </Button>
      </FilterBar>

      {availableTypes.length > 0 && (
        <TypeFilters>
          {/* First, so it's reachable without scrolling */}
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
        </TypeFilters>
      )}

      {sections.length > 0 && !filterActive && (
        <JumpRow>
          <JumpLabel>Jump to</JumpLabel>
          {sections.map((section) => (
            <JumpChip
              key={section.start}
              type="button"
              onClick={() => setJumpTarget(section)}
            >
              {section.start}–{section.end}
            </JumpChip>
          ))}
        </JumpRow>
      )}

      <Grid>
        {filtered.map((pokemon) => (
          <div key={pokemon.id} data-dex={pokemon.pokedex_number}>
            <PokemonCard
              pokemon={pokemon}
              gameId={numericGameId}
              gameSlug={slug}
              dex={dex}
            />
          </div>
        ))}
      </Grid>

      <BackToTop
        aria-label="back to top"
        $visible={showBackToTop}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <KeyboardArrowUpIcon />
      </BackToTop>

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
