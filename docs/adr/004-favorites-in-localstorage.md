# ADR-004 — Favorites persisted to localStorage, no backend

**Date:** 2026-02-28
**Status:** Superseded by ADR-006

> **Status note:** favorites moved to a database table keyed on the user when Google sign-in landed on 2026-03-02
> (ADR-006). This record is kept for history.

## Context

Users need favorites to persist across browser sessions. The two realistic options given the current architecture (no user authentication) were:

| Option | Pros | Cons |
|---|---|---|
| `localStorage` on the client | Zero backend work; no auth required; instant reads/writes | Device-specific; cleared with browser data; no cross-device sync |
| Backend `favorites` table | Cross-device sync; shareable | Requires user accounts, session management, auth middleware, and a new migration |

## Decision

Persist favorites in **`localStorage`** under the key `pokedex_favorites`. The `AppContext` hydrates from storage on mount and writes back on every change. No backend involvement.

## Consequences

**Accepted trade-offs:**
- Favorites are device-specific. A user on a different browser or device starts with an empty list.
- Clearing browser storage or using private/incognito mode loses favorites.
- No server-side validation; a user could manually inject arbitrary data into localStorage.

**Revisit when:** User authentication is added. At that point, favorites should be migrated to a `favorites` table keyed on user ID, and the `localStorage` data should be merged into the server on first login.
