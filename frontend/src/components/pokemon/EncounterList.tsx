import { useId, useState } from "react";
import styled from "styled-components";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { EncountersResponse, Game } from "../../types";
import { useEncounters } from "../../hooks/useEncounters";
import { formatName } from "../../utils/formatters";
import {
  formatArea,
  formatChance,
  formatConditions,
  formatLevels,
  formatMethod,
} from "../../utils/encounters";

// Rows shown before "Show all", so a long list stays scannable on a phone
export const COLLAPSED_ROWS = 6;

// ── Styling ──────────────────────────────────────────────────────────────────

const Message = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const Loading = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const RedSpinner = styled(CircularProgress)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
`;

const EvolveLink = styled.button`
  font: inherit;
  font-weight: 700;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.palette.text.primary};
  text-decoration: underline;
  cursor: pointer;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Row = styled.li`
  padding: 10px 0;
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};

  &:first-child {
    padding-top: 0;
  }
`;

const AreaLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
`;

const AreaName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme.palette.text.primary};
  overflow-wrap: anywhere;
`;

const DlcTag = styled.span`
  padding: 0 6px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 16px;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin-top: 2px;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.palette.text.secondary};

  span + span::before {
    content: "·";
    margin: 0 6px;
  }
`;

const Conditions = styled.div`
  margin-top: 2px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const ShowAllButton = styled(Button)`
  margin-top: 8px !important;
  font-weight: 600 !important;
  color: ${({ theme }) => theme.palette.text.primary} !important;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-height: 44px;
  }
` as typeof Button;

// ── EncounterList (presentational) ───────────────────────────────────────────

interface EncounterListProps {
  encounters: EncountersResponse | undefined;
  isError: boolean;
  game: Game;
  onSelect: (pokemonName: string) => void;
}

export function EncounterList({
  encounters,
  isError,
  game,
  onSelect,
}: EncounterListProps) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const gameName = formatName(game.name);

  if (isError)
    return <Message>Couldn't load where to find it in {gameName}.</Message>;

  if (!encounters || encounters.status === "pending")
    return (
      <Loading>
        <RedSpinner size={16} />
        Checking where to find it…
      </Loading>
    );

  if (encounters.status === "unavailable")
    return <Message>Location data isn't available for {gameName}.</Message>;

  if (encounters.status === "none") {
    const earlier = encounters.evolves_from;
    return (
      <Message>
        Not found in the wild in {gameName}.
        {earlier && (
          <>
            {" "}
            Evolve it from{" "}
            <EvolveLink
              type="button"
              onClick={() => onSelect(earlier.pokemon_name)}
            >
              {formatName(earlier.name)}
            </EvolveLink>
            .
          </>
        )}
      </Message>
    );
  }

  const { locations } = encounters;
  const rows = showAll ? locations : locations.slice(0, COLLAPSED_ROWS);

  return (
    <>
      <List id={listId} data-testid="encounter-list">
        {rows.map((location) => {
          const conditions = formatConditions(location);
          return (
            <Row key={`${location.area}-${location.dlc}-${location.method}`}>
              <AreaLine>
                <AreaName>{formatArea(location.area, game.region)}</AreaName>
                {location.dlc && <DlcTag>{location.dlc}</DlcTag>}
              </AreaLine>
              <Meta>
                <span>{formatMethod(location.method)}</span>
                <span>{formatLevels(location)}</span>
                <span>{formatChance(location)}</span>
              </Meta>
              {conditions && <Conditions>{conditions}</Conditions>}
            </Row>
          );
        })}
      </List>
      {locations.length > COLLAPSED_ROWS && (
        <ShowAllButton
          size="small"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((all) => !all)}
        >
          {showAll ? "Show fewer" : `Show all ${locations.length} locations`}
        </ShowAllButton>
      )}
    </>
  );
}

// ── Encounters (exported, fetches) ───────────────────────────────────────────

interface EncountersProps {
  pokemonId: number;
  game: Game;
  onSelect: (pokemonName: string) => void;
}

export function Encounters({ pokemonId, game, onSelect }: EncountersProps) {
  const { data, isError } = useEncounters(pokemonId, game.id);
  return (
    <EncounterList
      encounters={data}
      isError={isError}
      game={game}
      onSelect={onSelect}
    />
  );
}
