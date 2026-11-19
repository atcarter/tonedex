import styled from "styled-components";
import Button from "@mui/material/Button";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type {
  Neighbor,
  NeighborEntry,
  Neighbors,
} from "../../hooks/useNeighbors";
import { formatDexNumber, formatName } from "../../utils/formatters";

const Nav = styled.nav`
  display: flex;
  gap: 4px;
  min-width: 0;
`;

// aria-disabled rather than disabled, so a pressed button keeps focus at an end
const NavButton = styled(Button)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
  font-weight: 600 !important;
  text-transform: none !important;
  min-width: 0 !important;

  &[aria-disabled="true"] {
    color: ${({ theme }) => theme.palette.text.disabled} !important;
    cursor: default;
  }

  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-height: 44px;
  }
` as typeof Button;

const Label = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    max-width: 9ch;
  }
`;

// Phones show the number only; both names don't fit beside Back
const Name = styled.span<{ $optional: boolean }>`
  ${({ theme, $optional }) =>
    $optional && `${theme.breakpoints.down("sm")} { display: none; }`}
`;

const WORD: Record<Neighbor, string> = { previous: "Previous", next: "Next" };
const KEY: Record<Neighbor, string> = {
  previous: "ArrowLeft",
  next: "ArrowRight",
};

function entryText(entry: NeighborEntry) {
  const name = formatName(entry.name);
  return entry.pokedex_number != null
    ? `${formatDexNumber(entry.pokedex_number)} ${name}`
    : name;
}

interface NeighborNavProps {
  // null while the neighbors are loading
  neighbors: Neighbors | null;
  onGo: (to: Neighbor) => void;
}

export function NeighborNav({ neighbors, onGo }: NeighborNavProps) {
  const button = (to: Neighbor) => {
    const entry = neighbors?.[to] ?? null;
    const number = entry?.pokedex_number;
    const label = entry
      ? `${WORD[to]} Pokémon: ${entryText(entry)}`
      : neighbors
        ? `No ${to} Pokémon`
        : `${WORD[to]} Pokémon`;

    return (
      <NavButton
        aria-label={label}
        aria-disabled={!entry}
        aria-keyshortcuts={KEY[to]}
        startIcon={to === "previous" ? <ChevronLeftIcon /> : undefined}
        endIcon={to === "next" ? <ChevronRightIcon /> : undefined}
        onClick={() => entry && onGo(to)}
      >
        {entry && (
          <Label>
            {number != null && formatDexNumber(number)}
            <Name $optional={number != null}>
              {number != null && " "}
              {formatName(entry.name)}
            </Name>
          </Label>
        )}
      </NavButton>
    );
  };

  return (
    <Nav aria-label="Previous and next Pokémon">
      {button("previous")}
      {button("next")}
    </Nav>
  );
}
