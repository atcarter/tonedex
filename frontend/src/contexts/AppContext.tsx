import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { CaughtEntry, Game, MoveDetails, Pokemon, User } from "../types";
import { registerUnauthorizedHandler } from "../lib/queryClient";
import {
  signInWithGoogle,
  getFavorites,
  addFavorite as apiFavoriteAdd,
  removeFavorite as apiFavoriteRemove,
  reorderFavorites as apiFavoriteReorder,
  getCaughtPokemons,
  catchPokemon as apiCatch,
  uncatchPokemon as apiUncatch,
  UnauthorizedError,
} from "../services/api";

export interface Toast {
  message: string;
  severity: "error" | "info" | "success";
}

interface AppContextValue {
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
  games: Game[];
  setGames: (games: Game[]) => void;
  favorites: Pokemon[];
  addFavorite: (p: Pokemon) => Promise<void>;
  removeFavorite: (pokemonId: number) => Promise<void>;
  reorderFavorites: (ordered: Pokemon[]) => Promise<void>;
  moveCache: Record<string, MoveDetails>;
  cacheMoveDetails: (name: string, details: MoveDetails) => void;
  caught: CaughtEntry[];
  loadCaughtForGame: (gameId: number) => Promise<void>;
  toggleCaught: (pokemonId: number, gameId: number) => Promise<void>;
  currentUser: User | null;
  token: string | null;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => void;
  toast: Toast | null;
  clearToast: () => void;
}

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [favorites, setFavorites] = useState<Pokemon[]>([]);
  const [moveCache, setMoveCache] = useState<Record<string, MoveDetails>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(loadUser);
  const [token, setToken] = useState<string | null>(loadToken);
  const [toast, setToast] = useState<Toast | null>(null);
  const [caught, setCaught] = useState<CaughtEntry[]>([]);

  const clearToast = useCallback(() => setToast(null), []);

  const clearAuthState = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setFavorites([]);
    setCaught([]);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Register the signOut handler with the QueryClient 401 interceptor.
  // useEffect runs after mount — queryClient already exists by then.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearAuthState();
      setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
    });
  }, [clearAuthState]);

  // On mount, restore favorites from API if already signed in
  useEffect(() => {
    if (token) {
      getFavorites(token)
        .then(setFavorites)
        .catch((err) => {
          clearAuthState();
          if (err instanceof UnauthorizedError) {
            setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
          }
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (idToken: string) => {
    const { token: jwt, user } = await signInWithGoogle(idToken);
    setToken(jwt);
    setCurrentUser(user);
    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const favs = await getFavorites(jwt);
    setFavorites(favs);
  }, []);

  const signOut = useCallback(() => {
    clearAuthState();
  }, [clearAuthState]);

  const addFavorite = useCallback(
    async (p: Pokemon) => {
      if (!token) return;
      try {
        const { id: favoriteId } = await apiFavoriteAdd(p.id, token);
        setFavorites((prev) =>
          prev.some((f) => f.id === p.id)
            ? prev
            : [...prev, { ...p, favorite_id: favoriteId }],
        );
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          clearAuthState();
          setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
        }
      }
    },
    [token, clearAuthState],
  );

  const removeFavorite = useCallback(
    async (pokemonId: number) => {
      if (!token) return;
      const fav = favorites.find((f) => f.id === pokemonId);
      if (!fav?.favorite_id) return;
      setFavorites((prev) => prev.filter((f) => f.id !== pokemonId));
      try {
        await apiFavoriteRemove(fav.favorite_id, token);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          clearAuthState();
          setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
        } else {
          setFavorites((prev) => [...prev, fav]);
        }
      }
    },
    [token, favorites, clearAuthState],
  );

  const reorderFavorites = useCallback(
    async (ordered: Pokemon[]) => {
      if (!token) return;
      // Optimistic update — UI reflects new order immediately
      setFavorites(ordered);
      try {
        await apiFavoriteReorder(ordered.map((p) => p.favorite_id!), token);
      } catch (err) {
        // Revert to previous order on failure
        setFavorites((prev) => [...prev]);
        if (err instanceof UnauthorizedError) {
          clearAuthState();
          setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
        }
      }
    },
    [token, clearAuthState],
  );

  const loadCaughtForGame = useCallback(
    async (gameId: number) => {
      if (!token) return;
      try {
        const entries = await getCaughtPokemons(gameId, token);
        setCaught((prev) => [
          ...prev.filter((c) => c.game_id !== gameId),
          ...entries,
        ]);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          clearAuthState();
          setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
        }
      }
    },
    [token, clearAuthState],
  );

  const toggleCaught = useCallback(
    async (pokemonId: number, gameId: number) => {
      if (!token) return;
      const existing = caught.find(
        (c) => c.pokemon_id === pokemonId && c.game_id === gameId,
      );
      // Optimistic update
      if (existing) {
        setCaught((prev) => prev.filter((c) => c.id !== existing.id));
      }
      try {
        if (existing) {
          await apiUncatch(existing.id, token);
        } else {
          const entry = await apiCatch(pokemonId, gameId, token);
          setCaught((prev) => [...prev, entry]);
        }
      } catch (err) {
        // Revert on failure
        setCaught((prev) =>
          existing ? [...prev, existing] : prev.filter((c) => c.pokemon_id !== pokemonId || c.game_id !== gameId),
        );
        if (err instanceof UnauthorizedError) {
          clearAuthState();
          setToast({ message: SESSION_EXPIRED_MSG, severity: "info" });
        }
      }
    },
    [token, caught, clearAuthState],
  );

  const cacheMoveDetails = useCallback((name: string, details: MoveDetails) => {
    setMoveCache((prev) => ({ ...prev, [name]: details }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedGame,
        setSelectedGame,
        games,
        setGames,
        favorites,
        addFavorite,
        removeFavorite,
        reorderFavorites,
        moveCache,
        cacheMoveDetails,
        caught,
        loadCaughtForGame,
        toggleCaught,
        currentUser,
        token,
        signIn,
        signOut,
        toast,
        clearToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
