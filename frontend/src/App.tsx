import { useEffect, useRef } from "react";
import styled from "styled-components";
import { Routes, Route, useLocation } from "react-router-dom";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useUi } from "./hooks/useUi";
import { AppHeader } from "./components/AppHeader";
import { GamePage } from "./pages/GamePage";
import { PokemonDetailPage } from "./pages/PokemonDetailPage";
import { TeamBuilderPage } from "./pages/TeamBuilderPage";
import { ComparePage } from "./pages/ComparePage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* dvh follows collapsing phone address bars; vh above is the fallback */
  min-height: 100dvh;
`;

// The AppBar is position: sticky (in normal flow), so content below is always
// pushed down by the header's real height — including when the toolbar wraps
// to multiple rows on narrow screens. No hardcoded 64px offsets.
// tabIndex={-1} target for programmatic focus on route changes — no visible
// ring on the whole region.
const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;

  &:focus {
    outline: none;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
`;

function App() {
  const { toast, clearToast } = useUi();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the main region on navigation so keyboard and screen-reader
  // users land on the new content instead of a now-removed element. Skipped on
  // initial load (the browser's default focus is correct there).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <Layout>
      <AppHeader />
      <MainContent ref={mainRef} tabIndex={-1}>
        <ErrorBoundary>
          <Routes>
            <Route
              path="/"
              element={
                <EmptyState>
                  Select a game to get started, or search for a Pokémon
                </EmptyState>
              }
            />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/game/:gameId/team" element={<TeamBuilderPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route
              path="/game/:gameId/pokemon/:pokemonName"
              element={<PokemonDetailPage />}
            />
            <Route
              path="/pokemon/:pokemonName"
              element={<PokemonDetailPage />}
            />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </MainContent>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={clearToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={clearToast}
          severity={toast?.severity ?? "info"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}

export default App;
