import styled from "styled-components";
import Paper from "@mui/material/Paper";
import type { Theme } from "@mui/material/styles";
import type { Pokemon } from "../../types";
import { memberDefense, offensiveCoverage } from "../../utils/teamAnalysis";
import type { DefenseMultiplier } from "../../utils/teamAnalysis";
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

type TierColor = "error" | "success" | "info";

// The mode's stronger shade keeps text above 4.5:1 on the paper
const readable = (theme: Theme, color: TierColor) =>
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

// ── Defense by member ────────────────────────────────────────────────────────

const MemberList = styled.ul`
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
`;

const MemberEntry = styled.li`
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
`;

const MemberHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

// Block + overflow keep a broken sprite inside its box
const SpriteBox = styled.span`
  flex-shrink: 0;
  width: 36px;
  height: 36px;

  img {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    object-fit: contain;
  }
`;

const MemberName = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 700;
`;

const TierRow = styled.div`
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: start;
  gap: 8px;

  & + & {
    margin-top: 6px;
  }
`;

const TierLabel = styled.span<{ $color: TierColor }>`
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 20px;
  color: ${({ theme, $color }) => readable(theme, $color)};
`;

const TierTypes = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const NoTiers = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

// Visible symbol plus spoken text, so screen readers don't read bare symbols
const TIERS: Record<
  DefenseMultiplier,
  { symbol: string; label: string; color: TierColor }
> = {
  4: { symbol: "4×", label: "4 times damage from", color: "error" },
  2: { symbol: "2×", label: "2 times damage from", color: "error" },
  0.5: { symbol: "½×", label: "Half damage from", color: "success" },
  0.25: { symbol: "¼×", label: "Quarter damage from", color: "success" },
  0: { symbol: "0×", label: "Immune to", color: "info" },
};

function MemberDefense({ member }: { member: Pokemon }) {
  const tiers = memberDefense(member);
  return (
    <MemberEntry data-testid="defense-member">
      <MemberHeader>
        <SpriteBox>
          <img
            src={member.sprite_url}
            alt=""
            width={36}
            height={36}
            loading="lazy"
          />
        </SpriteBox>
        <MemberName>{formatName(member.name)}</MemberName>
      </MemberHeader>
      {tiers.length === 0 && <NoTiers>Normal damage from every type.</NoTiers>}
      {tiers.map(({ multiplier, types }) => {
        const tier = TIERS[multiplier];
        return (
          <TierRow key={multiplier}>
            <TierLabel $color={tier.color} aria-hidden="true">
              {tier.symbol}
            </TierLabel>
            <TierTypes aria-label={tier.label}>
              {types.map((type) => (
                <li key={type}>
                  <TypeBadge type={type} size="small" />
                </li>
              ))}
            </TierTypes>
          </TierRow>
        );
      })}
    </MemberEntry>
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
  const { uncovered } = offensiveCoverage(team);

  return (
    <>
      <SectionPaper elevation={1}>
        <SectionTitle>Defensive Overview</SectionTitle>
        <MemberList aria-label="Damage each team member takes">
          {team.map((member, i) => (
            <MemberDefense key={`${member.id}-${i}`} member={member} />
          ))}
        </MemberList>
        <Note>
          Types not listed hit that Pokémon for normal 1× damage. 0× means
          immune.
        </Note>
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
