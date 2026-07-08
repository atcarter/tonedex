import styled from "styled-components";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import CircularProgress from "@mui/material/CircularProgress";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { BasicMove } from "../../types";
import { useMove } from "../../hooks/useMove";
import { TypeBadge } from "../TypeBadge";
import { formatName } from "../../utils/formatters";

// ── Accordion styling ────────────────────────────────────────────────────────

const StyledAccordion = styled(Accordion)`
  border: 1px solid ${({ theme }) => theme.palette.divider} !important;
  border-radius: 6px !important;
  margin-bottom: 4px !important;
  box-shadow: none !important;

  &::before {
    display: none !important;
  }

  &.Mui-expanded {
    border-color: ${({ theme }) => theme.palette.primary.main} !important;
  }
`;

const StyledAccordionSummary = styled(AccordionSummary)`
  min-height: 44px !important;

  &.Mui-expanded {
    min-height: 44px !important;
    background: ${({ theme }) =>
      alpha(theme.palette.primary.main, 0.06)} !important;
  }

  .MuiAccordionSummary-content {
    margin: 10px 0 !important;
    align-items: center !important;
    gap: 8px !important;
  }
`;

const StyledAccordionDetails = styled(AccordionDetails)`
  padding: 12px 16px !important;
  background: ${({ theme }) => theme.palette.action.hover} !important;
`;

const StyledExpandIcon = styled(ExpandMoreIcon)`
  color: ${({ theme }) => theme.palette.text.disabled} !important;
  font-size: 18px !important;
`;

// ── Summary row ──────────────────────────────────────────────────────────────

const MoveName = styled.span`
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme.palette.text.primary};
`;

const LearnMethod = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin-right: 4px;
`;

// ── Detail content ───────────────────────────────────────────────────────────

const LoadingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LoadingText = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const RedSpinner = styled(CircularProgress)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
`;

const DetailsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
`;

const DetailItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 72px;
`;

const DetailLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const DetailValue = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.primary};
  text-transform: capitalize;
`;

const ErrorText = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.error.main};
`;

// ── Empty / hint ─────────────────────────────────────────────────────────────

const HintText = styled.span`
  display: block;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin-bottom: 8px;
`;

const EmptyText = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

// ── MoveDetail sub-component ─────────────────────────────────────────────────

interface MoveDetailProps {
  label: string;
  value?: string | number | null;
  children?: ReactNode;
}

function MoveDetail({ label, value, children }: MoveDetailProps) {
  return (
    <DetailItemWrapper>
      <DetailLabel>{label}</DetailLabel>
      {children ?? <DetailValue>{value}</DetailValue>}
    </DetailItemWrapper>
  );
}

// ── MoveRow sub-component ────────────────────────────────────────────────────

interface MoveRowProps {
  move: BasicMove;
  isExpanded: boolean;
  onClick: () => void;
}

function MoveRow({ move, isExpanded, onClick }: MoveRowProps) {
  // Lazy: only fetches (once, then cached) while this row is expanded
  const { data: details, isLoading, isError } = useMove(move.name, isExpanded);

  return (
    <StyledAccordion
      expanded={isExpanded}
      onChange={() => onClick()}
      elevation={0}
      disableGutters
    >
      <StyledAccordionSummary expandIcon={<StyledExpandIcon />}>
        <MoveName>{formatName(move.name)}</MoveName>
        <LearnMethod>
          {move.learn_method === "level-up"
            ? `Lv. ${move.level_learned}`
            : formatName(move.learn_method)}
        </LearnMethod>
      </StyledAccordionSummary>
      <StyledAccordionDetails>
        {isLoading ? (
          <LoadingRow>
            <RedSpinner size={14} />
            <LoadingText>Loading...</LoadingText>
          </LoadingRow>
        ) : isError ? (
          <ErrorText>Failed to load move details</ErrorText>
        ) : details ? (
          <DetailsGrid>
            <MoveDetail label="Type">
              <TypeBadge type={details.type} size="small" />
            </MoveDetail>
            <MoveDetail label="Class" value={details.damage_class} />
            <MoveDetail label="Power" value={details.power ?? "—"} />
            <MoveDetail
              label="Accuracy"
              value={details.accuracy ? `${details.accuracy}%` : "—"}
            />
            <MoveDetail label="PP" value={details.pp} />
          </DetailsGrid>
        ) : null}
      </StyledAccordionDetails>
    </StyledAccordion>
  );
}

// ── MoveTable (exported) ─────────────────────────────────────────────────────

interface MoveTableProps {
  moves: BasicMove[];
  expandedMove: string | null;
  onMoveClick: (name: string) => void;
}

export function MoveTable({
  moves,
  expandedMove,
  onMoveClick,
}: MoveTableProps) {
  if (moves.length === 0) {
    return <EmptyText>No moves found for this game version.</EmptyText>;
  }

  return (
    <>
      <HintText>Click a move to see details</HintText>
      {moves.map((move, index) => (
        <MoveRow
          key={`${move.name}-${index}`}
          move={move}
          isExpanded={expandedMove === move.name}
          onClick={() => onMoveClick(move.name)}
        />
      ))}
    </>
  );
}
