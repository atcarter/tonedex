import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import useScrollTrigger from "@mui/material/useScrollTrigger";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Slide from "@mui/material/Slide";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import FavoriteIcon from "@mui/icons-material/Favorite";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAppContext } from "../hooks/useAppContext";
import { useUi } from "../hooks/useUi";
import type { ColorMode } from "../theme";
import { GameSelector } from "./GameSelector";
import { PokemonSearch } from "./PokemonSearch";
import { AuthButton, GoogleSignIn, UserAvatar } from "./AuthButton";

// Below sm: one 56px row that hides on scroll; otherwise the original toolbar
export function AppHeader() {
  const theme = useTheme();
  // noSsr: match on first render so phones never flash the desktop header
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  return isPhone ? <PhoneHeader /> : <DesktopHeader />;
}

function Logo() {
  const navigate = useNavigate();
  const { selectedGame } = useAppContext();

  return (
    <Typography
      variant="h6"
      sx={{
        fontWeight: 800,
        letterSpacing: 2,
        flexShrink: 0,
        fontSize: "1.1rem",
        cursor: "pointer",
        // Shows TONEDEX; screen readers still read "ToneDex"
        textTransform: "uppercase",
      }}
      onClick={() =>
        selectedGame ? navigate(`/game/${selectedGame.name}`) : navigate("/")
      }
    >
      ◆ ToneDex
    </Typography>
  );
}

const colorModeLabel = (mode: ColorMode) =>
  mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

function DesktopHeader() {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useUi();

  return (
    <AppBar position="sticky" sx={{ bgcolor: "primary.main", zIndex: 1201 }}>
      <Toolbar sx={{ gap: 2, flexWrap: "wrap", minHeight: "64px" }}>
        <Logo />
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
          <Tooltip title={colorModeLabel(colorMode)}>
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

function PhoneHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearchRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpen = useRef(false);
  const scrolledDown = useScrollTrigger();

  // Refocus search on close; on navigation App's main-focus effect wins
  useEffect(() => {
    if (wasSearchOpen.current && !searchOpen) openSearchRef.current?.focus();
    wasSearchOpen.current = searchOpen;
  }, [searchOpen]);

  const closeSearch = () => setSearchOpen(false);

  return (
    // Never slide away mid-search
    <Slide appear={false} direction="down" in={!scrolledDown || searchOpen}>
      <AppBar position="sticky" sx={{ bgcolor: "primary.main", zIndex: 1201 }}>
        <Toolbar sx={{ gap: 1, minHeight: "56px" }}>
          {searchOpen ? (
            <>
              <IconButton
                edge="start"
                onClick={closeSearch}
                sx={{ color: "white" }}
                aria-label="close search"
              >
                <CloseIcon />
              </IconButton>
              <PokemonSearch expanded onClose={closeSearch} />
            </>
          ) : (
            <>
              <Logo />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <GameSelector />
              </Box>
              <IconButton
                ref={openSearchRef}
                onClick={() => setSearchOpen(true)}
                sx={{ color: "white" }}
                aria-label="open search"
              >
                <SearchIcon />
              </IconButton>
              <AccountMenu />
            </>
          )}
        </Toolbar>
      </AppBar>
    </Slide>
  );
}

function AccountMenu() {
  const navigate = useNavigate();
  const { currentUser, signOut } = useAppContext();
  const { colorMode, toggleColorMode } = useUi();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const close = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        edge="end"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: "white" }}
        aria-label="account"
        aria-haspopup="menu"
        aria-controls={anchorEl ? "account-menu" : undefined}
        aria-expanded={anchorEl ? true : undefined}
      >
        {currentUser ? (
          <UserAvatar user={currentUser} />
        ) : (
          <AccountCircleIcon />
        )}
      </IconButton>
      <Menu
        id="account-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            close();
            navigate("/favorites");
          }}
        >
          <ListItemIcon>
            <FavoriteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Favorites</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            toggleColorMode();
          }}
        >
          <ListItemIcon>
            {colorMode === "dark" ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>{colorModeLabel(colorMode)}</ListItemText>
        </MenuItem>
        <Divider />
        {currentUser ? (
          <MenuItem
            onClick={() => {
              close();
              signOut();
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Sign out</ListItemText>
          </MenuItem>
        ) : (
          // Google's iframe button can't be a MenuItem; mounts only when open
          <Box sx={{ px: 2, py: 1 }}>
            <GoogleSignIn />
          </Box>
        )}
      </Menu>
    </>
  );
}
