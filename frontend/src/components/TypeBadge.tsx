import styled from "styled-components";
import Chip from "@mui/material/Chip";
import { TYPE_COLORS } from "../constants/typeColors";

const StyledChip = styled(Chip)<{
  $bg: string;
  $color: string;
  $small: boolean;
}>`
  background-color: ${(props) => props.$bg} !important;
  color: ${(props) => props.$color} !important;
  font-weight: 700 !important;
  text-transform: capitalize !important;
  font-size: ${(props) => (props.$small ? "0.7rem" : "0.8rem")} !important;
  height: ${(props) => (props.$small ? "20px" : "26px")} !important;

  .MuiChip-label {
    padding: ${(props) => (props.$small ? "0 6px" : "0 8px")} !important;
  }
`;

interface TypeBadgeProps {
  type: string;
  size?: "small" | "default";
}

export function TypeBadge({ type, size = "default" }: TypeBadgeProps) {
  const c = TYPE_COLORS[type] ?? { bg: "#999", color: "#fff" };
  return (
    <StyledChip
      label={type}
      size={size === "small" ? "small" : undefined}
      $bg={c.bg}
      $color={c.color}
      $small={size === "small"}
    />
  );
}
