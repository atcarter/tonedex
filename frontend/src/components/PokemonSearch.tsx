import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import type { Pokemon } from "../types";
import { searchPokemon } from "../services/api";

const SearchWrapper = styled.div`
  position: relative;
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

const SearchInput = styled(InputBase)`
  color: white !important;
  padding: 4px 8px !important;
  width: 220px;

  .MuiInputBase-input::placeholder {
    color: rgba(255, 255, 255, 0.65) !important;
    opacity: 1;
  }
`;

const ResultsDropdown = styled(Paper)`
  position: absolute !important;
  top: calc(100% + 6px) !important;
  left: 0 !important;
  min-width: 260px !important;
  max-height: 320px !important;
  overflow-y: auto !important;
  z-index: 1300 !important;
  border: 1px solid ${({ theme }) => theme.palette.divider} !important;
`;

const ResultItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 16px;
  background: none;
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
  }
`;

const ErrorBadge = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: ${({ theme }) => theme.palette.background.paper};
  border: 1px solid ${({ theme }) => theme.palette.error.main};
  color: ${({ theme }) => theme.palette.error.main};
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 1300;
`;

export function PokemonSearch() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Pokemon[]>([]);

  const dismiss = () => {
    setResults([]);
    setError(null);
  };

  // Close the dropdown/error on click-outside
  useEffect(() => {
    if (results.length === 0 && !error) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) dismiss();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [results.length, error]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { results: found, exact } = await searchPokemon(
        query.trim().toLowerCase(),
      );
      if (exact && found[0]) {
        navigate(`/pokemon/${found[0].name}`);
        setQuery("");
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

  const handleSelect = (pokemon: Pokemon) => {
    navigate(`/pokemon/${pokemon.name}`);
    dismiss();
    setQuery("");
  };

  return (
    <SearchWrapper
      ref={wrapperRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
    >
      <form onSubmit={handleSearch}>
        <SearchBar>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pokémon..."
            inputProps={{ "aria-label": "search pokemon" }}
          />
          <IconButton
            type="submit"
            disabled={loading}
            sx={{ color: "white", p: "6px" }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </SearchBar>
      </form>

      {error && <ErrorBadge>{error}</ErrorBadge>}

      {results.length > 0 && (
        <ResultsDropdown elevation={3}>
          {results.map((pokemon) => (
            <ResultItem key={pokemon.id} onClick={() => handleSelect(pokemon)}>
              <img src={pokemon.sprite_url} alt={pokemon.name} />
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

function formatName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
