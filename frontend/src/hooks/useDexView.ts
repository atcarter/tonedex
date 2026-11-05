import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { DexView } from "../types";

/** `?dex=national` in the URL (ADR-005); no param means regional. */
export function parseDexView(value: string | null): DexView {
  return value === "national" ? "national" : "regional";
}

/** Query string carrying a dex view onto a game-scoped link. */
export function dexSearch(dex: DexView): string {
  return dex === "national" ? "?dex=national" : "";
}

export function useDexView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dex = parseDexView(searchParams.get("dex"));

  const setDex = useCallback(
    (next: DexView) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next === "national") params.set("dex", "national");
        else params.delete("dex");
        // The loaded depth belongs to the other list
        params.delete("loaded");
        return params;
      });
    },
    [setSearchParams],
  );

  return [dex, setDex] as const;
}
