import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { Game, User } from "../types";
import { queryClient, registerUnauthorizedHandler } from "../lib/queryClient";
import { signInWithGoogle } from "../services/api";
import { useUi } from "../hooks/useUi";

// Auth + game-selection client state. All server state lives in React Query
// hooks (ADR-007); ephemeral UI chrome (toast, color mode) lives in UiContext.
interface AppContextValue {
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
  currentUser: User | null;
  token: string | null;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its provider
export const AppContext = createContext<AppContextValue | null>(null);

const TOKEN_KEY = "pokedex_token";
const USER_KEY = "pokedex_user";
const SESSION_EXPIRED_MSG = "Your session has expired. Please sign in again.";

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

// Must be nested inside UiProvider (the 401 handler raises a toast)
export function AppProvider({ children }: { children: ReactNode }) {
  const { showToast } = useUi();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(loadUser);
  const [token, setToken] = useState<string | null>(loadToken);

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
      showToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
    });
  }, [clearAuthState, showToast]);

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

  return (
    <AppContext.Provider
      value={{
        selectedGame,
        setSelectedGame,
        currentUser,
        token,
        signIn,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
