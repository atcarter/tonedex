// Official-style type colors. Text color per badge is chosen for WCAG AA
// contrast (≥4.5:1) against the background — the light/bright backgrounds
// take dark text (audited 2026-07-10; worst pairing is now 5.59:1, psychic).
export const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  normal: { bg: "#a8a878", color: "#1a1a1a" },
  fire: { bg: "#f08030", color: "#1a1a1a" },
  water: { bg: "#6890f0", color: "#1a1a1a" },
  electric: { bg: "#f8d030", color: "#1a1a1a" },
  grass: { bg: "#78c850", color: "#1a1a1a" },
  ice: { bg: "#98d8d8", color: "#1a1a1a" },
  fighting: { bg: "#c03028", color: "#fff" },
  poison: { bg: "#a040a0", color: "#fff" },
  ground: { bg: "#e0c068", color: "#1a1a1a" },
  flying: { bg: "#a890f0", color: "#1a1a1a" },
  psychic: { bg: "#f85888", color: "#1a1a1a" },
  bug: { bg: "#a8b820", color: "#1a1a1a" },
  rock: { bg: "#b8a038", color: "#1a1a1a" },
  ghost: { bg: "#705898", color: "#fff" },
  dragon: { bg: "#7038f8", color: "#fff" },
  dark: { bg: "#705848", color: "#fff" },
  steel: { bg: "#b8b8d0", color: "#1a1a1a" },
  fairy: { bg: "#ee99ac", color: "#1a1a1a" },
};
