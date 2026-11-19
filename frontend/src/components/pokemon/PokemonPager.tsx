import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
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
import { formatName } from "../../utils/formatters";

const PageWrapper = styled.div`
  /* A centred flex item shrinks to its content; fill up to the max instead */
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;

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

interface PokemonPagerProps {
  pokemonName: string;
  game: Game | null;
}

// The detail page once the games list has loaded
export function PokemonPager({ pokemonName, game }: PokemonPagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const [dex] = useDexView();
  const { neighbors, loading, pathFor } = useNeighbors(pokemonName, game, dex);

  // The one move behind the buttons and the keys
  const go = (to: Neighbor) => {
    const entry = neighbors?.[to];
    if (!entry) return false;
    // Replace, so Back returns to the list in one step
    navigate(pathFor(entry.name), { replace: true, state: { neighbor: to } });
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

  const showNav = loading || !!(neighbors?.previous || neighbors?.next);
  const movedSideways = !!(state as { neighbor?: Neighbor } | null)?.neighbor;

  return (
    <PageWrapper>
      <TopRow>
        <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </BackButton>
        {showNav && <NeighborNav neighbors={neighbors} onGo={go} />}
      </TopRow>
      {/* Focus stays on the pressed button, so name the Pokémon it moved to */}
      <LiveRegion aria-live="polite">
        {movedSideways ? formatName(pokemonName) : ""}
      </LiveRegion>
      <ErrorBoundary>
        <PokemonDetail pokemonName={pokemonName} game={game} />
      </ErrorBoundary>
    </PageWrapper>
  );
}
