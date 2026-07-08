import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import CssBaseline from "@mui/material/CssBaseline";
import { buildTheme } from "./theme";
import { useAppContext } from "./hooks/useAppContext";
import App from "./App.tsx";

// Wraps App in the MUI ThemeProvider; lives outside main.tsx so it can
// consume AppContext for the colorMode value. The same theme object is fed to
// styled-components so both styling systems share one palette (see styled.d.ts).
export function ThemedApp() {
  const { colorMode } = useAppContext();
  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  return (
    <ThemeProvider theme={theme}>
      <SCThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </SCThemeProvider>
    </ThemeProvider>
  );
}
