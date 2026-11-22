import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { Game } from "../../types";
import { PokemonDetail } from "../PokemonDetail";
import { ErrorBoundary } from "../ErrorBoundary";
import { LiveRegion } from "../LiveRegion";
import { NeighborNav } from "./NeighborNav";
import { useDexView } from "../../hooks/useDexView";
import { pokemonQueryOptions } from "../../hooks/usePokemon";
import { useNeighbors, type Neighbor } from "../../hooks/useNeighbors";
import {
  prefersReducedMotion,
  useSwipeNavigation,
} from "../../hooks/useSwipeNavigation";
import { formatName } from "../../utils/formatters";

// The swipe surface: vertical pans and zoom stay the browser's
const PageWrapper = styled.div`
  /* A centred flex item shrinks to its content; fill up to the max instead */
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  touch-action: pan-y pinch-zoom;
  /* A dragged page mustn't widen the document; hidden for Safari before 16 */
  overflow-x: hidden;
  overflow-x: clip;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px max(16px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
  }
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
`;

const BackButton = styled(Button)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
  font-weight: 600 !important;
  flex-shrink: 0;
` as typeof Button;

// Arrow keys already mean something in these
const KEY_OWNERS =
  "input, textarea, select, [contenteditable], [role='combobox'], [role='listbox'], [role='menu'], [role='menuitem'], [role='slider'], [role='tablist'], [role='radiogroup'], [role='dialog']";

const PREFETCH_DELAY_MS = 250;
const ENTER_MS = 200;

interface PokemonPagerProps {
  pokemonName: string;
  game: Game | null;
}

// The detail page once the games list has loaded
export function PokemonPager({ pokemonName, game }: PokemonPagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const movedTo = (state as { neighbor?: Neighbor } | null)?.neighbor;
  const navigationType = useNavigationType();
  const [dex] = useDexView();
  const { neighbors, loading, pathFor, origin } = useNeighbors(
    pokemonName,
    game,
    dex,
  );

  // The one move behind the buttons, the keys and the swipe
  const go = (to: Neighbor) => {
    const entry = neighbors?.[to];
    if (!entry) return false;
    // Replace, so Back returns to the list in one step
    navigate(pathFor(entry.name), {
      replace: true,
      state: { origin, neighbor: to },
    });
    return true;
  };
  const latestGo = useRef(go);
  useEffect(() => {
    latestGo.current = go;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      // Alt+Left is the browser's Back
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if ((e.target as Element | null)?.closest?.(KEY_OWNERS)) return;
      if (latestGo.current(e.key === "ArrowLeft" ? "previous" : "next")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasNeighbor = !!(neighbors?.previous || neighbors?.next);

  // State, not a ref: the surface mounts after the parent's loading branch
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useSwipeNavigation(surface, contentRef, {
    enabled: hasNeighbor,
    canGo: (to) => !!neighbors?.[to],
    onGo: (to) => latestGo.current(to),
  });

  // The new Pokémon slides in from the side it came from. Web Animations
  // rather than a key, so PokemonDetail isn't remounted.
  const shown = useRef(pokemonName);
  useLayoutEffect(() => {
    if (shown.current === pokemonName) return;
    shown.current = pokemonName;
    const el = contentRef.current;
    if (!movedTo || navigationType === "POP" || !el?.animate) return;
    if (prefersReducedMotion()) return;
    el.style.transition = "";
    el.style.transform = "";
    const offset = movedTo === "next" ? "24%" : "-24%";
    el.animate(
      [
        { opacity: 0, transform: `translate3d(${offset}, 0, 0)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: ENTER_MS, easing: "ease-out" },
    );
  }, [pokemonName, movedTo, navigationType]);

  // Once the page has settled, so a move renders from cache
  useEffect(() => {
    if (!neighbors) return;
    const id = window.setTimeout(() => {
      for (const entry of [neighbors.previous, neighbors.next]) {
        if (!entry) continue;
        void queryClient.prefetchQuery(
          pokemonQueryOptions(entry.name, game?.id, dex),
        );
        if (entry.sprite_url) new Image().src = entry.sprite_url;
      }
    }, PREFETCH_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [neighbors, game?.id, dex, queryClient]);

  const showNav = loading || hasNeighbor;

  return (
    <PageWrapper ref={setSurface}>
      <TopRow>
        <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </BackButton>
        {showNav && <NeighborNav neighbors={neighbors} onGo={go} />}
      </TopRow>
      {/* Focus stays on the pressed button, so name the Pokémon it moved to */}
      <LiveRegion aria-live="polite">
        {movedTo ? formatName(pokemonName) : ""}
      </LiveRegion>
      <div ref={contentRef} data-testid="pager-content">
        <ErrorBoundary>
          <PokemonDetail pokemonName={pokemonName} game={game} />
        </ErrorBoundary>
      </div>
    </PageWrapper>
  );
}
