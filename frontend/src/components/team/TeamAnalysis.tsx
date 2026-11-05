import styled from "styled-components";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { Pokemon } from "../../types";
import { defenseSummary, offensiveCoverage } from "../../utils/teamAnalysis";
import { TypeBadge } from "../TypeBadge";

const SectionPaper = styled(Paper)`
  padding: 20px 24px !important;
  margin-bottom: 16px !important;
  border-radius: 12px !important;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px !important;
  }
`;

// .main shades fail 4.5:1 on the tinted net-weak cells
const readable = (theme: Theme, color: "error" | "success") =>
  theme.palette.mode === "dark"
    ? theme.palette[color].light
    : theme.palette[color].dark;

const SectionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.primary.main};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;

  &::after {
    content: "";
    flex: 1;
    height: 2px;
    background: ${({ theme }) => theme.palette.divider};
    border-radius: 1px;
  }
`;

const Hint = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0 0 12px;
`;

// ── Defense grid ─────────────────────────────────────────────────────────────

const DefenseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
  gap: 8px;
`;

// Counts drop under the badge when the cell is too narrow for both
const DefenseCell = styled.div<{ $netWeak: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid
    ${({ theme, $netWeak }) =>
      $netWeak ? theme.palette.error.main : theme.palette.divider};
  background: ${({ theme, $netWeak }) =>
    $netWeak ? alpha(theme.palette.error.main, 0.08) : "transparent"};
`;

const Counts = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;

  & > span {
    white-space: nowrap;
  }
`;

const WeakCount = styled.span`
  color: ${({ theme }) => readable(theme, "error")};
`;

const ResistCount = styled.span`
  color: ${({ theme }) => readable(theme, "success")};
`;

const NeutralCount = styled.span`
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// ── Coverage ─────────────────────────────────────────────────────────────────

const CoverageLine = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0 0 8px;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const AllCovered = styled.p`
  font-size: 0.85rem;
  font-weight: 700;
  margin: 0;
  color: ${({ theme }) => readable(theme, "success")};
`;

interface TeamAnalysisProps {
  team: Pokemon[];
}

export function TeamAnalysis({ team }: TeamAnalysisProps) {
  const defense = defenseSummary(team);
  const { uncovered } = offensiveCoverage(team);

  return (
    <>
      <SectionPaper elevation={1}>
        <SectionTitle>Defensive Overview</SectionTitle>
        <Hint>
          Per attacking type: members hit super-effectively vs. members
          resisting (immunities count as resists). Highlighted types are net
          weaknesses for the team.
        </Hint>
        <DefenseGrid>
          {defense.map((row) => (
            <DefenseCell
              key={row.type}
              $netWeak={row.weak > row.resist}
              data-testid="defense-cell"
            >
              <TypeBadge type={row.type} size="small" />
              <Counts>
                {row.weak > 0 ? (
                  <WeakCount>{row.weak} weak</WeakCount>
                ) : (
                  <NeutralCount>0 weak</NeutralCount>
                )}
                {row.resist > 0 ? (
                  <ResistCount>{row.resist} resist</ResistCount>
                ) : (
                  <NeutralCount>0 resist</NeutralCount>
                )}
              </Counts>
            </DefenseCell>
          ))}
        </DefenseGrid>
      </SectionPaper>

      <SectionPaper elevation={1}>
        <SectionTitle>Offensive Coverage</SectionTitle>
        {uncovered.length === 0 ? (
          <AllCovered>
            Your team's types hit every type super-effectively.
          </AllCovered>
        ) : (
          <div>
            <CoverageLine>No strong attack against:</CoverageLine>
            <BadgeRow>
              {uncovered.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </BadgeRow>
          </div>
        )}
      </SectionPaper>
    </>
  );
}
