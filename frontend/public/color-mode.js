// Same key and fallback as loadColorMode in src/contexts/UiContext.tsx
{
  let stored = null;
  try {
    stored = localStorage.getItem("pokedex_color_mode");
  } catch {
    // Storage blocked; use the system scheme
  }
  document.documentElement.dataset.colorMode =
    stored === "dark" || stored === "light"
      ? stored
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}
