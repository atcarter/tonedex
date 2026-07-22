import { useEffect, useRef } from "react";
import styled from "styled-components";
import { Routes, Route, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "./hooks/useAppContext";
import { GameSelector } from "./components/GameSelector";
import { PokemonSearch } from "./components/PokemonSearch";
import { AuthButton } from "./components/AuthButton";
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

function AppBarContent() {
  const navigate = useNavigate();
  const { selectedGame, colorMode, toggleColorMode } = useAppContext();

  return (
    <AppBar position="sticky" sx={{ bgcolor: "primary.main", zIndex: 1201 }}>
      <Toolbar sx={{ gap: 2, flexWrap: "wrap", minHeight: "64px" }}>
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{
            letterSpacing: 2,
            flexShrink: 0,
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
          onClick={() =>
            selectedGame ? navigate(`/game/${selectedGame.id}`) : navigate("/")
          }
        >
          ◆ POKÉDEX
        </Typography>
        <Box sx={{ flexShrink: 0 }}>
          <GameSelector />
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <PokemonSearch />
        </Box>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            onClick={() => navigate("/favorites")}
            sx={{ color: "white" }}
            aria-label="favorites"
          >
            <FavoriteIcon />
          </IconButton>
          <Tooltip
            title={
              colorMode === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            <IconButton
              onClick={toggleColorMode}
              sx={{ color: "white" }}
              aria-label="toggle color mode"
            >
              {colorMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <AuthButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function App() {
  const { toast, clearToast } = useAppContext();
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
      <AppBarContent />
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
