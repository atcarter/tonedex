# ADR-007 — TanStack Query for Server State Management

**Date:** 2026-03-13
**Status:** Accepted

> **Status note (2026-11-02):** toast and color mode later moved from `AppContext` into a separate `UiContext` (2026-07-22),
> so `AppContext` holds only auth and the selected game. Search suggestions, added later, use a 5-minute `staleTime`.

## Context

Async state handling in the frontend was inconsistent. Each data-fetching component (`GamePage`, `PokemonDetail`, `GameSelector`) independently managed its own `loading`, `error`, and `data` state with no shared pattern. `AppContext` conflated server state (favorites, caught, games lists) with UI/auth state (selectedGame, token, toast), making it responsible for too many concerns and causing unnecessary re-renders across unrelated consumers.

Specific problems:
- No caching — navigating back to a game page always re-fetched
- No deduplication — multiple components mounting simultaneously could fire the same request twice
- No consistent retry or error handling — 401s were caught manually in per-call `catch` blocks
- No background refetch — user-owned data (favorites, caught) could go stale across tabs/devices

## Decision

Adopt **TanStack Query** (`@tanstack/react-query`) as the standard for all server state. `AppContext` is trimmed to pure UI and auth state only.

## Stale Time Strategy

Data is grouped by mutability:

| Query | staleTime | Rationale |
|---|---|---|
| Games, Pokémon, Moves | `Infinity` | PokeAPI data is seeded once and never changes — no reason to ever background-refetch |
| Favorites, Caught | `0` | User-owned data should be refetched on every mount for cross-tab/device consistency |

## Consequences

**Positive:**
- Uniform `isLoading | error | data` pattern across all data-fetching components
- Built-in caching: navigating back to a visited game page is instant
- Built-in deduplication: duplicate requests are collapsed automatically
- Global 401 handler on `QueryCache.onError` replaces scattered per-call `catch` blocks
- `queryClient.clear()` on sign-out atomically wipes all user-scoped cache
- `useInfiniteQuery` replaces GamePage's manual pagination state machine (~60 lines)
- ~200 lines net removed from AppContext, GamePage, PokemonDetail, GameSelector

**Negative:**
- New dependency (~50kb gzipped)
- Migration touches most frontend files — higher short-term risk
- Team needs familiarity with React Query concepts (queryKey, staleTime, invalidation)

## Alternatives Considered

**Custom `useAsync` hook:** A lightweight wrapper around `loading | error | data`. No new dependency. Rejected because it doesn't solve caching, deduplication, or the AppContext conflation problem — and the app is complex enough that React Query's benefits justify the dependency.
