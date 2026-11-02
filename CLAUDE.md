# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ToneDex is a game-specific Pokédex SPA. Users select a Pokémon game and browse its regional dex; they can sign in with Google to persist favorites across devices. The app is a React frontend talking to a Rails 8 API-only backend, fully containerised with Docker Compose.

---

## Architecture

```
Browser
  │
  ├── React SPA (Vite, port 5173)
  │     ├── @react-oauth/google  ──── Google ID token ──▶ POST /api/v1/auth/google
  │     ├── Authorization: Bearer <jwt>  ──────────────▶ API routes
  │     └── /auth/login (browser redirect) ────────────▶ OmniAuth → /sidekiq
  │
  └── Rails 8 API (Puma, port 3000)
        │
        ├── API routes (/api/v1/*)
        │     ├── SessionsController   — verifies Google ID token, issues JWT
        │     ├── FavoritesController  — authenticated CRUD + reorder (JWT)
        │     ├── CaughtPokemonsController — per-game catch tracking (JWT)
        │     ├── GamesController      — game list + paginated Pokémon
        │     ├── PokemonController    — detail, search, suggestions
        │     └── MovesController      — move detail
        │
        ├── Auth routes (/auth/*)
        │     └── AuthController (ActionController::Base) — OmniAuth callback → session cookie
        │
        ├── Health check (/up) — pings Postgres and Redis
        │
        ├── Sidekiq Web UI (/sidekiq) — gated by SidekiqAuth Rack middleware
        │
        ├── Services
        │     ├── PokeapiClient   — HTTP to pokeapi.co, delegates cache reads/writes
        │     ├── CacheService    — thin facade over ApiCache (Postgres api_caches table)
        │     ├── PokeapiAdapter  — turns PokeAPI payloads into attribute hashes
        │     ├── PokemonImporter — owns every write to games, pokemons, moves and their join tables
        │     └── SpriteStore     — mirrors sprite PNGs into public/sprites
        │
        └── Background jobs (Sidekiq, Redis db 0)
              ├── SeedGamePokemonJob    — triggered on first game load (lazy seeding)
              ├── SeedAllPokemonJob     — seeds all Pokémon base data
              ├── PreloadGamePokemonJob — pre-warms a game's dex
              ├── WarmMoveCacheJob      — pre-warms a move entry
              └── MirrorSpriteJob       — mirrors a new Pokémon's sprites

PostgreSQL
  ├── games, pokemons, game_pokemons, moves, pokemon_moves
  ├── users, favorites, caught_pokemons
  └── api_caches (PokeAPI response cache)

Redis
  └── db 0 — Sidekiq queues, Rack::Attack throttle store, seed-job locks
```

### Data flow: lazy seeding

Pokémon data is seeded by Sidekiq jobs, never inside a request (ADR-002). `rails pokedex:seed` seeds every game up front; otherwise a game seeds on its first visit. When `GET /api/v1/games/:id` finds a game with no Pokémon yet (`game.game_pokemons.empty?`), it enqueues `SeedGamePokemonJob` (once, behind a Redis lock) and returns `pagination.seeding: true` with an empty list; `useGame` polls every 5s until the dex fills in. Subsequent requests read from the database.

### PokeAPI caching

`PokeapiClient` never hits the network without checking `CacheService` first. Raw PokeAPI JSON is stored by endpoint path in the `api_caches` Postgres table (`CacheService` is a thin facade over the `ApiCache` model). Each PokeAPI endpoint is fetched at most once across all time. (An earlier Redis-backed cache option was removed; there is no `CACHE_BACKEND` switch.)

`PokeapiAdapter` (through `PokeapiClient`) is the only place that calls PokeAPI, and `PokemonImporter` is the only place that writes `games`, `pokemons`, `moves`, `game_pokemons` and `pokemon_moves`. Do not add PokeAPI calls or writes elsewhere. Two request paths reach the adapter at runtime, always cache-first: search for a name not yet in the database, and move details.

### Sprite self-hosting

Sprite PNGs are mirrored into `backend/public/sprites/<pokeapi_id>.png` (shiny under `sprites/shiny/`) and **committed to git** — production disks are ephemeral, so the mirror must ship in the image. `PokemonSerializer` serves the mirrored URL (rooted at the request origin) and falls back to the original PokeAPI URL for anything not mirrored. Run `rails pokedex:mirror_sprites` after adding a game and commit the new files; `MirrorSpriteJob` also mirrors new pokemon automatically in development.

### Two independent auth flows

| | SPA users | Sidekiq admin |
|---|---|---|
| Initiator | `@react-oauth/google` button → ID token | OmniAuth server-side redirect |
| Rails entry | `POST /api/v1/auth/google` | `/auth/google_oauth2/callback` |
| Credential issued | 30-day JWT (stored in `localStorage`) | Session cookie (30min) |
| Gating | `ApplicationController#authenticate_user!` | `SidekiqAuth` Rack middleware |
| Who | Any Google account | `SIDEKIQ_ALLOWED_EMAIL` only |

Session middleware is promoted to the main Rails stack in `config/initializers/omniauth.rb` because the app is API-only and these aren't included by default.

### Frontend state

Server state lives in React Query (see ADR-007): focused hooks in `src/hooks/` (`useGames`, `useGame`, `usePokemon`, `useMove`, `useSuggestions`, `useFavorites`, `useCaughtPokemons`, plus mutation hooks with optimistic updates). A singleton `QueryClient` in `src/lib/queryClient.ts` carries a global 401 handler that signs the user out. Client state is split across two contexts: `AppContext` holds auth and the selected game (`selectedGame`, `currentUser`, `token`); `UiContext` holds toast and color mode, so toast churn doesn't re-render auth consumers. Per-game teams live in localStorage via `useTeam`. `GameSelector` derives its selected value from the URL via `useMatch` rather than context, avoiding a race condition between async game fetching and initial render. Favorites queries are disabled (`enabled: !!token`) when signed out.

### `GAME_TO_POKEDEX` mapping

`PokeapiAdapter::GAME_TO_POKEDEX` maps game slugs to PokeAPI pokedex names (e.g. `"scarlet" => "paldea"`), but only as a seed-time default: `games.pokedex_name` is authoritative (see `resolve_pokedex_name`), so adding a game is a DB insert.

---

## Development

Everything runs in Docker Compose. All backend and frontend commands use `docker compose exec` — do not run them on bare metal.

**Frontend** → `http://localhost:5173`
**Backend API** → `http://localhost:3000`
**Sidekiq UI** → `http://localhost:3000/sidekiq` (requires Google auth)

```bash
# Start all services
docker compose up -d

# Tail logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Backend

```bash
# Rails console
docker compose exec backend bundle exec rails console

# Migrations
docker compose exec backend bundle exec rails db:migrate

# Tests
docker compose exec backend bundle exec rspec

# Lint / format
docker compose exec backend bundle exec standardrb --no-fix   # check
docker compose exec backend bundle exec standardrb --fix       # fix

# Security scans (also run in CI)
docker compose exec backend bundle exec brakeman
docker compose exec backend bundle exec bundle-audit
```

### Frontend

```bash
# Unit tests (Playwright e2e runs on the host: cd frontend && npm run test:e2e)
docker compose exec frontend npm test

# Type-check
docker compose exec frontend npx tsc --noEmit

# Production build (CI check)
docker compose exec frontend npm run build

# Format
docker compose exec frontend npm run format        # write
docker compose exec frontend npm run format:check  # check (CI)

# Lint
docker compose exec frontend npm run lint
```

### Adding dependencies

**npm package** — after `npm install <pkg>` on the host, the Docker container needs to pick up the new package:
```bash
docker compose build frontend
docker compose up -d -V frontend   # -V recreates the anonymous node_modules volume
```

**Ruby gem** — after editing `Gemfile`:
```bash
docker compose exec backend bundle install
docker compose restart backend sidekiq   # required if adding initializers or middleware
```

---

## Key env vars

All env vars are loaded from `.env.local` at the **project root** (not inside `backend/` or `frontend/`).

A committed `.env.example` documents every key with placeholders — copy it to `.env.local` to get started.

| Variable | Used by |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Frontend `GoogleOAuthProvider` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OmniAuth + ID token verification |
| `JWT_SECRET` | Signing/verifying API JWTs |
| `SIDEKIQ_ALLOWED_EMAIL` | Restricts Sidekiq UI access |
| `VITE_API_URL` | Frontend → backend base URL |
| `REDIS_URL` | Sidekiq queues + Rack::Attack store |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error tracking (backend / frontend) |
| `CORS_ORIGINS` | Allowed origins in production |
| `ALLOWED_HOSTS` | Host-header allowlist in production (unset disables filtering) |

Rails sends no Content Security Policy: API-only apps leave out the CSP middleware, so a CSP initializer would have no effect. The Sidekiq UI sends its own CSP, and the SPA's belongs in the static site's response headers.

---

## Keeping docs current

When making a change that affects architecture, auth, data flow, or a significant technical decision: **update `CHANGELOG.md` and create or update the relevant ADR in `docs/adr/`**. The backlog and runbooks are kept privately, outside this repo; update them too when a change resolves a backlog item or alters a runbook procedure. ADRs are numbered sequentially and ordered oldest-first.
