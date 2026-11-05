import { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import type { Pokemon } from "../types";
import { searchPokemon } from "../services/api";
import { useAppContext } from "../hooks/useAppContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSuggestions } from "../hooks/useSuggestions";
import { formatName } from "../utils/formatters";

// $expanded: static, so the dropdown anchors to the toolbar and spans its width
const SearchWrapper = styled.div<{ $expanded: boolean }>`
  position: ${({ $expanded }) => ($expanded ? "static" : "relative")};
  ${({ $expanded }) => $expanded && "flex: 1; min-width: 0;"}
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  padding: 0 4px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.2);
  }
`;

const SearchInput = styled(InputBase)<{ $expanded: boolean }>`
  color: white !important;
  padding: 4px 8px !important;
  ${({ $expanded }) => ($expanded ? "flex: 1; min-width: 0;" : "width: 220px;")}

  .MuiInputBase-input::placeholder {
    color: rgba(255, 255, 255, 0.65) !important;
    opacity: 1;
  }
`;

const ResultsDropdown = styled(Paper)<{ $expanded: boolean }>`
  position: absolute !important;
  ${({ $expanded }) =>
    $expanded
      ? "top: 100% !important; left: 0 !important; right: 0 !important;"
      : "top: calc(100% + 6px) !important; left: 0 !important; min-width: 260px !important;"}
  max-height: 320px !important;
  overflow-y: auto !important;
  z-index: 1300 !important;
  border: 1px solid ${({ theme }) => theme.palette.divider} !important;
`;

const ResultItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 16px;
  background: ${({ theme, $active }) =>
    $active ? theme.palette.action.selected : "none"};
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.primary};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme }) => theme.palette.action.hover};
  }

  &:last-child {
    border-bottom: none;
  }

  img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;

const ErrorBadge = styled.div<{ $expanded: boolean }>`
  position: absolute;
  top: calc(100% + 6px);
  ${({ $expanded }) =>
    $expanded ? "left: 16px; right: 16px;" : "left: 0; white-space: nowrap;"}
  background: ${({ theme }) => theme.palette.background.paper};
  border: 1px solid ${({ theme }) => theme.palette.error.main};
  color: ${({ theme }) => theme.palette.error.main};
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 1300;
`;

interface PokemonSearchProps {
  /** Phone layout: full row, autofocus, full-width dropdown */
  expanded?: boolean;
  /** Escape, or opening a result */
  onClose?: () => void;
}

export function PokemonSearch({
  expanded = false,
  onClose,
}: PokemonSearchProps) {
  const navigate = useNavigate();
  const { selectedGame } = useAppContext();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Pokemon[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-${index}`;

  // As-you-type suggestions from our own DB (debounced; sprites included).
  // Explicit full-search results (from Enter) take precedence while present.
  const debouncedQuery = useDebouncedValue(query, 200);
  const { data: suggestionData } = useSuggestions(debouncedQuery);
  const suggestions =
    query.trim().length >= 2 ? (suggestionData?.results ?? []) : [];
  const shown = results.length > 0 ? results : suggestions;

  const dismiss = () => {
    setResults([]);
    setError(null);
    setActiveIndex(-1);
  };

  // Close the dropdown/error on click-outside
  useEffect(() => {
    if (shown.length === 0 && !error) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) dismiss();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [shown.length, error]);

  // Stay in the current game's context so the detail page has its moves,
  // caught toggle, and dex number; game-less only when no game is selected.
  const detailPath = (name: string) =>
    selectedGame
      ? `/game/${selectedGame.id}/pokemon/${name}`
      : `/pokemon/${name}`;

  const handleSelect = (pokemon: Pokemon) => {
    navigate(detailPath(pokemon.name));
    dismiss();
    setQuery("");
    onClose?.();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on a highlighted suggestion selects it
    if (activeIndex >= 0 && shown[activeIndex]) {
      handleSelect(shown[activeIndex]);
      return;
    }
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { results: found, exact } = await searchPokemon(
        query.trim().toLowerCase(),
      );
      if (exact && found[0]) {
        navigate(detailPath(found[0].name));
        setQuery("");
        onClose?.();
      } else {
        setResults(found);
        if (found.length === 0) setError("No Pokémon found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      dismiss();
      onClose?.();
      return;
    }
    if (shown.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? shown.length - 1 : prev - 1));
    }
  };

  return (
    <SearchWrapper
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
      $expanded={expanded}
    >
      <form onSubmit={handleSearch}>
        <SearchBar>
          <SearchInput
            $expanded={expanded}
            autoFocus={expanded}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Stale explicit results and highlights die with the keystroke
              setResults([]);
              setError(null);
              setActiveIndex(-1);
            }}
            placeholder="Search Pokémon..."
            inputProps={{
              role: "combobox",
              "aria-label": "search pokemon",
              "aria-autocomplete": "list",
              "aria-expanded": shown.length > 0,
              "aria-controls": shown.length > 0 ? listboxId : undefined,
              "aria-activedescendant":
                activeIndex >= 0 && shown[activeIndex]
                  ? optionId(activeIndex)
                  : undefined,
            }}
          />
          <IconButton
            type="submit"
            aria-label="search"
            disabled={loading}
            sx={{ color: "white", p: "6px" }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </SearchBar>
      </form>

      {error && <ErrorBadge $expanded={expanded}>{error}</ErrorBadge>}

      {shown.length > 0 && (
        <ResultsDropdown
          id={listboxId}
          elevation={3}
          role="listbox"
          aria-label="pokemon suggestions"
          $expanded={expanded}
        >
          {shown.map((pokemon, index) => (
            <ResultItem
              key={pokemon.id}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              $active={index === activeIndex}
              onClick={() => handleSelect(pokemon)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {/* Eager: at most 8 tiny images, and lazy-loading defers
                  offscreen-then-shown dropdown content unpredictably */}
              <img src={pokemon.sprite_url} alt="" />
              <Box>
                <span>{formatName(pokemon.name)}</span>
              </Box>
            </ResultItem>
          ))}
        </ResultsDropdown>
      )}
    </SearchWrapper>
  );
}
