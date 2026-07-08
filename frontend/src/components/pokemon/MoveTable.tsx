import styled from "styled-components";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import CircularProgress from "@mui/material/CircularProgress";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ReactNode } from "react";
import type { BasicMove, MoveDetails } from "../../types";
import { TypeBadge } from "../TypeBadge";
import { formatName } from "../../utils/formatters";

// ── Accordion styling ────────────────────────────────────────────────────────

const StyledAccordion = styled(Accordion)`
  border: 1px solid #e8e8e8 !important;
  border-radius: 6px !important;
  margin-bottom: 4px !important;
  box-shadow: none !important;

  &::before {
    display: none !important;
  }

  &.Mui-expanded {
    border-color: #cc0000 !important;
  }
`;

const StyledAccordionSummary = styled(AccordionSummary)`
  min-height: 44px !important;

  &.Mui-expanded {
    min-height: 44px !important;
    background: #fff8f8 !important;
  }

  .MuiAccordionSummary-content {
    margin: 10px 0 !important;
    align-items: center !important;
    gap: 8px !important;
  }
`;

const StyledAccordionDetails = styled(AccordionDetails)`
  padding: 12px 16px !important;
  background: #fafafa !important;
`;

const StyledExpandIcon = styled(ExpandMoreIcon)`
  color: #999 !important;
  font-size: 18px !important;
`;

// ── Summary row ──────────────────────────────────────────────────────────────

const MoveName = styled.span`
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1a1a1a;
`;

const LearnMethod = styled.span`
  font-size: 0.75rem;
  color: #888;
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
  color: #888;
`;

const RedSpinner = styled(CircularProgress)`
  color: #cc0000 !important;
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
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const DetailValue = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: #1a1a1a;
  text-transform: capitalize;
`;

const ErrorText = styled.span`
  font-size: 0.75rem;
  color: #cc0000;
`;

// ── Empty / hint ─────────────────────────────────────────────────────────────

const HintText = styled.span`
  display: block;
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 8px;
`;

const EmptyText = styled.span`
  font-size: 0.875rem;
  color: #888;
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
  isLoading: boolean;
  details?: MoveDetails;
  onClick: () => void;
}

function MoveRow({
  move,
  isExpanded,
  isLoading,
  details,
  onClick,
}: MoveRowProps) {
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
        ) : (
          <ErrorText>Failed to load move details</ErrorText>
        )}
      </StyledAccordionDetails>
    </StyledAccordion>
  );
}

// ── MoveTable (exported) ─────────────────────────────────────────────────────

interface MoveTableProps {
  moves: BasicMove[];
  expandedMove: string | null;
  loadingMove: string | null;
  moveCache: Record<string, MoveDetails>;
  onMoveClick: (name: string) => void;
}

export function MoveTable({
  moves,
  expandedMove,
  loadingMove,
  moveCache,
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
          isLoading={loadingMove === move.name}
          details={moveCache[move.name]}
          onClick={() => onMoveClick(move.name)}
        />
      ))}
    </>
  );
}
