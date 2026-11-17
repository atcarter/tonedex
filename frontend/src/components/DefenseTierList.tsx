import styled from "styled-components";
import type { DefenseTier } from "../utils/typeDefense";
import { TypeBadge } from "./TypeBadge";
import { readable } from "./tierColors";
import type { TierColor } from "./tierColors";

type LabelColor = TierColor | "neutral";

// A container can widen the label column for longer symbols like 1.25×
const TierRow = styled.div`
  display: grid;
  grid-template-columns: var(--tier-label-width, 2rem) minmax(0, 1fr);
  align-items: start;
  gap: 8px;

  & + & {
    margin-top: 6px;
  }
`;

const TierLabel = styled.span<{ $color: LabelColor }>`
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 20px;
  color: ${({ theme, $color }) =>
    $color === "neutral"
      ? theme.palette.text.secondary
      : readable(theme, $color)};
`;

const TierTypes = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const TaggedEntry = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const Tag = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

interface TierStyle {
  symbol: string;
  label: string;
  color: LabelColor;
}

// Visible symbol plus spoken text, so screen readers don't read bare symbols
const TIERS: Record<number, TierStyle> = {
  4: { symbol: "4×", label: "4 times damage from", color: "error" },
  2: { symbol: "2×", label: "2 times damage from", color: "error" },
  1: { symbol: "1×", label: "Normal damage from", color: "neutral" },
  0.5: { symbol: "½×", label: "Half damage from", color: "success" },
  0.25: { symbol: "¼×", label: "Quarter damage from", color: "success" },
  0: { symbol: "0×", label: "Immune to", color: "info" },
};

// Abilities can give other multipliers (Dry Skin's 1.25×, Filter's 1.5×)
function tierStyle(multiplier: number): TierStyle {
  return (
    TIERS[multiplier] ?? {
      symbol: `${multiplier === 0.125 ? "⅛" : multiplier}×`,
      label: `${multiplier} times damage from`,
      color: multiplier > 1 ? "error" : "success",
    }
  );
}

interface DefenseTierListProps {
  tiers: DefenseTier[];
  // Text shown beside a type's badge, by type
  tags?: Record<string, string>;
}

// One row per tier: its symbol, then the attacking types' badges.
export function DefenseTierList({ tiers, tags = {} }: DefenseTierListProps) {
  return tiers.map(({ multiplier, types }) => {
    const tier = tierStyle(multiplier);
    return (
      <TierRow key={multiplier}>
        <TierLabel $color={tier.color} aria-hidden="true">
          {tier.symbol}
        </TierLabel>
        <TierTypes aria-label={tier.label}>
          {types.map((type) =>
            tags[type] ? (
              <TaggedEntry key={type}>
                <TypeBadge type={type} size="small" /> <Tag>{tags[type]}</Tag>
              </TaggedEntry>
            ) : (
              <li key={type}>
                <TypeBadge type={type} size="small" />
              </li>
            ),
          )}
        </TierTypes>
      </TierRow>
    );
  });
}
