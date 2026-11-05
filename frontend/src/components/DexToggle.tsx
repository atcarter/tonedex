import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { DexView } from "../types";

interface DexToggleProps {
  value: DexView;
  onChange: (dex: DexView) => void;
}

/** Regional (the game's own dex) or National (every species in its data). */
export function DexToggle({ value, onChange }: DexToggleProps) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      // A click on the active button passes null; keep the current view
      onChange={(_, next: DexView | null) => next && onChange(next)}
      aria-label="dex view"
      sx={{
        flexShrink: 0,
        "& .MuiToggleButton-root": {
          px: 1.25,
          py: 0.25,
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "none",
          // MUI's default action.active fails 4.5:1 on the page background
          color: "text.secondary",
          "&.Mui-selected": { color: "text.primary" },
        },
      }}
    >
      <ToggleButton value="regional">Regional</ToggleButton>
      <ToggleButton value="national">National</ToggleButton>
    </ToggleButtonGroup>
  );
}
