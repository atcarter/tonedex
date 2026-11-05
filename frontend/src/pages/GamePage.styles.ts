import styled, { css } from "styled-components";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";

export const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;

  /* Auto margins shrink-wrap this, so a nowrap chip row would widen the page */
  ${({ theme }) => theme.breakpoints.down("sm")} {
    width: 100%;
  }
`;

export const FilterBar = styled.div`
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    grid-template-columns: repeat(3, 1fr);
    /* Every row as tall as the tallest, so all cards share one size */
    grid-auto-rows: 1fr;
    gap: 8px;

    /* Stop a long name widening its column */
    > * {
      min-width: 0;
    }
  }
`;

export const Sentinel = styled.div`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  color: ${({ theme }) => theme.palette.text.disabled};
  font-size: 0.8rem;
  gap: 8px;
`;

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 12px;
`;

export const LoadingText = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

export const RedSpinner = styled(CircularProgress)`
  color: ${({ theme }) => theme.palette.primary.main} !important;
`;

export const ErrorText = styled.p`
  color: ${({ theme }) => theme.palette.error.main};
  font-size: 0.875rem;
  padding: 24px;
  margin: 0;
`;

export const CountText = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

export const CaughtCounter = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

export const CaughtDot = styled.span`
  color: ${({ theme }) => theme.palette.primary.main};
  font-size: 0.6rem;
  line-height: 1;
`;

// Negative margin cancels PageWrapper's padding so the row reaches the edge.
const scrollingChipRow = css`
  ${({ theme }) => theme.breakpoints.down("sm")} {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    margin-left: -16px;
    margin-right: -16px;
    padding-left: 16px;
    padding-right: 16px;

    &::-webkit-scrollbar {
      display: none;
    }

    > * {
      flex-shrink: 0;
      scroll-snap-align: start;
    }
  }
`;

export const TypeFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  ${scrollingChipRow}

  ${({ theme }) => theme.breakpoints.down("sm")} {
    .MuiChip-root {
      height: 32px;
    }
  }
`;

// Dex-section quick-jump (generation tabs don't fit regional dexes — their
// ordering interleaves generations, so numeric sections are the honest cut)
export const JumpRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  ${scrollingChipRow}
`;

export const JumpLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
`;

export const JumpChip = styled.button`
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  background: none;
  color: ${({ theme }) => theme.palette.text.secondary};
  font-family: inherit;
  cursor: pointer;

  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-height: 32px;
    border-radius: 16px;
  }

  &:hover {
    border-color: ${({ theme }) => theme.palette.primary.main};
    color: ${({ theme }) => theme.palette.primary.main};
  }
`;

export const BackToTop = styled(IconButton)<{ $visible: boolean }>`
  position: fixed !important;
  /* Clear the home indicator on notched phones */
  bottom: calc(20px + env(safe-area-inset-bottom)) !important;
  right: 20px !important;
  z-index: 1200 !important;
  background: ${({ theme }) => theme.palette.primary.main} !important;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity 0.2s ease !important;

  svg {
    color: #fff;
  }
`;

// Amber tones stay recognisable as a "heads up" in both color modes
export const SeedingBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(255, 193, 7, 0.12);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.secondary};
`;
