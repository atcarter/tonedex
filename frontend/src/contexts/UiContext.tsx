import { createContext, useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { Toast } from "../types";
import type { ColorMode } from "../theme";

// Ephemeral UI chrome — toast and color mode — isolated from AppContext so
// that toast churn doesn't re-render every auth/game consumer (each grid card
// reads currentUser from AppContext).
interface UiContextValue {
  toast: Toast | null;
  showToast: (toast: Toast) => void;
  clearToast: () => void;
  colorMode: ColorMode;
  toggleColorMode: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its provider
export const UiContext = createContext<UiContextValue | null>(null);

const COLOR_MODE_KEY = "pokedex_color_mode";

function loadColorMode(): ColorMode {
  const stored = localStorage.getItem(COLOR_MODE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // Fall back to OS preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);

  const showToast = useCallback((next: Toast) => setToast(next), []);
  const clearToast = useCallback(() => setToast(null), []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next: ColorMode = prev === "light" ? "dark" : "light";
      localStorage.setItem(COLOR_MODE_KEY, next);
      return next;
    });
  }, []);

  return (
    <UiContext.Provider
      value={{ toast, showToast, clearToast, colorMode, toggleColorMode }}
    >
      {children}
    </UiContext.Provider>
  );
}
