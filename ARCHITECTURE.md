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
  └── Rails 8 API (Puma, port 3000; behind Thruster in production)
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
        │     ├── PokeapiClient   — HTTP to pokeapi.co, cache-first through ApiCache
        │     ├── PokeapiAdapter  — turns PokeAPI payloads into attribute hashes
        │     ├── PokemonImporter — owns every write to games, pokemons, moves and their join tables
        │     └── SpriteStore     — mirrors sprite PNGs into public/sprites
        │
        └── Background jobs (Sidekiq, Redis db 0)
              ├── SeedGamePokemonJob    — triggered on first game load (lazy seeding)
              ├── SeedAllPokemonJob     — seeds all Pokémon base data
              └── MirrorSpriteJob       — mirrors a new Pokémon's sprites

PostgreSQL
  ├── games, pokemons, game_pokemons, moves
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

`PokeapiClient` checks `ApiCache` before every network call. Raw PokeAPI JSON is stored in `api_caches` (Postgres) by endpoint path. Each endpoint is fetched at most once across all time; 404s are cached too, as sentinel rows. Postgres is used (not Redis) because the data is durable and enables backfill tasks from raw cached responses without re-fetching. `PokeapiAdapter` turns payloads into attribute hashes, and `PokemonImporter` owns every database write.

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
- **Secrets**: `master.key`, `credentials.yml.enc` and the real env files (`.env.local`, `.env.production`) are gitignored. Production secrets live in the `tonedex-backend` env group, set from Terraform variables, and in the local Terraform state, which holds them in plain text and is gitignored too.
- **Transport and headers**: production forces SSL (HSTS, secure cookies) and checks Host headers against `ALLOWED_HOSTS` when it's set. Rails sends no Content Security Policy: API-only apps leave out that middleware. The Sidekiq UI, the only HTML it serves, sets its own. The SPA's headers, including a report-only CSP, come from the static site (see Deployment).
- **Scanning**: CI runs Brakeman and bundler-audit. GitHub secret scanning is on for the repository.

---

## Deployment

Production runs on Render, region ohio, and every resource is declared in Terraform under `infra/render` with the `render-oss/render` provider (ADR-008). [`infra/render/README.md`](infra/render/README.md) is the source of truth for the stack: first apply, the state file, tear-down and the CSP. `terraform plan` and `apply` are run by hand by the owner.

| Render name | Kind | Runs |
|---|---|---|
| `tonedex-api` | Web service, Docker | `backend/Dockerfile`'s production stage: Thruster on `HTTP_PORT` 10000 in front of Puma. Health check `/up`; `./bin/rails db:migrate` runs before each deploy |
| `tonedex-worker` | Background worker, Docker | `bundle exec sidekiq` from the same image |
| `tonedex-web` | Static site | `npm ci && npm run build` in `frontend/`, publishing `dist`. Rewrites every path to `index.html` for deep links, and sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Content-Security-Policy-Report-Only` |
| `tonedex-db` | Postgres 15 | Private network only (empty IP allow list) |
| `tonedex-redis` | Key Value, free plan | `noeviction`, so queued Sidekiq jobs are never evicted. Private network only |
| `tonedex-backend` | Env group | Linked to the api and worker: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY_BASE`, `JWT_SECRET`, the Google OAuth values, `SIDEKIQ_ALLOWED_EMAIL`, `CORS_ORIGINS`, `ALLOWED_HOSTS` and the optional `SENTRY_DSN` |

```
Browser
  ├──▶ tonedex-web     https://tonedex-web.onrender.com (Render's global CDN, no region)
  └──▶ tonedex-api     https://tonedex-api.onrender.com ──┐
       tonedex-worker  Sidekiq ───────────────────────────┤
                                                          ├──▶ tonedex-db     Postgres 15
                                                          └──▶ tonedex-redis  Key Value

tonedex-backend env group ──▶ tonedex-api, tonedex-worker
```

The api, worker, database and Key Value all run in region ohio; the database and Key Value accept connections only from Render's private network. The Sidekiq UI is at https://tonedex-api.onrender.com/sidekiq, behind Google sign-in for the one `SIDEKIQ_ALLOWED_EMAIL`.

- **Configuration is env-only.** Production reads the database from `DATABASE_URL` (`config/database.yml` has a single `production` entry) and Redis from `REDIS_URL`. The Rails cache is `:memory_store`; there is no solid_cache, solid_queue or solid_cable database.
- **The env group breaks a URL cycle.** The api needs the frontend's URL for `CORS_ORIGINS` and the static site needs the api's URL for `VITE_API_URL` and its CSP. `CORS_ORIGINS` lives in the env group, so the api resource never references the static site.
- **Concurrency** matches Concurrency & Connection Pools: the api sets `RAILS_MAX_THREADS=3` and `DB_POOL=3`, the worker `SIDEKIQ_CONCURRENCY=5` and `DB_POOL=5`.
- **Seeding** runs in `tonedex-worker`, as in development (ADR-002). The first production seed copied the development `api_caches` table in, so it made no PokeAPI calls.
- **CI** gates `main` with five required checks: `backend`, `frontend`, `e2e` and `backend-image` from `ci.yml`, and `terraform.yml`'s fmt and validate job. `backend-image` builds the production image and waits for `/up` to answer 200 against real Postgres and Redis. The Terraform job has no credentials and never plans or applies.

---

## ADR Index

| ADR | Decision |
|---|---|
| 001 | Sidekiq over solid_queue |
| 002 | Seed through background jobs, never inside a request |
| 003 | Single Redis, multiple databases |
| 004 | Favorites in localStorage → DB-backed |
| 005 | URL as source of truth for game selection |
| 006 | Google OAuth for user accounts |
| 007 | TanStack Query for server state management |
| 008 | Render via Terraform for production hosting |
