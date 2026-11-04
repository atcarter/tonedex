# CLAUDE.md

Guidance for Claude Code sessions in this repository.

ToneDex is a game-specific Pokémon dex: a React 19 + Vite SPA and a Rails 8 API-only backend with Sidekiq, PostgreSQL and Redis, run with Docker Compose. [ARCHITECTURE.md](ARCHITECTURE.md) describes the system (routes, services, jobs, tables, auth, frontend state); read it before a structural change. `docs/adr/` records why things are the way they are.

## Rules the structure depends on

- **PokeAPI access goes through `PokeapiClient` → `PokeapiAdapter`, and every write to `games`, `pokemons`, `moves` and `game_pokemons` goes through `PokemonImporter`.** Don't add PokeAPI calls or writes anywhere else. The client is cache-first (`ApiCache`, the `api_caches` table): each endpoint is fetched at most once, ever, 404s included. To force a re-fetch, delete the rows.
- **Seeding happens in Sidekiq jobs, never inside a request** (ADR-002). `GET /api/v1/games/:id` on a game with no Pokémon enqueues `SeedGamePokemonJob` once (Redis lock) and returns `pagination.seeding: true`; `useGame` polls until the dex fills in. Only two request paths reach PokeAPI at runtime, both cache-first: search for an unknown name, and move details.
- **Sprites are committed.** `backend/public/sprites/` mirrors PokeAPI's PNGs and ships in the image because production disks are ephemeral. After adding a game, run `rails pokedex:mirror_sprites` and commit the files.
- **Two auth flows, kept apart.** SPA users exchange a Google ID token for a 30-day JWT (`POST /api/v1/auth/google`, gated by `authenticate_user!`). The Sidekiq UI uses an OmniAuth session cookie restricted to `SIDEKIQ_ALLOWED_EMAIL` (`SidekiqAuth` middleware). Session middleware is added back in `config/initializers/omniauth.rb` because the app is API-only.
- **Frontend server state lives in React Query hooks** (`src/hooks/`, ADR-007). Client state is `AppContext` (auth, selected game) and `UiContext` (toast, color mode). The URL is the source of truth for the selected game (ADR-005). Authenticated queries are `enabled: !!token`.
- **`games.pokedex_name` is authoritative.** `PokeapiAdapter::GAME_TO_POKEDEX` is only a seed-time default, so adding a game is a database insert.
- **Rails sends no Content Security Policy.** API-only apps leave out that middleware, so a CSP initializer does nothing. The SPA's CSP belongs on the static host.
- **Internal names keep "pokedex"**: database names, localStorage keys and the `pokedex:*` rake tasks. The product is ToneDex (styled TONEDEX in the logo, ToneDex in prose).

## Development

Everything runs in Docker Compose. Backend commands go through `docker compose exec backend`. Frontend tooling also works on the host after `npm install` in `frontend/`.

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Sidekiq UI: http://localhost:3000/sidekiq (Google sign-in)

```bash
docker compose up -d
docker compose logs -f backend
```

### Backend

```bash
docker compose exec backend bundle exec rails console
docker compose exec backend bundle exec rails db:migrate
docker compose exec backend bundle exec rspec
docker compose exec backend bundle exec standardrb --no-fix   # lint (--fix to write)
docker compose exec backend bundle exec brakeman              # security scan (CI)
docker compose exec backend bin/bundler-audit check --update  # gem advisories (CI)
```

### Frontend

```bash
docker compose exec frontend npm test            # Vitest
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npm run lint
docker compose exec frontend npm run format      # Prettier (format:check in CI)
docker compose exec frontend npm run build
cd frontend && npm run test:e2e                  # Playwright, on the host; starts Vite itself
```

### Adding dependencies

**npm package**: after `npm install <pkg>` on the host, rebuild so the container picks it up:

```bash
docker compose build frontend
docker compose up -d -V frontend   # -V recreates the anonymous node_modules volume
```

**Ruby gem**: after editing `Gemfile`:

```bash
docker compose exec backend bundle install
docker compose restart backend sidekiq   # needed for new initializers or middleware
```

## Gotchas

- **Worktrees test the wrong code.** `docker-compose.yml` bind-mounts `./backend` and `./frontend` from the main checkout. From a git worktree, `docker compose exec backend bundle exec rspec` runs the main checkout's code, not the worktree's, and can pass falsely. Run the worktree's backend in a one-off container on the main stack's network instead (the OAuth placeholders satisfy the OmniAuth initializer):

  ```bash
  docker compose -f <main checkout>/docker-compose.yml up -d db redis
  docker run --rm --network tonedex_default \
    -v "$PWD/backend:/rails" -v tonedex_backend_gems:/usr/local/bundle \
    -e POSTGRES_HOST=db -e REDIS_URL=redis://redis:6379 -e JWT_SECRET=test-secret \
    -e GOOGLE_CLIENT_ID=test -e GOOGLE_CLIENT_SECRET=test -e SIDEKIQ_ALLOWED_EMAIL=test@example.com \
    tonedex-backend bundle exec rspec
  ```

  Frontend checks run on the host from the worktree without any of this. Two RSpec runs at once share the `pokedex_test` database.
- **Never read `.env.local`.** It holds real secrets. `.claude/settings.json` denies reads, and a hook rejects any Bash command whose text contains the file name, including edits to other files that mention it. Use the Edit tool for those. `.env.example` documents every key.
- **`.env.local` exports `RAILS_ENV=development` into the containers.** `spec/rails_helper.rb` hard-sets `RAILS_ENV=test` to compensate. Don't weaken that to `||=`: the suite would run against the development database.
- **Use `bundle exec brakeman`, not `bin/brakeman`.** The binstub adds `--ensure-latest` and fails whenever a newer Brakeman exists.
- **The test database can hold rows from earlier runs.** Specs that create games or Pokémon use sentinel names and `pokeapi_id`s of 100,000 and up so they can't collide.
- **Thruster owns the port in production.** It listens on `HTTP_PORT` and starts Puma on `TARGET_PORT` (default 3000). Set `HTTP_PORT`; leave `PORT` alone.
- **Production refuses to boot without `CORS_ORIGINS`.** `config/initializers/cors.rb` raises `KeyError` on purpose.

## Key env vars

All env vars come from `.env.local` at the **project root**, loaded by Docker Compose and Vite (`envDir: ".."`). Copy `.env.example` to get started.

| Variable | Used by |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Frontend `GoogleOAuthProvider` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OmniAuth + ID token verification |
| `JWT_SECRET` | Signing/verifying API JWTs |
| `SIDEKIQ_ALLOWED_EMAIL` | Restricts Sidekiq UI access |
| `VITE_API_URL` | Frontend → backend base URL |
| `REDIS_URL` | Sidekiq queues + Rack::Attack store |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error tracking (backend / frontend), production only |
| `CORS_ORIGINS` | Allowed origins in production (required) |
| `ALLOWED_HOSTS` | Host-header allowlist in production (unset disables filtering) |

## Conventions

- **Commits** go straight to `main` with a conventional prefix (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`), a subject that says what changed, bullets for the why, and a `Co-Authored-By:` trailer for agent-assisted work. CI must be green: standardrb, RSpec, Brakeman, bundler-audit, tsc, ESLint, Prettier, Vitest, the build and Playwright.
- **Styling**: styled-components over MUI `sx`; both consume the shared theme (`ThemedApp.tsx`, `styled.d.ts`). Brand colors (type badges, stat bars, the AppBar red) stay fixed across color modes; everything else uses palette tokens.
- **Docs**: a change to architecture, auth, data flow or a significant decision gets a dated entry at the top of `CHANGELOG.md` and a new or updated ADR in `docs/adr/` (sequential numbers; a superseded ADR gets a status note, not a rewrite). Keep ARCHITECTURE.md matching the code.
- **No planning in the repo.** Backlog items, roadmap notes and runbooks live outside it; don't add them to docs, the CHANGELOG or commit messages.
