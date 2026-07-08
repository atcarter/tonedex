import styled from "styled-components";
import type { EvolutionStep } from "../../types";
import { formatName, formatEvolutionDetails } from "../../utils/formatters";

const Chain = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
`;

const Step = styled.div`
  display: flex;
  align-items: center;
`;

const Pokemon = styled.div<{ $isCurrent: boolean; $clickable: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-radius: 10px;
  background: ${(props) => (props.$isCurrent ? "#fce4ec" : "#f5f5f5")};
  border: 2px solid ${(props) => (props.$isCurrent ? "#cc0000" : "transparent")};
  min-width: 80px;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) =>
      props.$clickable && !props.$isCurrent ? "#e8e8e8" : undefined};
    border-color: ${(props) =>
      props.$clickable && !props.$isCurrent ? "#cc0000" : undefined};
  }
`;

const Arrow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #bbb;
  font-size: 0.68rem;
  text-align: center;
  padding: 0 4px;
  gap: 2px;

  .arrow {
    font-size: 1.2rem;
    color: #ccc;
    line-height: 1;
  }
`;

const Name = styled.span<{ $isCurrent: boolean }>`
  font-size: 0.75rem;
  font-weight: ${(props) => (props.$isCurrent ? 700 : 500)};
  color: ${(props) => (props.$isCurrent ? "#cc0000" : "#1a1a1a")};
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
    <Chain>
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
