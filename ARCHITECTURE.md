# Architecture

High-level overview of PokéManiac's architecture. For detailed rationale behind specific decisions, see `docs/adr/`.

---

## System Overview

```
Browser
  │
  ├── React SPA (Vite, port 5173)
  │     ├── TanStack Query — server state (games, pokémon, favorites, caught)
  │     ├── AppContext     — UI/auth state (selectedGame, token, currentUser, toast, moveCache)
  │     ├── @react-oauth/google  ──── Google ID token ──▶ POST /api/v1/auth/google
  │     ├── Authorization: Bearer <jwt>  ──────────────▶ API routes
  │     └── /auth/login (browser redirect) ────────────▶ OmniAuth → /sidekiq
  │
  └── Rails 8 API (Puma, port 3000)
        │
        ├── API routes (/api/v1/*)
        │     ├── SessionsController    — verifies Google ID token, issues JWT
        │     ├── FavoritesController   — authenticated CRUD + reorder (JWT)
        │     ├── CaughtPokemonsController — per-game catch tracking (JWT)
        │     ├── GamesController       — game list + paginated Pokémon
        │     ├── PokemonController     — detail + search
        │     └── MovesController       — move detail
        │
        ├── Auth routes (/auth/*)
        │     └── AuthController (ActionController::Base) — OmniAuth callback → session cookie
        │
        ├── Health check (/up) — verifies DB connectivity, returns JSON
        │
        ├── Sidekiq Web UI (/sidekiq) — gated by SidekiqAuth Rack middleware
        │
        ├── Rack::Attack — per-IP rate limiting on API, auth, and seeding routes
        │
        ├── Services
        │     ├── PokeapiClient   — HTTP to pokeapi.co, delegates cache reads/writes
        │     ├── CacheService    — routes to PostgresCache (api_caches table)
        │     └── PokeapiAdapter  — orchestrates client + ActiveRecord persistence
        │
        └── Background jobs (Sidekiq, Redis db 0)
              ├── SeedGamePokemonJob    — triggered on first game load (lazy seeding)
              ├── SeedAllPokemonJob     — seeds all Pokémon base data
              ├── PreloadGamePokemonJob — pre-warms a game's dex
              └── WarmMoveCacheJob      — pre-warms a move entry

PostgreSQL
  ├── games, pokemons, game_pokemons, moves, pokemon_moves
  ├── users, favorites (with position for drag-to-reorder), caught_pokemons
  └── api_caches (PokeAPI response cache)

Redis (AOF persistence enabled)
  └── db 0 — Sidekiq queues
```

---

## Frontend State Architecture

Server state and UI state are deliberately separated:

| Concern | Owner | Why |
|---|---|---|
| Games list, Pokémon data, Moves | TanStack Query | Immutable PokeAPI data — cached with `staleTime: Infinity` |
| Favorites, Caught | TanStack Query | User-owned — `staleTime: 0` for cross-tab freshness |
| selectedGame, token, currentUser | AppContext | UI/auth state — not server data |
| moveCache | AppContext | In-memory cache for move detail accordions |
| toast | AppContext | Ephemeral UI notifications |

See ADR-007 for the full rationale.

### Query Key Conventions

```
["games"]                     — games list
["game", gameId]              — single game + paginated pokémon (infinite query)
["pokemon", name, gameId?]    — pokémon detail
["favorites"]                 — user's favorites (auth-gated, staleTime: 0)
["caught", gameId]            — caught pokémon for a game (auth-gated, staleTime: 0)
```

---

## Data Flow: Lazy Seeding

Pokémon data is **not pre-loaded**. On `GET /api/v1/games/:id`, if the game has no Pokémon yet, `SeedGamePokemonJob` is enqueued. The response returns `pagination.seeding: true` — the frontend shows a banner prompting the user to refresh. Subsequent requests return data from Postgres, never PokeAPI directly.

---

## PokeAPI Caching

`PokeapiClient` checks `CacheService` before every network call. Raw PokeAPI JSON is stored in `api_caches` (Postgres) by endpoint path. Each endpoint is fetched at most once across all time. Postgres is used (not Redis) because the data is durable and enables backfill tasks from raw cached responses without re-fetching.

---

## Authentication

Two independent auth flows run in parallel:

| | SPA users | Sidekiq admin |
|---|---|---|
| Initiator | `@react-oauth/google` button | OmniAuth server-side redirect |
| Rails entry | `POST /api/v1/auth/google` | `/auth/google_oauth2/callback` |
| Credential issued | 30-day JWT (localStorage) | Session cookie (30min) |
| Gating | `ApplicationController#authenticate_user!` | `SidekiqAuth` Rack middleware |
| Who | Any Google account | `SIDEKIQ_ALLOWED_EMAIL` only |

Session middleware is promoted to the main Rails stack in `config/initializers/omniauth.rb`.

---

## Concurrency & Connection Pools

| Process | Threads | DB Pool | Config |
|---|---|---|---|
| Puma (web) | `RAILS_MAX_THREADS` (3) | `DB_POOL` (3) | Web dyno |
| Sidekiq (worker) | `SIDEKIQ_CONCURRENCY` (5) | `DB_POOL` (5) | Worker dyno |

Pool size = concurrency per process. On Heroku, web and worker are separate dynos with independent pools.

---

## Security

- **CORS**: `CORS_ORIGINS` env var (required in production). Comma-separated for multi-domain. Defaults to `http://localhost:5173` in development.
- **Rate limiting**: `Rack::Attack` — 300 req/5min (general API), 10 req/min (auth), 5 req/min (game seeding). Throttle counters stored in Redis.
- **Secrets**: `master.key`, `credentials.yml.enc`, `.env.*` are gitignored. Secrets live in Heroku config vars and CI secrets only.

---

## ADR Index

| ADR | Decision |
|---|---|
| 001 | Sidekiq over solid_queue |
| 002 | Pre-seeding over lazy loading |
| 003 | Single Redis, multiple databases |
| 004 | Favorites in localStorage → DB-backed |
| 005 | URL as source of truth for game selection |
| 006 | Google OAuth for user accounts |
| 007 | TanStack Query for server state management |
