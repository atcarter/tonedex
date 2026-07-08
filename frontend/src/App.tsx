import styled from "styled-components";
import { Routes, Route } from "react-router-dom";
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
import { FavoritesPage } from "./pages/FavoritesPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex: 1;
  margin-top: 64px;
  min-height: calc(100vh - 64px);
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 64px);
  font-size: 1.1rem;
`;

function AppBarContent() {
  const navigate = useNavigate();
  const { selectedGame, colorMode, toggleColorMode } = useAppContext();

  return (
    <AppBar position="fixed" sx={{ bgcolor: "primary.main", zIndex: 1201 }}>
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

  return (
    <Layout>
      <AppBarContent />
      <MainContent>
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
            <Route
              path="/game/:gameId/pokemon/:pokemonName"
              element={<PokemonDetailPage />}
            />
            <Route
              path="/pokemon/:pokemonName"
              element={<PokemonDetailPage />}
            />
            <Route path="/favorites" element={<FavoritesPage />} />
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
