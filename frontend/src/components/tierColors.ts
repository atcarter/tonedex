import type { Theme } from "@mui/material/styles";

export type TierColor = "error" | "success" | "info";

// The mode's stronger shade keeps text above 4.5:1 on the paper
export const readable = (theme: Theme, color: TierColor) =>
  theme.palette.mode === "dark"
    ? theme.palette[color].light
    : theme.palette[color].dark;
