# ADR-005 — URL as source of truth for game selection

**Date:** 2026-03-01
**Status:** Accepted

> **Status note (2026-11-02):** since 2026-07-08 the selector also matches `/game/:gameId/*`, so it shows the current game on
> detail pages, and a game is auto-selected only on `/`, so deep links are never redirected.

## Context

The `GameSelector` dropdown needed to show which game is currently active. Two approaches were considered:

**Option A — Context state (`selectedGame`):** The `Select` value reads `selectedGame?.id` from `AppContext`. `GameSelector` populates context asynchronously after fetching the games list; `GamePage` also syncs context when games are loaded.

**Option B — URL (`useMatch`):** The `Select` value is derived synchronously from the current URL using `useMatch("/game/:gameId")`. Context is still populated as a side-effect but is not the rendering source of truth for the selector.

Option A had a race condition: during the first render, `selectedGame` is `null` (context not yet hydrated), so the dropdown showed "no game selected" even when the URL and `GamePage` both had the correct game loaded. This was visually confusing and only resolved once the async fetch completed.

## Decision

Use **Option B**. The `Select` component renders `value={urlGameId ?? ""}` where `urlGameId` is derived from `useMatch`. `AppContext.selectedGame` is still kept in sync (for other consumers that need the full `Game` object without URL access) but is not the dropdown's display value.

## Consequences

**Accepted trade-offs:**
- `GameSelector` reads from two sources (URL and context), which is slightly more logic than either approach alone.
- If the URL contains a game ID that does not exist in the loaded games list, the Select will render with an unmatched value (blank display), though this is the correct behaviour — it accurately reflects an invalid state.

**Benefits gained:**
- The dropdown reflects the correct game immediately on every render, including hard refreshes and direct URL navigation, with zero timing dependency.
- Removes the fragile dependency on two async operations (games fetch + context sync) completing before the first meaningful render.
- Aligns with the React Router principle that the URL is the canonical application state for navigation-related data.
