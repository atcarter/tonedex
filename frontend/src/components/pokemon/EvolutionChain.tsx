import type { ReactNode } from "react";
import styled, { css } from "styled-components";
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

/* Branching chains: a column of stages, splitting into a grid of branch
   columns wherever a stage has several evolutions. Grids, not column
   flexboxes, so a wrapped branch grid's rows hug their cards. */
const treeColumn = css`
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 4px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    justify-items: stretch;
  }
`;

const Tree = styled.div`
  ${treeColumn}
`;

const Branches = styled.div`
  justify-self: stretch;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(120px, 100%), 1fr));
  align-items: start;
  gap: 8px;
  margin-top: 4px;
`;

/* Outlined, so a wrapped row's arrows don't read as evolving from the row above */
const Branch = styled.div`
  ${treeColumn}
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  border-radius: 12px;
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

// Each stage's evolutions, by parent name
function childrenByParent(chain: EvolutionStep[]) {
  const children = new Map<string, EvolutionStep[]>();
  for (const step of chain) {
    if (!step.evolves_from) continue;
    children.set(step.evolves_from, [
      ...(children.get(step.evolves_from) ?? []),
      step,
    ]);
  }
  return children;
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

  const arrow = (step: EvolutionStep, down: boolean) => (
    <Arrow data-testid="evolution-arrow" $down={down}>
      <span className="arrow">→</span>
      <span>{formatEvolutionDetails(step.evolution_details[0])}</span>
    </Arrow>
  );

  const children = childrenByParent(chain);
  const branching = [...children.values()].some((kids) => kids.length > 1);

  // A stage, then its single evolution below it or a column per branch
  const subtree = (step: EvolutionStep, withArrow: boolean): ReactNode => {
    const kids = children.get(step.name) ?? [];
    return (
      <>
        {withArrow && arrow(step, true)}
        {stage(step)}
        {kids.length === 1 && subtree(kids[0], true)}
        {kids.length > 1 && (
          <Branches data-testid="evolution-branches" data-parent={step.name}>
            {kids.map((kid) => (
              <Branch
                key={kid.name}
                data-testid="evolution-branch"
                data-species={kid.name}
              >
                {subtree(kid, true)}
              </Branch>
            ))}
          </Branches>
        )}
      </>
    );
  };

  if (branching) {
    return (
      <Tree data-testid="evolution-chain">{subtree(chain[0], false)}</Tree>
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
