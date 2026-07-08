import "styled-components";
import type { Theme } from "@mui/material/styles";

// styled-components receives the MUI theme via ThemedApp's SCThemeProvider,
// so `${({ theme }) => theme.palette...}` is fully typed in styled templates.
declare module "styled-components" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends Theme {}
}
