import { useContext } from "react";
import { UiContext } from "../contexts/UiContext";

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used within UiProvider");
  return ctx;
}
