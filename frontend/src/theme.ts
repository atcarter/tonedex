import { createTheme } from "@mui/material/styles";

export type ColorMode = "light" | "dark";

export function buildTheme(mode: ColorMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#cc0000",
        dark: "#990000",
        light: "#ff4444",
        contrastText: "#ffffff",
      },
      secondary: {
        main: isDark ? "#484848" : "#212121",
        light: "#686868",
        contrastText: "#ffffff",
      },
      background: {
        default: isDark ? "#121212" : "#e8e8e8",
        paper: isDark ? "#1e1e1e" : "#ffffff",
      },
      text: {
        primary: isDark ? "#e8e8e8" : "#1a1a1a",
        secondary: isDark ? "#aaaaaa" : "#666666",
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
    },
  });
}
