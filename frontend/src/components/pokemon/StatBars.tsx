import styled from "styled-components";
import type { PokemonDetail } from "../../types";
import { formatStatName } from "../../utils/formatters";

const STAT_COLORS: Record<string, string> = {
  hp: "#69DC12",
  attack: "#EFCC18",
  defense: "#E86412",
  "special-attack": "#14C3F1",
  "special-defense": "#4A6ADF",
  speed: "#D51DAD",
};

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.span`
  width: 64px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #888;
  text-align: right;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Track = styled.div`
  flex: 1;
  height: 8px;
  background: #eeeeee;
  border-radius: 4px;
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $color: string }>`
  height: 100%;
  width: ${(props) => props.$pct}%;
  background: ${(props) => props.$color};
  border-radius: 4px;
  transition: width 0.5s ease;
`;

const Value = styled.span`
  width: 36px;
  text-align: right;
  font-weight: 700;
  font-size: 0.875rem;
  color: #1a1a1a;
`;

interface StatBarsProps {
  baseStats: PokemonDetail["base_stats"];
}

export function StatBars({ baseStats }: StatBarsProps) {
  return (
    <>
      {Object.entries(baseStats).map(([stat, value]) => (
        <Row key={stat}>
          <Label>{formatStatName(stat)}</Label>
          <Track>
            <Fill
              $pct={Math.min(100, (value / 255) * 100)}
              $color={STAT_COLORS[stat] ?? "#aaa"}
            />
          </Track>
          <Value>{value}</Value>
        </Row>
      ))}
    </>
  );
}
