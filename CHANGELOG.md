# Changelog

Changes are listed newest first. Each entry notes the affected layer and the principle it relates to where relevant.

---

## 2026-07-09

### Backend
- **Feature:** Self-hosted sprites — `SpriteStore` mirrors PokeAPI sprite PNGs into `public/sprites/` (committed to git; Heroku dynos are ephemeral so the mirror ships in the slug). `PokemonSerializer` serves mirrored URLs rooted at the request origin and falls back to the original PokeAPI URL for unmirrored files. `rails pokedex:mirror_sprites` backfills idempotently; `MirrorSpriteJob` (enqueued by the adapter) covers newly created pokemon. Fixes broken card images under fast scrolling — `raw.githubusercontent.com` throttles request bursts. *(Don't put a third party's rate limits in your render path)*

### Frontend
- **Fix:** Card sprites load lazily (`loading="lazy"` — only near-viewport images fetch, verified 14/40 on first paint) and show a pokéball placeholder on load failure instead of the browser's broken-image icon.
- **Feature:** Search-bar autocomplete — typing (2+ chars, 200ms debounce) shows up to eight matches with their self-hosted sprites, prefix matches first. Arrow keys highlight, Enter selects, Escape/click-outside dismiss; Enter with no highlight still runs the full search for unseeded names. Backed by a new DB-only `GET /api/v1/pokemon/suggestions` endpoint that never touches PokeAPI, so it's safe per keystroke.
- **Feature:** Comparison view at `/compare` — two autocomplete pickers, side-by-side stat bars with the winning stat highlighted per side, and base-stat totals (ties stay neutral). Selection is URL state (`?left=&right=`), so comparisons are shareable.
- **Accessibility:** Favorites reorder is keyboard-operable — move-earlier/later buttons per card (hover- or focus-revealed, boundary-disabled) with a polite `aria-live` announcement; drag-and-drop unchanged for mouse users.
- **Fix:** The game-less `/pokemon/:name` route (search, compare, evolution links) showed no moves section; it now defaults the moves context to the game being browsed, falling back to Scarlet — the section title names the game used.
- **Chore:** Pokéball favicon replaces the stock Vite logo.
- **Feature:** Team builder at `/game/:gameId/team` (entry point on the dex filter bar) — assemble up to six Pokémon from the current game's dex with a filterable picker, see a per-attacking-type defensive overview (weak vs. resist counts, net weaknesses highlighted) and STAB offensive-coverage gaps. Backed by a Gen-6+ type chart and pure analysis functions with 17 unit tests; the team persists per game in `localStorage`. *(Modern-chart simplification for older gens noted in code.)*
- **Fix (test infra):** Vitest 4 launches Node with `--localstorage-file` and no valid path, so Node's broken experimental webstorage shadowed jsdom's Storage in tests ("localStorage.removeItem is not a function"). The test setup now installs a real in-memory Storage.

---

## 2026-07-08

### Repository
- **Chore:** Brought the whole project under version control — backend, docs, and infra config were previously untracked (only 19 frontend files were committed). Committed in logical chunks together with the finished React Query migration. Added `.gitignore` coverage for Playwright artifacts and a root `.env.example` documenting every env key.

### Frontend
- **Fix:** `GameSelector`'s auto-navigate hijacked deep links — `useMatch("/game/:gameId")` doesn't match deeper routes, so any detail-page URL bounced back to the grid, making detail pages unreachable. Auto-select is now scoped strictly to `/`, and the selector matches `/game/:gameId/*` so it shows the current game on detail pages. Caught by three failing Playwright specs; all 12 now pass. *(URL as source of truth — see ADR-005)*
- **Feature:** Dark mode now extends to styled-components — the MUI theme is shared via styled-components' `ThemeProvider` (typed via `styled.d.ts`), and all hardcoded light-mode colors were replaced with palette tokens (cards, game page, detail sections, favorites, search, selector, stat bars, evolution chain, move table). Verified in-browser in both modes. *(A theme toggle that themes half the UI is worse than none)*
- **Feature:** The dex auto-fills while seeding — `useGame` polls every 5s while `pagination.seeding` is true instead of asking the user to refresh.
- **Observability:** `ErrorBoundary` reports render crashes to Sentry with the component stack (prod only).
- **Resilience:** 429 responses are now a typed `RateLimitError` carrying the server's `retry_after`; React Query retries rate-limited requests on that schedule (and no longer retries terminal 401s). A failed `fetchNextPage` keeps the loaded grid and shows an inline notice at the scroll sentinel instead of replacing the page with an error.
- **Feature:** About section on the detail page — genus subtitle, flavor text, height/weight, and ability chips (hidden abilities dashed) — plus the game-local dex number in the header, which the client previously never had on detail views.
- **Feature:** Filters search the whole dex — an active name/type filter auto-fetches the remaining pages ("searching entire dex…" hint), so matches are no longer limited to what infinite scroll has loaded.
- **Feature:** 404 catch-all route (`NotFoundPage`); unknown URLs previously rendered a blank page.
- **Feature:** Search dropdown dismisses on Escape/click-outside and consumes the normalized `{results, exact}` response (the `Pokemon | Pokemon[]` union is gone).
- **Refactor:** Move details fetch through a lazy `useMove` React Query hook (expanded rows only); the `moveCache` + `sessionStorage` plumbing was deleted from `AppContext`, which now holds client state exclusively. `PokemonDetail` takes `{pokemonName, game}` instead of full stub objects. *(One data-fetching idiom — ADR-007)*
- **Fix:** Sticky AppBar — the fixed header with a hardcoded 64px content offset hid ~250px of page content under the wrapped toolbar at mobile widths. `position: sticky` keeps the header in flow, so content always starts below its real height. Verified at 375px.

### Backend
- **Fix:** Removed the 5/min games throttle that 429'd normal dex scrolling — infinite scroll fetches ~10 pages for a large dex and the seeding banner polls every 5s. Its purpose (blocking seed-job spam) is handled structurally by `SeedGamePokemonJob.enqueue_once`; the general 300/5min limit still bounds volume. Search — the endpoint that fans out to PokeAPI per unknown query — now has its own 15/min throttle instead. Also fixed Rack::Attack being mounted twice (railtie + explicit `middleware.use`) and deleted-from-stack in tests; it's now mounted once and toggled via `Rack::Attack.enabled`, with request specs pinning the policy. *(Rate-limit by cost, not by path popularity)*
- **Security:** `force_ssl` + `assume_ssl` enabled in production (HSTS, secure cookies, http→https redirect; `/up` excluded). *(OWASP A02)*
- **Security:** SQL LIKE wildcards escaped in the pokemon search fallback via `sanitize_sql_like`.
- **Resilience:** `PokeapiClient` gained 2s/5s open/read timeouts and bounded retries with backoff for transient errors and 5xx — PokeAPI calls run on Puma request threads and previously could pin one for 60s. *(Never trust an external service with your thread pool)*
- **Fix:** `SeedGamePokemonJob.enqueue_once` takes a Redis `SET NX EX` lock so concurrent visitors to an unseeded game no longer stack duplicate full-dex crawls.
- **Change:** User profile fields (email/name/avatar) sync from Google on every login instead of only at first sign-in.
- **Change:** `/up` health check now pings Redis alongside Postgres and reports per-check status.
- **Change:** `available_types` is computed only for the first page — the client ignores it on later pages.
- **Remove:** Unused, unpaginated `GET /api/v1/pokemon` index route.
- **Feature:** `GET /api/v1/pokemon/:id` includes a `species` block (English genus, normalised flavor text, height/weight, slot-ordered abilities with hidden flags) from the already-cached PokeAPI payloads; degrades to `null` when unavailable.
- **Refactor:** The game→pokedex mapping is data-driven — `games.pokedex_name` (backfilled by migration, set at creation) is authoritative; `GAME_TO_POKEDEX` remains only as a seed-time default. Adding a game is now a DB insert. *(Open/Closed)*
- **Refactor:** `PokemonSerializer` replaces the three hand-rolled `pokemon_summary` copies; search returns one shape, `{results, exact}`, for both branches; details include the game-local `pokedex_number`.
- **Feature:** PokeAPI 404s are negative-cached (sentinel rows in `api_caches`), so repeated bad lookups never re-hit the network. The immutable-forever cache policy and its recovery path are documented on `ApiCache`; the dead `stale?` method is gone.
- **Security:** Env-driven host authorization — set `ALLOWED_HOSTS` to enable `config.hosts` filtering once the domain is settled. *(Host-header / DNS-rebinding defense)*
- **Refactor:** `pokemon_moves_for_game` / `basic_moves_for_game` share one private iterator. *(DRY)*

### Testing
- **Fix:** The RSpec suite was silently running against the **development** environment and database — `.env.local` exports `RAILS_ENV=development` into the containers, defeating `ENV["RAILS_ENV"] ||= "test"`. rails_helper now hard-sets the test env; ActiveJob uses the `:test` adapter; Rack::Attack is disabled in specs (its Redis-backed counters were also 429-ing spec requests). A user-model spec that only passed by accident against dev data was corrected.
- **Add:** Request specs for Games, Pokemon, Moves, and `/up`; unit specs for `PokeapiClient` (cache/timeout/retry semantics) and `SeedGamePokemonJob.enqueue_once`. Suite: 79 → 110 examples, all green; Brakeman: 0 warnings.
- **Add:** Model specs for `Pokemon#types_for_generation` boundaries, adapter specs for `species_info_for` and the `pokedex_name` precedence, negative-cache client specs, and search-shape coverage. Suite now at 125 examples.
- **Add:** Frontend component tests — `GamePage` filter interplay (AND logic, max-2 cap, whole-dex auto-fetch) and `PokemonCard` toggles including the optimistic `id: -1` guard (Vitest 22 → 33). New Playwright spec covers search flows, the lazy move drawer, and the caught toggle (12 → 17). jsdom gained an `IntersectionObserver` stub.
- **Add:** Coverage reporting in CI — SimpleCov with branch coverage on the RSpec step (`COVERAGE=1`, ~72% line at introduction) and `vitest --coverage` (v8) on the frontend step.

### Infrastructure
- **CI:** Linters now run in CI — `standardrb` (backend), `eslint` + `prettier --check` (frontend). Fixed all existing offenses to land this green.
- **Docker:** `postgres:15` and `redis:7-alpine` pinned to manifest-list digests; per-service `mem_limit`/`cpus` set. Removed the dead `backend/.github/` directory (GitHub only reads the repo root).
- **Chore:** Pruned dead Rails scaffolding — kamal (gem, deploy.yml, binstub, .kamal/), solid_cable + the ActionCable engine (no channels or cable mount), and the solid_queue remnants (queue.yml, recurring.yml, queue_schema, dead puma plugin line). `solid_cache` (production cache_store) and `thruster` (production Dockerfile CMD) deliberately kept.
- **Logging:** `lograge` JSON one-line request logs in production, tagged with request_id. *(12-Factor XI)*
- **Ops:** Explicit Sidekiq dead-set bounds (5k jobs / 1 month) in the initializer.

### Docs
- **Fix:** CLAUDE.md no longer documents the nonexistent `CACHE_BACKEND`/`REDIS_CACHE_URL` Redis cache option; caching section, architecture diagram, env table, and frontend-state section now match the code (React Query + Postgres `api_caches`).

---

## 2026-03-23

### Backend
- **Security:** Content Security Policy headers via `ActionDispatch::ContentSecurityPolicy` — `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `block-all-mixed-content` in production. Report-Only mode in development so violations surface without breaking the app. *(OWASP A03 — Injection / XSS escalation surface)*

### Frontend
- **Feature:** Dark mode — toggle stored in `localStorage`, defaults to OS `prefers-color-scheme`. `buildTheme(mode)` factory in `theme.ts` produces a full MUI palette for each mode. Toggle button (sun/moon icon) added to AppBar.
- **Performance:** `moveCache` now survives hard refreshes — persisted to `sessionStorage` and rehydrated on mount. Move detail lookups no longer require a re-fetch after page reload within the same tab.

### Infrastructure
- **Security:** Dependabot config (`.github/dependabot.yml`) — weekly audits for Bundler, npm, and GitHub Actions. Packages grouped by ecosystem (MUI, React Query, dev tools) to reduce PR noise. *(OWASP A06 — Vulnerable and Outdated Components)*

---

## 2026-03-02

### Backend
- **Feature:** Google OAuth user accounts — any user can sign in with Google to create a persistent account. Favorites are now stored in the database (`users` + `favorites` tables) instead of `localStorage`. *(see ADR-006)*
- **Feature:** Sidekiq Web UI (`/sidekiq`) locked behind Google OAuth. Only the account matching `SIDEKIQ_ALLOWED_EMAIL` can access it. Uses OmniAuth server-side redirect flow + `SidekiqAuth` Rack middleware + session cookie — independent of the JWT API auth. *(OWASP A01 — Broken Access Control)*
- **Feature:** `POST /api/v1/auth/google` — verifies a Google ID token via `googleauth` gem, finds-or-creates the user, returns a 30-day JWT for subsequent API calls.
- **Feature:** `GET/POST/DELETE /api/v1/favorites` — authenticated CRUD for user favorites; `before_action :authenticate_user!` on all actions.
- **Dependency:** Added `omniauth-google-oauth2`, `omniauth-rails_csrf_protection`, `googleauth`, `jwt` gems. Used `googleauth` (Google's official library) instead of the abandoned `google-id-token` gem.

### Frontend
- **Feature:** Sign in with Google button (`AuthButton`) in the AppBar — shows Google login when signed out, avatar + "Sign out" when signed in.
- **Feature:** Favorite button disabled with tooltip "Sign in to save favorites" for unauthenticated users; calls DB-backed API when signed in.
- **Feature:** `FavoritesPage` shows sign-in prompt (Google button) when unauthenticated, loads favorites from API when signed in.
- **Feature:** `AppContext` manages auth state (`currentUser`, `token`), persisted to `localStorage`. Favorites loaded from API on mount/sign-in, cleared on sign-out.
- **Dependency:** Added `@react-oauth/google` for the frontend Google sign-in button.

---

## 2026-03-01

### Frontend
- **Fix:** `GameSelector` dropdown showed "no game selected" while the correct game was loaded. Changed `Select` value to derive from the URL via `useMatch("/game/:gameId")` instead of `AppContext`, eliminating a race condition between the async games fetch and context hydration. *(URL as single source of truth — React Router best practice; see ADR-003)*
- **Fix:** Duplicate Pokémon rows returned by `GamesController#show`. Removed redundant `.joins(:game_pokemons)` on a `has_many :through` association that was generating a double JOIN and duplicating every result row. *(Law of Demeter — let ActiveRecord manage association joins)*

---

## 2026-02-28

### Backend
- **Fix:** `PokeapiAdapter#load_pokedex_for_game` was calling the PokeAPI `/pokemon` endpoint with the species *name*, which fails for Pokémon whose species slug differs from their API slug (e.g. Oinkologne). Now extracts the species ID from the PokeAPI URL and uses that instead. *(Use the canonical ID, not a derived name)*
- **Fix:** Rescue `ActiveRecord::RecordNotUnique` in `find_or_create_pokemon`, `find_or_create_move`, and `associate_pokemon_with_game` to handle concurrent Sidekiq workers safely. *(Defensive programming — idempotent writes)*
- **Change:** `load_pokedex_for_game` now uses `filter_map` with an inline rescue so individual bad entries are skipped with a warning instead of crashing the entire job.
- **Add:** `SeedGamePokemonJob`, `SeedAllPokemonJob`, `WarmMoveCacheJob` replacing the old lazy-loading approach. *(Single Responsibility — data ingestion lives in jobs, not the request cycle; see ADR-002)*
- **Add:** Rake namespace `pokedex:seed`, `pokedex:seed_pokemon`, `pokedex:reseed_pokemon`.
- **Add:** Sidekiq Web UI mounted at `/sidekiq` using `ActionDispatch::Session::CookieStore`. Resolved `NameError` for `Rack::Session::Cookie` (extracted to a separate gem in Rack 3 and unavailable in API-only Rails).
- **Remove:** `solid_queue` gem replaced by Sidekiq 8. *(See ADR-001)*

### Database
- **Migration:** Add unique index on `game_pokemons(game_id, pokemon_id)` and clean up existing duplicate rows.
- **Migration:** Add unique index on `pokemons.pokeapi_id` and `moves.pokeapi_id`. Repoint orphaned foreign keys to canonical rows and delete 298 duplicate Pokémon rows. *(Database normalisation — enforce integrity at the storage layer)*

### Frontend
- **Add:** React Router v7 — `BrowserRouter` in `main.tsx`, `Routes` in `App.tsx`. Routes: `/`, `/game/:gameId`, `/game/:gameId/pokemon/:pokemonName`, `/pokemon/:pokemonName`, `/favorites`. *(URL-driven state — deep-linkable and history-aware)*
- **Add:** `AppContext` providing `selectedGame`, `games`, `favorites` (persisted to `localStorage`), and `moveCache` (in-memory). *(Lifting state — avoid prop drilling; single source of truth per concern)*
- **Add:** Pages — `GamePage` (responsive Pokémon grid with infinite scroll), `PokemonDetailPage`, `FavoritesPage`.
- **Add:** `PokemonCard` component shared between `GamePage` and `FavoritesPage`. *(DRY — one card component, two consumers)*
- **Add:** `ErrorBoundary` class component wrapping routes and the detail view.
- **Change:** `PokemonDetail` evolution chain items are now clickable links. Uses `moveCache` from context instead of local state. *(DRY — cache lives once in context)*
- **Change:** `GameSelector` reads context + `useNavigate`; auto-selects Scarlet on first load. `PokemonSearch` uses `useNavigate` instead of a callback prop. *(Inversion of control — components navigate themselves)*
- **Change:** `PokemonList` component deleted; logic moved to `GamePage`.
- **Change:** Infinite scroll via `IntersectionObserver` with `rootMargin: "200px"` replaces the "Load More" button. *(Progressive disclosure — load content before the user reaches it)*
- **Add:** Sentry (`@sentry/react`) initialised in `main.tsx`, enabled in `PROD` only.

### Infrastructure
- **Add:** Sidekiq service in `docker-compose.yml`. Redis split into db/0 (Sidekiq) and db/1 (app cache) via `REDIS_URL` / `REDIS_CACHE_URL`. *(See ADR-003. Superseded: the db/1 cache was later replaced by the Postgres `api_caches` table — see the ADR-003 status note and the 2026-07-08 entry.)*
- **Add:** Single root-level `.env.local` / `.env.production`. Vite configured with `envDir: '..'`. *(12-Factor III — config in the environment)*
- **Add:** GitHub Actions CI: backend runs `brakeman` + `bundler-audit`; frontend runs `tsc --noEmit` + `vite build`. *(Shift left on security and type safety)*
- **Add:** Heroku scaffolding — `heroku.yml`, `app.json`, root `Procfile`, `backend/Procfile.dev`. *(12-Factor — dev/prod parity)*
- **Add:** `sentry-ruby` + `sentry-rails` with `config/initializers/sentry.rb`. *(Observability — detect regressions in production)*
