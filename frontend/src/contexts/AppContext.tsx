import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { Game, MoveDetails, Toast, User } from "../types";
import type { ColorMode } from "../theme";
import { queryClient, registerUnauthorizedHandler } from "../lib/queryClient";
import { signInWithGoogle } from "../services/api";

interface AppContextValue {
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
  moveCache: Record<string, MoveDetails>;
  cacheMoveDetails: (name: string, details: MoveDetails) => void;
  currentUser: User | null;
  token: string | null;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => void;
  toast: Toast | null;
  clearToast: () => void;
  colorMode: ColorMode;
  toggleColorMode: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its provider
export const AppContext = createContext<AppContextValue | null>(null);

const TOKEN_KEY = "pokedex_token";
const USER_KEY = "pokedex_user";
const MOVE_CACHE_KEY = "pokedex_move_cache";
const COLOR_MODE_KEY = "pokedex_color_mode";

function loadColorMode(): ColorMode {
  const stored = localStorage.getItem(COLOR_MODE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // Fall back to OS preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
const SESSION_EXPIRED_MSG = "Your session has expired. Please sign in again.";

function loadMoveCache(): Record<string, MoveDetails> {
  try {
    const stored = sessionStorage.getItem(MOVE_CACHE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, MoveDetails>) : {};
  } catch {
    return {};
  }
}

function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function loadUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [moveCache, setMoveCache] =
    useState<Record<string, MoveDetails>>(loadMoveCache);
  const [currentUser, setCurrentUser] = useState<User | null>(loadUser);
  const [token, setToken] = useState<string | null>(loadToken);
  const [toast, setToast] = useState<Toast | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);

  const clearToast = useCallback(() => setToast(null), []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next: ColorMode = prev === "light" ? "dark" : "light";
      localStorage.setItem(COLOR_MODE_KEY, next);
      return next;
    });
  }, []);

  const clearAuthState = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    queryClient.clear();
  }, []);

  // Register the signOut handler with the QueryClient 401 interceptor.
  // useEffect runs after mount — queryClient already exists by then.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearAuthState();
      setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
    });
  }, [clearAuthState]);

  const signIn = useCallback(async (idToken: string) => {
    const { token: jwt, user } = await signInWithGoogle(idToken);
    setToken(jwt);
    setCurrentUser(user);
    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Trigger React Query to refetch favorites now that token is set
    await queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }, []);

  const signOut = useCallback(() => {
    clearAuthState();
  }, [clearAuthState]);

  const cacheMoveDetails = useCallback((name: string, details: MoveDetails) => {
    setMoveCache((prev) => {
      const next = { ...prev, [name]: details };
      try {
        sessionStorage.setItem(MOVE_CACHE_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage may be unavailable (private browsing quota) — degrade gracefully
      }
      return next;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedGame,
        setSelectedGame,
        moveCache,
        cacheMoveDetails,
        currentUser,
        token,
        signIn,
        signOut,
        toast,
        clearToast,
        colorMode,
        toggleColorMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
