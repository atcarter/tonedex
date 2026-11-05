import styled from "styled-components";

// Shared by the About section's height, weight and abilities items

export const AboutItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const AboutLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;
