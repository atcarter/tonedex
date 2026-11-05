import styled from "styled-components";
import Paper from "@mui/material/Paper";
import type { Theme } from "@mui/material/styles";
import type { Pokemon } from "../../types";
import { defenseSummary, offensiveCoverage } from "../../utils/teamAnalysis";
import type { DefenseRow, MemberHit } from "../../utils/teamAnalysis";
import { formatName } from "../../utils/formatters";
import { TypeBadge } from "../TypeBadge";

const SectionPaper = styled(Paper)`
  padding: 20px 24px !important;
  margin-bottom: 16px !important;
  border-radius: 12px !important;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    padding: 16px !important;
  }
`;

// The mode's stronger shade keeps text above 4.5:1 on the paper
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

const RowLabel = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0 0 8px;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Note = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

// ── Defense rows ─────────────────────────────────────────────────────────────

const DefenseGroup = styled.div`
  min-width: 0;
  margin-bottom: 16px;
`;

const EntryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

// A type badge and the sprites of the members it affects
const Entry = styled.li`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px 6px 2px 2px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
`;

// Block + overflow keep a missing sprite's alt text inside the box
const SpriteBox = styled.span`
  position: relative;
  flex-shrink: 0;
  width: 28px;
  height: 28px;

  img {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    object-fit: contain;
  }
`;

const Mark = styled.span<{ $color: "error" | "success" }>`
  position: absolute;
  right: -3px;
  bottom: -2px;
  padding: 0 3px;
  border-radius: 6px;
  font-size: 0.55rem;
  font-weight: 800;
  line-height: 1.4;
  color: ${({ theme, $color }) => theme.palette[$color].contrastText};
  background: ${({ theme, $color }) => theme.palette[$color].dark};
`;

const None = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// Only the extreme multipliers get a mark on the sprite
const MARKS: Record<number, { label: string; color: "error" | "success" }> = {
  4: { label: "4×", color: "error" },
  0.25: { label: "¼×", color: "success" },
};

const GROUPS: { key: "weak" | "resist" | "immune"; label: string }[] = [
  { key: "weak", label: "Weak (2× or 4×)" },
  { key: "resist", label: "Resists (½× or ¼×)" },
  { key: "immune", label: "Immune (0×)" },
];

function MemberSprite({ member, multiplier }: MemberHit) {
  const mark = MARKS[multiplier];
  const name = formatName(member.name);
  return (
    <SpriteBox>
      <img
        src={member.sprite_url}
        alt={mark ? `${name} (${mark.label})` : name}
        width={28}
        height={28}
        loading="lazy"
      />
      {mark && (
        <Mark $color={mark.color} aria-hidden="true">
          {mark.label}
        </Mark>
      )}
    </SpriteBox>
  );
}

function DefenseRowGroup({
  label,
  rows,
  group,
}: {
  label: string;
  rows: DefenseRow[];
  group: (typeof GROUPS)[number]["key"];
}) {
  const entries = rows.filter((row) => row[group].length > 0);
  return (
    <DefenseGroup data-testid="defense-row">
      <RowLabel>{label}</RowLabel>
      {entries.length === 0 ? (
        <None>None</None>
      ) : (
        <EntryList aria-label={label}>
          {entries.map((row) => (
            <Entry key={row.type}>
              <TypeBadge type={row.type} size="small" />
              {row[group].map((hit, i) => (
                <MemberSprite key={i} {...hit} />
              ))}
            </Entry>
          ))}
        </EntryList>
      )}
    </DefenseGroup>
  );
}

// ── Coverage ─────────────────────────────────────────────────────────────────

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
        {GROUPS.map(({ key, label }) => (
          <DefenseRowGroup key={key} label={label} rows={defense} group={key} />
        ))}
        <Note>Types and Pokémon not shown take normal 1× damage.</Note>
      </SectionPaper>

      <SectionPaper elevation={1}>
        <SectionTitle>Offensive Coverage</SectionTitle>
        {uncovered.length === 0 ? (
          <AllCovered>
            Your team's types hit every type super-effectively.
          </AllCovered>
        ) : (
          <div>
            <RowLabel>No strong attack against:</RowLabel>
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
