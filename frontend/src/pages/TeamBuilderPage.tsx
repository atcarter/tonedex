import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { alpha } from "@mui/material/styles";
import type { Pokemon } from "../types";
import { useGames } from "../hooks/useGames";
import { useGame } from "../hooks/useGame";
import { useTeam, MAX_TEAM_SIZE } from "../hooks/useTeam";
import { TeamAnalysis } from "../components/team/TeamAnalysis";
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

const HeaderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const GameName = styled.span`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// ── Slots ────────────────────────────────────────────────────────────────────

const SlotsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(140px, 100%), 1fr));
  gap: 10px;
  margin-bottom: 20px;
`;

const Slot = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px 10px;
  border-radius: 12px;
  background: ${({ theme }) => theme.palette.background.paper};
  border: 2px solid ${({ theme }) => theme.palette.divider};

  img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;

const EmptySlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 130px;
  border-radius: 12px;
  border: 2px dashed ${({ theme }) => theme.palette.divider};
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: 0.75rem;
`;

const SlotName = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.primary};
  text-align: center;
`;

const SlotTypes = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
`;

const RemoveButton = styled(IconButton)`
  position: absolute !important;
  top: 2px !important;
  right: 2px !important;
  padding: 2px !important;

  svg {
    font-size: 14px;
    color: ${({ theme }) => theme.palette.text.secondary};
  }

  /* A bigger target for fingers */
  ${({ theme }) => theme.breakpoints.down("sm")} {
    top: 0 !important;
    right: 0 !important;
    padding: 9px !important;
  }
`;

// ── Picker ───────────────────────────────────────────────────────────────────

const PickerSection = styled.div`
  margin-bottom: 20px;
`;

const PickerBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
`;

const PickerField = styled(TextField)`
  width: 240px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 100%;
  }
`;

const PickerHint = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const PickerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(170px, 100%), 1fr));
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding: 2px;
`;

const PickerCard = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  background: ${({ theme }) => theme.palette.background.paper};
  color: ${({ theme }) => theme.palette.text.primary};
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.palette.primary.main};
    background: ${({ theme }) => alpha(theme.palette.primary.main, 0.05)};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  img {
    width: 36px;
    height: 36px;
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const LoadingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  padding: 12px 0;
`;

export function TeamBuilderPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const numericGameId = Number(gameId);

  const { data: games = [] } = useGames();
  const game = games.find((g) => g.id === numericGameId) ?? null;

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGame(numericGameId);
  const { team, addMember, removeMember, clearTeam, hasMember, isFull } =
    useTeam(numericGameId);

  const [filter, setFilter] = useState("");

  // Team building needs the whole dex available in the picker — pull all pages
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const candidates = useMemo(() => {
    const pokemons: Pokemon[] = data?.pages.flatMap((p) => p.pokemons) ?? [];
    const query = filter.trim().toLowerCase();
    return pokemons.filter(
      (p) =>
        !hasMember(p.id) && (!query || p.name.toLowerCase().includes(query)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasMember derives from team
  }, [data, filter, team]);

  const emptySlots = Math.max(0, MAX_TEAM_SIZE - team.length);

  return (
    <PageWrapper>
      <HeaderRow>
        <Title>Team Builder</Title>
        {game && <GameName>{formatName(game.name)}</GameName>}
        {team.length > 0 && (
          <Button
            size="small"
            color="error"
            onClick={clearTeam}
            // error.main is under 4.5:1 on the light page background
            sx={(theme) => ({
              ml: "auto",
              color:
                theme.palette.mode === "dark"
                  ? theme.palette.error.light
                  : theme.palette.error.dark,
            })}
          >
            Clear team
          </Button>
        )}
      </HeaderRow>

      <SlotsGrid>
        {team.map((member) => (
          <Slot key={member.id} data-testid="team-slot">
            <RemoveButton
              aria-label={`remove ${member.name}`}
              onClick={() => removeMember(member.id)}
            >
              <CloseIcon />
            </RemoveButton>
            <img src={member.sprite_url} alt={member.name} loading="lazy" />
            <SlotName>{formatName(member.name)}</SlotName>
            <SlotTypes>
              {member.types.map((type) => (
                <TypeBadge key={type} type={type} size="small" />
              ))}
            </SlotTypes>
          </Slot>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptySlot key={`empty-${i}`}>empty slot</EmptySlot>
        ))}
      </SlotsGrid>

      <PickerSection>
        <PickerBar>
          <PickerField
            size="small"
            placeholder="Add a Pokémon..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Add a Pokémon" } }}
          />
          <PickerHint>
            {isFull
              ? "Team is full — remove a member to add another."
              : `${team.length} / ${MAX_TEAM_SIZE} picked`}
          </PickerHint>
        </PickerBar>

        {isLoading ? (
          <LoadingRow>
            <CircularProgress size={16} sx={{ color: "primary.main" }} />
            Loading the dex…
          </LoadingRow>
        ) : (
          <>
            {(hasNextPage || isFetchingNextPage) && (
              <LoadingRow>
                <CircularProgress size={14} sx={{ color: "primary.main" }} />
                Loading the full dex…
              </LoadingRow>
            )}
            <PickerGrid>
              {candidates.map((pokemon) => (
                <PickerCard
                  key={pokemon.id}
                  disabled={isFull}
                  onClick={() => addMember(pokemon)}
                >
                  <img src={pokemon.sprite_url} alt="" loading="lazy" />
                  {formatName(pokemon.name)}
                </PickerCard>
              ))}
            </PickerGrid>
          </>
        )}
      </PickerSection>

      {team.length > 0 && <TeamAnalysis team={team} />}
    </PageWrapper>
  );
}
