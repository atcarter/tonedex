import { useRef, useState } from "react";
import styled from "styled-components";
import { useSearchParams } from "react-router-dom";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import type { Pokemon, PokemonDetail } from "../types";
import { usePokemon } from "../hooks/usePokemon";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSuggestions } from "../hooks/useSuggestions";
import { StatBars } from "../components/pokemon/StatBars";
import { TypeBadge } from "../components/TypeBadge";
import { formatName } from "../utils/formatters";

const PageWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 16px;
  width: 100%;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px max(16px, env(safe-area-inset-right))
      max(24px, env(safe-area-inset-bottom))
      max(16px, env(safe-area-inset-left));
  }
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0 0 16px;
`;

const CompareGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  align-items: start;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Column = styled(Paper)`
  padding: 20px 24px !important;
  border-radius: 12px !important;
  min-width: 0;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px !important;
  }
`;

// ── Picker ───────────────────────────────────────────────────────────────────

const PickerWrapper = styled.div`
  position: relative;
`;

const SuggestionList = styled(Paper)`
  position: absolute !important;
  top: calc(100% + 4px) !important;
  left: 0 !important;
  right: 0 !important;
  max-height: 280px !important;
  overflow-y: auto !important;
  z-index: 10 !important;
  border: 1px solid ${({ theme }) => theme.palette.divider} !important;
`;

const SuggestionItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.primary};

  &:hover {
    background: ${({ theme }) => theme.palette.action.hover};
  }

  &:last-child {
    border-bottom: none;
  }

  img {
    width: 32px;
    height: 32px;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;

// ── Chosen pokemon ───────────────────────────────────────────────────────────

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
`;

const SpriteCircle = styled.div`
  background: ${({ theme }) => theme.palette.action.hover};
  border-radius: 50%;
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid ${({ theme }) => theme.palette.divider};
  flex-shrink: 0;

  img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 64px;
    height: 64px;

    img {
      width: 52px;
      height: 52px;
    }
  }
`;

const Name = styled.h2`
  font-size: 1.25rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0 0 8px;
  overflow-wrap: anywhere;
`;

const Types = styled.div`
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
`;

const TotalRow = styled.div<{ $highlight?: boolean }>`
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 2px solid ${({ theme }) => theme.palette.divider};
  font-size: 0.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};

  span:last-child {
    font-size: 0.95rem;
    color: ${({ theme, $highlight }) =>
      $highlight ? theme.palette.success.main : theme.palette.text.primary};
  }
`;

const EmptyHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border-radius: 10px;
  border: 2px dashed ${({ theme }) => theme.palette.divider};
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: 0.85rem;
  margin-top: 12px;
`;

const LoadingBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
`;

type Stats = PokemonDetail["base_stats"];

const statTotal = (stats?: Stats) =>
  stats ? Object.values(stats).reduce((sum, v) => sum + v, 0) : 0;

// Stats where `own` beats `other` (highlighted green on the owning side)
function winningStats(own?: Stats, other?: Stats): Set<string> {
  if (!own || !other) return new Set();
  return new Set(
    Object.keys(own).filter(
      (stat) => own[stat as keyof Stats] > (other[stat as keyof Stats] ?? 0),
    ),
  );
}

function PokemonPicker({
  label,
  onPick,
}: {
  label: string;
  onPick: (name: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);
  const { data } = useSuggestions(debounced);
  const suggestions = query.trim().length >= 2 ? (data?.results ?? []) : [];

  const pick = (pokemon: Pokemon) => {
    onPick(pokemon.name);
    setQuery("");
  };

  return (
    <PickerWrapper
      ref={wrapperRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") setQuery("");
      }}
    >
      <TextField
        size="small"
        fullWidth
        placeholder={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        inputProps={{ "aria-label": label }}
      />
      {suggestions.length > 0 && (
        <SuggestionList elevation={3} role="listbox">
          {suggestions.map((pokemon) => (
            <SuggestionItem
              key={pokemon.id}
              type="button"
              role="option"
              onClick={() => pick(pokemon)}
            >
              <img src={pokemon.sprite_url} alt="" />
              {formatName(pokemon.name)}
            </SuggestionItem>
          ))}
        </SuggestionList>
      )}
    </PickerWrapper>
  );
}

function CompareColumn({
  label,
  name,
  otherStats,
  onPick,
  onClear,
}: {
  label: string;
  name: string;
  otherStats?: Stats;
  onPick: (name: string) => void;
  onClear: () => void;
}) {
  const { data, isLoading } = usePokemon(name);
  const details = name ? data?.pokemon : undefined;
  const highlight = winningStats(details?.base_stats, otherStats);
  const total = statTotal(details?.base_stats);
  const otherTotal = statTotal(otherStats);

  return (
    <Column elevation={1}>
      <PokemonPicker label={label} onPick={onPick} />

      {!name && <EmptyHint>Pick a Pokémon to compare</EmptyHint>}

      {name && isLoading && (
        <LoadingBox>
          <CircularProgress size={24} sx={{ color: "primary.main" }} />
        </LoadingBox>
      )}

      {details && (
        <>
          <Header>
            <SpriteCircle>
              <img src={details.sprite_url} alt={details.name} />
            </SpriteCircle>
            <div>
              <Name>
                {formatName(details.name)}
                <IconButton
                  size="small"
                  aria-label={`clear ${details.name}`}
                  onClick={onClear}
                  sx={{ ml: 0.5 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Name>
              <Types>
                {details.types.map((type) => (
                  <TypeBadge key={type} type={type} size="small" />
                ))}
              </Types>
            </div>
          </Header>

          <StatBars baseStats={details.base_stats} highlight={highlight} />
          <TotalRow $highlight={otherStats ? total > otherTotal : false}>
            <span>BASE STAT TOTAL</span>
            <span>{total}</span>
          </TotalRow>
        </>
      )}
    </Column>
  );
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const left = searchParams.get("left") ?? "";
  const right = searchParams.get("right") ?? "";

  const setSide = (side: "left" | "right", name: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (name) next.set(side, name);
      else next.delete(side);
      return next;
    });
  };

  // Fetch both here so each column can highlight its winning stats
  const leftQuery = usePokemon(left);
  const rightQuery = usePokemon(right);

  return (
    <PageWrapper>
      <Title>Compare</Title>
      <CompareGrid>
        <CompareColumn
          label="First Pokémon..."
          name={left}
          otherStats={right ? rightQuery.data?.pokemon.base_stats : undefined}
          onPick={(name) => setSide("left", name)}
          onClear={() => setSide("left", null)}
        />
        <CompareColumn
          label="Second Pokémon..."
          name={right}
          otherStats={left ? leftQuery.data?.pokemon.base_stats : undefined}
          onPick={(name) => setSide("right", name)}
          onClear={() => setSide("right", null)}
        />
      </CompareGrid>
    </PageWrapper>
  );
}
