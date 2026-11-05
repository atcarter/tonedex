import { useId, useState } from "react";
import styled from "styled-components";
import { alpha } from "@mui/material/styles";
import type { AbilityInfo } from "../../types";
import { formatName } from "../../utils/formatters";
import { isPreAbilityGeneration } from "../../utils/abilities";
import { AboutItem, AboutLabel } from "./aboutStyles";

// ── Styling ──────────────────────────────────────────────────────────────────

const AbilityRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const AbilityChip = styled.button<{ $hidden: boolean }>`
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  border: 2px ${({ $hidden }) => ($hidden ? "dashed" : "solid")}
    ${({ theme }) => theme.palette.divider};
  background: transparent;
  color: ${({ theme }) => theme.palette.text.primary};
  cursor: pointer;
  transition: border-color 0.15s ease;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-height: 44px;
    padding: 3px 14px;
    border-radius: 22px;
  }

  &:hover,
  &[aria-expanded="true"] {
    border-color: ${({ theme }) => theme.palette.primary.main};
  }

  &[aria-expanded="true"] {
    background: ${({ theme }) => alpha(theme.palette.primary.main, 0.06)};
  }
`;

// A full-width flex item of the About grid, so it wraps under the chip row
const Panel = styled.div`
  flex-basis: 100%;
  margin-top: -16px;
  padding: 12px 16px;
  border: 1px solid ${({ theme }) => theme.palette.primary.main};
  border-radius: 6px;
  background: ${({ theme }) => theme.palette.action.hover};
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
`;

const PanelName = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.primary};
`;

const HiddenLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Description = styled.p`
  font-size: 0.875rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const InBattle = styled.p`
  font-size: 0.8rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 6px 0 0;
`;

const Note = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// ── Component ────────────────────────────────────────────────────────────────

interface AbilityListProps {
  abilities: AbilityInfo[];
  // The selected game's generation; null outside a game
  generation: number | null;
}

// Rendered inside the About grid: the chip row, then the open ability's panel.
export function AbilityList({ abilities, generation }: AbilityListProps) {
  const [openName, setOpenName] = useState<string | null>(null);
  const panelId = useId();

  if (abilities.length === 0) {
    if (!isPreAbilityGeneration(generation)) return null;
    return (
      <AboutItem>
        <AboutLabel>Abilities</AboutLabel>
        <Note>Abilities arrived in Gen 3.</Note>
      </AboutItem>
    );
  }

  const open = abilities.find((a) => a.name === openName);

  return (
    <>
      <AboutItem>
        <AboutLabel>Abilities</AboutLabel>
        <AbilityRow>
          {abilities.map((ability) => {
            const expanded = ability.name === openName;
            return (
              <AbilityChip
                key={ability.name}
                type="button"
                $hidden={ability.hidden}
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                onClick={() => setOpenName(expanded ? null : ability.name)}
              >
                {formatName(ability.name)}
              </AbilityChip>
            );
          })}
        </AbilityRow>
      </AboutItem>
      {open && (
        <Panel
          id={panelId}
          role="region"
          aria-label={`${formatName(open.name)} ability`}
        >
          <PanelHeader>
            <PanelName>{formatName(open.name)}</PanelName>
            {open.hidden && <HiddenLabel>Hidden ability</HiddenLabel>}
          </PanelHeader>
          <Description>
            {open.description ?? "No description available yet."}
          </Description>
          {open.short_effect && open.short_effect !== open.description && (
            <InBattle>In battle: {open.short_effect}</InBattle>
          )}
        </Panel>
      )}
    </>
  );
}
