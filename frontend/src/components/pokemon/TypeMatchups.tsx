import styled from "styled-components";
import type { AbilityInfo } from "../../types";
import { abilityDefense } from "../../utils/matchupAbilities";
import { formatName } from "../../utils/formatters";
import { DefenseTierList } from "../DefenseTierList";

const Chart = styled.div`
  --tier-label-width: 2.75rem;
`;

const Footnote = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 12px 0 0;
`;

interface TypeMatchupsProps {
  types: string[];
  // The game's ability list, in slot order
  abilities: AbilityInfo[];
  // The selected game's generation; null uses the modern chart
  generation: number | null;
}

export function TypeMatchups({
  types,
  abilities,
  generation,
}: TypeMatchupsProps) {
  const { tiers, ability, tagged } = abilityDefense(
    types,
    abilities,
    generation,
  );
  const tags = Object.fromEntries(
    tagged.map((type) => [type, `with ${formatName(ability!)}`]),
  );

  return (
    <>
      <Chart data-testid="type-matchups">
        <DefenseTierList tiers={tiers} tags={tags} />
      </Chart>
      <Footnote>Types not listed do normal 1× damage.</Footnote>
    </>
  );
}
