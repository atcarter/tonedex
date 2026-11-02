# Architecture

High-level overview of ToneDex's architecture. For detailed rationale behind specific decisions, see `docs/adr/`.

---

## System Overview

```
Browser
  │
  ├── React SPA (Vite, port 5173)
  │     ├── TanStack Query — server state (games, pokémon, moves, favorites, caught, suggestions)
  │     ├── AppContext     — auth + game state (selectedGame, token, currentUser)
  │     ├── UiContext      — ephemeral UI state (toast, colorMode)
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
        │     ├── PokemonController     — detail, search, suggestions
        │     └── MovesController       — move detail
        │
        ├── Auth routes (/auth/*)
        │     └── AuthController (ActionController::Base) — OmniAuth callback → session cookie
        │
        ├── Health check (/up) — pings Postgres and Redis, returns per-check JSON
        │
        ├── Sidekiq Web UI (/sidekiq) — gated by SidekiqAuth Rack middleware
        │
        ├── Rack::Attack — per-IP rate limiting on API, auth and search routes
        │
        ├── Services
        │     ├── PokeapiClient   — HTTP to pokeapi.co, delegates cache reads/writes
        │     ├── CacheService    — thin facade over ApiCache (api_caches table)
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
  ├── users, favorites (with position for drag-to-reorder), caught_pokemons
  └── api_caches (PokeAPI response cache)

Redis (AOF persistence enabled in Docker Compose)
  └── db 0 — Sidekiq queues, Rack::Attack throttle store, seed-job locks
```

---

## Frontend State Architecture

Server state and UI state are deliberately separated:

| Concern | Owner | Why |
|---|---|---|
| Games list, Pokémon data, Moves | TanStack Query | Immutable PokeAPI data — cached with `staleTime: Infinity` |
| Favorites, Caught | TanStack Query | User-owned — `staleTime: 0` for cross-tab freshness |
| Search suggestions | TanStack Query | Short-lived — `staleTime` 5 min, previous results kept while typing |
| selectedGame, token, currentUser | AppContext | Auth + game state — not server data |
| toast, colorMode | UiContext | Ephemeral UI state, kept apart so toast churn doesn't re-render auth/game consumers |
| Team | `useTeam` (localStorage) | Per-game scratch team, usable signed-out |

See ADR-007 for the full rationale.

### Query Key Conventions

```
["games"]                     — games list
["game", gameId]              — single game + paginated pokémon (infinite query)
["pokemon", name, gameId?]    — pokémon detail
["move", name]                — move detail (fetched lazily when a row expands)
["suggestions", query]        — as-you-type search suggestions (staleTime: 5 min)
["favorites"]                 — user's favorites (auth-gated, staleTime: 0)
["caught", gameId]            — caught pokémon for a game (auth-gated, staleTime: 0)
```

---

## Data Flow: Lazy Seeding

Pokémon data is seeded by Sidekiq jobs, never inside a request (ADR-002). `rails pokedex:seed` seeds every game up front; otherwise a game seeds on its first visit. When `GET /api/v1/games/:id` finds a game with no Pokémon yet (`game.game_pokemons.empty?`), it enqueues `SeedGamePokemonJob` (once, behind a Redis lock) and returns `pagination.seeding: true` with an empty list; `useGame` polls every 5s until the dex fills in. Subsequent requests read from the database.

---

## PokeAPI Caching

`PokeapiClient` checks `CacheService` before every network call. Raw PokeAPI JSON is stored in `api_caches` (Postgres) by endpoint path. Each endpoint is fetched at most once across all time; 404s are cached too, as sentinel rows. Postgres is used (not Redis) because the data is durable and enables backfill tasks from raw cached responses without re-fetching. `PokeapiAdapter` turns payloads into attribute hashes, and `PokemonImporter` owns every database write.

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
| Puma (web) | `RAILS_MAX_THREADS` (3) | `DB_POOL` (3) | Web service |
| Sidekiq (worker) | `SIDEKIQ_CONCURRENCY` (5) | `DB_POOL` (5) | Background worker |

Pool size = concurrency per process. In production, web and worker run as separate services with independent pools.

---

## Security

- **CORS**: `CORS_ORIGINS` env var (required in production). Comma-separated for multi-domain. Defaults to `http://localhost:5173` in development.
- **Rate limiting**: `Rack::Attack` — 300 req/5min (general API), 10 req/min (auth), 15 req/min (search, which can reach PokeAPI). Throttle counters are stored in Redis. There's deliberately no games throttle: `SeedGamePokemonJob.enqueue_once` prevents duplicate seeding instead.
- **Secrets**: `master.key`, `credentials.yml.enc` and the real env files (`.env.local`, `.env.production`) are gitignored. Secrets live only in production env vars and CI secrets.
- **Transport and headers**: production forces SSL (HSTS, secure cookies) and checks Host headers against `ALLOWED_HOSTS` when it's set. Rails sends no Content Security Policy: API-only apps leave out that middleware. The Sidekiq UI, the only HTML it serves, sets its own.

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
| 008 | Render via Terraform for production hosting |
