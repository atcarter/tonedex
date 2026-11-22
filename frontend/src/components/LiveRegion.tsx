import styled from "styled-components";

// Visually hidden; give it aria-live so screen readers announce its text
export const LiveRegion = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;
