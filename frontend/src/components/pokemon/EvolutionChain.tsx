import styled from "styled-components";
import { alpha } from "@mui/material/styles";
import type { EvolutionStep } from "../../types";
import { formatName, formatEvolutionDetails } from "../../utils/formatters";

const Chain = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;

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

const Arrow = styled.div`
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

  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-direction: row;
    justify-content: center;
    gap: 6px;

    .arrow {
      transform: rotate(90deg);
    }
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

export function EvolutionChain({
  chain,
  currentName,
  onSelect,
}: EvolutionChainProps) {
  return (
    <Chain data-testid="evolution-chain">
      {chain.map((step, index) => {
        const isCurrent = step.name === currentName;
        return (
          <Step key={step.name}>
            {index > 0 && (
              <Arrow>
                <span className="arrow">→</span>
                <span>{formatEvolutionDetails(step.evolution_details[0])}</span>
              </Arrow>
            )}
            <Pokemon
              data-testid="evolution-stage"
              $isCurrent={isCurrent}
              $clickable={!isCurrent}
              onClick={() => onSelect(step.name)}
            >
              <Name $isCurrent={isCurrent}>{formatName(step.name)}</Name>
            </Pokemon>
          </Step>
        );
      })}
    </Chain>
  );
}
