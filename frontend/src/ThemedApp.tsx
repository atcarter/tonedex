import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { buildTheme } from "./theme";
import { useAppContext } from "./hooks/useAppContext";
import App from "./App.tsx";

// Wraps App in the MUI ThemeProvider; lives outside main.tsx so it can
// consume AppContext for the colorMode value.
export function ThemedApp() {
  const { colorMode } = useAppContext();
  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
