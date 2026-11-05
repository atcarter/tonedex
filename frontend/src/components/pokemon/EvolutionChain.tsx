import styled, { css } from "styled-components";
import { alpha } from "@mui/material/styles";
import type { EvolutionStep } from "../../types";
import { formatName, formatEvolutionDetails } from "../../utils/formatters";

const Chain = styled.div<{ $branching?: boolean }>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;

  ${({ $branching }) =>
    $branching &&
    css`
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    `}

  /* Phones stack stages so a wrapped row never starts with an arrow */
  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const Step = styled.div`
  display: flex;
  align-items: center;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
`;

/* Branching chains: each card keeps its arrow with the evolution it leads to */
const Branches = styled.div`
  align-self: stretch;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
`;

const Branch = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Pokemon = styled.div<{ $isCurrent: boolean; $clickable: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-radius: 10px;
  background: ${({ theme, $isCurrent }) =>
    $isCurrent
      ? alpha(theme.palette.primary.main, 0.1)
      : theme.palette.action.hover};
  border: 2px solid
    ${({ theme, $isCurrent }) =>
      $isCurrent ? theme.palette.primary.main : "transparent"};
  min-width: 80px;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  transition: all 0.15s ease;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    justify-content: center;
    min-height: 44px;
  }

  &:hover {
    background: ${({ theme, $clickable, $isCurrent }) =>
      $clickable && !$isCurrent ? theme.palette.action.selected : undefined};
    border-color: ${({ theme, $clickable, $isCurrent }) =>
      $clickable && !$isCurrent ? theme.palette.primary.main : undefined};
  }
`;

const downArrow = css`
  flex-direction: row;
  justify-content: center;
  gap: 6px;

  .arrow {
    transform: rotate(90deg);
  }
`;

const Arrow = styled.div<{ $down?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: 0.68rem;
  text-align: center;
  padding: 0 4px;
  gap: 2px;

  .arrow {
    font-size: 1.2rem;
    color: ${({ theme }) => theme.palette.text.disabled};
    line-height: 1;
  }

  ${({ $down }) => $down && downArrow}

  ${({ theme }) => theme.breakpoints.down("sm")} {
    ${downArrow}
  }
`;

const Name = styled.span<{ $isCurrent: boolean }>`
  font-size: 0.75rem;
  font-weight: ${(props) => (props.$isCurrent ? 700 : 500)};
  color: ${({ theme, $isCurrent }) =>
    $isCurrent ? theme.palette.primary.main : theme.palette.text.primary};
`;

interface EvolutionChainProps {
  chain: EvolutionStep[];
  currentName: string;
  onSelect: (name: string) => void;
}

// Branching when some stage evolves into two or more others (Eevee)
function isBranching(chain: EvolutionStep[]) {
  const parents = chain.flatMap((step) => step.evolves_from ?? []);
  return new Set(parents).size < parents.length;
}

export function EvolutionChain({
  chain,
  currentName,
  onSelect,
}: EvolutionChainProps) {
  const stage = (step: EvolutionStep) => {
    const isCurrent = step.name === currentName;
    return (
      <Pokemon
        data-testid="evolution-stage"
        $isCurrent={isCurrent}
        $clickable={!isCurrent}
        onClick={() => onSelect(step.name)}
      >
        <Name $isCurrent={isCurrent}>{formatName(step.name)}</Name>
      </Pokemon>
    );
  };

  const arrow = (step: EvolutionStep, down: boolean, from?: string | null) => (
    <Arrow data-testid="evolution-arrow" $down={down}>
      <span className="arrow">→</span>
      <span>
        {formatEvolutionDetails(step.evolution_details[0])}
        {from && ` (from ${formatName(from)})`}
      </span>
    </Arrow>
  );

  if (isBranching(chain)) {
    const [base, ...rest] = chain;
    return (
      <Chain data-testid="evolution-chain" $branching>
        {stage(base)}
        <Branches>
          {rest.map((step) => (
            <Branch key={step.name} data-testid="evolution-branch">
              {arrow(
                step,
                true,
                step.evolves_from !== base.name ? step.evolves_from : null,
              )}
              {stage(step)}
            </Branch>
          ))}
        </Branches>
      </Chain>
    );
  }

  return (
    <Chain data-testid="evolution-chain">
      {chain.map((step, index) => (
        <Step key={step.name}>
          {index > 0 && arrow(step, false)}
          {stage(step)}
        </Step>
      ))}
    </Chain>
  );
}
