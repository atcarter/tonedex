# Changelog

Changes are listed newest first. Each entry notes the affected layer and the principle it relates to where relevant.

---

## 2026-11-05

### Backend
- **Fix:** Legends: Z-A lists the Lumiose City dex (232 species) in region kalos, not Scarlet/Violet's Paldea dex. `GAME_TO_POKEDEX` maps `legends-za` to `lumiose-city`, game seeding takes the region from the dex when the version group names none, and the `FixLegendsZaPokedex` data migration repoints an existing row and deletes its Paldea `game_pokemons` so it reseeds on the next visit. Sprites for Xerneas and Yveltal are mirrored.
- **New:** a national view per game (ADR-009). `GET /api/v1/games/:id?dex=national` lists every species in the game's data: the species whose learnsets name the game's version group, plus every species in all of its dexes (X/Y Coastal and Mountain, the Sword/Shield and Scarlet/Violet DLC dexes, Z-A's Hyperspace), plus the regional rows. Sword/Shield goes from 400 to 664, Scarlet/Violet from 400 to 733, X/Y from 153 to 721, and Mew appears in 34 of 36 games. The default regional view lists the same Pokémon as before.
- **New:** `SeedNationalDexJob` fills every game's national view in one background pass over species, enqueued once by the first national request (or `rails pokedex:seed_national`, `FORCE=1` to redo all), and the view reports `seeding: true` until it finishes. Migration: `game_pokemons.regional`, `games.national_seeded_at` and `pokemons.mythical` (from `is_mythical`). National-only rows have no regional number and never overwrite one; the regional seed promotes them.
- **New:** page one of either view carries the whole view's `pokemon_ids` and `dex_numbers`; list rows and the detail page carry `mythical`; `GET /api/v1/pokemon/:id?game_id=&dex=national` returns the national number.
- **Refactor:** the seed jobs share an `EnqueueOnce` concern for their Redis lock. The regional trigger and `SeedAllPokemonJob` look at regional rows only.
- **Sprites:** the 29 species no game had listed before (Xerneas, Yveltal, Meltan, Melmetal, Kubfu through Calyrex, Walking Wake through Pecharunt) are mirrored and committed.
- **Fix:** `SeedAllPokemonJob` enqueues each game through `SeedGamePokemonJob.enqueue_once`, so the per-game lock is held from the fan-out on and a visitor can't start a second crawl of the same game.
- **Chore:** the Ruby base image moves from 3.3.3-slim to 3.3.13-slim (Debian 13), the base stage runs `apt-get upgrade`, and `backend/.ruby-version` matches. Every outdated gem is updated, including Puma 8, sentry-ruby 7, redis 6 and Sidekiq 8.1.7. Dependabot watches the Dockerfile and groups minor and patch updates into one weekly PR per ecosystem.

### Frontend
- **New:** the team builder's defensive overview lists each member instead of each attacking type: the member's sprite and name, then the types that hit it under separate 4×, 2×, ½×, ¼× and 0× (immune) tiers, with empty tiers left out and unlisted types noted as 1×. Screen readers hear each tier as text ("4 times damage from", "Immune to") rather than the symbol. `memberDefense` replaces the type-grouped `defenseSummary`; offensive coverage is unchanged.
- **New:** a Regional/National toggle on the game page and the team builder, kept in the URL as `?dex=national` and carried onto detail links and game switches. The query key is `["game", gameId, dex]`.
- **New:** a Mythical label on cards and the detail header.
- **Fix:** the caught counter counts only caught Pokémon in the list shown, so national-only catches don't inflate the regional total. Dex-section jumps bucket the numbers actually present, which are sparse in the national view.
- **New:** phone layouts. Below the `sm` breakpoint the header is one 56px row (logo, game selector, a search button and an account menu holding favorites, color mode and sign-in) that hides on scroll down; the dex is a three-column grid of equal-size compact cards with sideways-scrolling filter and jump rows; and the detail, compare, team, favorites and 404 pages fit 375px.
- **New:** switching games keeps the page. The team builder stays on the team builder, and a detail page stays on its Pokémon when the new game's dex has it; otherwise the switch opens the new game's dex.
- **New:** the team builder's picker collapses when the team fills and has a Show/Hide toggle, and team slots link to the member's detail page. The defensive overview groups attacking types into Weak, Resists and Immune rows with the sprites of the members each affects (4× and ¼× marked), and the offensive check reads "No strong attack against:".
- **Accessibility:** `e2e/a11y.spec.ts` runs axe on the detail, compare, team, favorites and 404 pages at desktop and phone widths, with no exclusions. Header search is a named combobox, the game select and card toggles are named, and card toggles expose `aria-pressed`.
- **Chore:** build, test and lint tooling majors: Vite 8, `@vitejs/plugin-react` 6, Vitest 5, jsdom 30, `@testing-library/jest-dom` 7, ESLint 10. The dev image moves to Node 22, matching CI and Render. npm packages are also updated within range, clearing the Dependabot alerts.
- **Dependency:** MUI 7 → 9 (`@mui/material` and `@mui/icons-material` 9.5; MUI skipped 8). v9 drops system props and the deprecated slot props, so Typography and Box system props in `AppHeader` and `ErrorBoundary` move into `sx`, the game menu's `PaperProps` becomes `slotProps.paper`, and the compare picker's `inputProps` becomes `slotProps.htmlInput`. A game menu opened by pointer no longer draws the focus tint on the selected game. MUI's supported browsers rise to Chrome 117, Firefox 121 and Safari 17.
- **Dependency:** `@sentry/react` 10 → 11.11. v11 replaces `sendDefaultPii` with `dataCollection`, whose unset default lets Sentry infer the visitor's IP, so `Sentry.init` sets `dataCollection: { userInfo: false }` to keep v10's behaviour. The DSN, production-only `enabled`, environment and 0.2 trace sample rate are unchanged. Other v11 defaults apply: non-`Error` values and messages get a synthetic stack trace (`attachStacktrace`), and tracing streams spans, though the app adds no tracing integration. v11 needs Node 20.19+, TypeScript 5.0.4+ and Safari 15+, all already met.

### Tooling
- **Test:** each Playwright e2e run starts its own Vite dev server on a free port (`--strictPort`) and never reuses a server it didn't start, so two copies of the repo can run e2e at once without one testing the other's code. `E2E_BASE_URL` opts in to a dev server that's already running. CI still starts a fresh server per run.

### Docs
- ADR-009, a status note on ADR-002, and ARCHITECTURE's regional and national data flow, columns and query keys.
- **Refresh:** README and ARCHITECTURE match what has shipped. Both describe the CSP as enforcing and the deploy gate; ARCHITECTURE lists the ToneDex project and Production environment, game switching, the smoke suite and `SeedAllPokemonJob`'s fan-out. README gains the national view, the team builder changes, phone layouts, the smoke suite, Dependabot, current versions and suite sizes, and drops the Screenshots section, whose images were never committed.

---

## 2026-11-04

### Infrastructure
- **Deployed:** production runs on Render, region ohio, with every resource declared in Terraform under `infra/render` (`render-oss/render` provider, ADR-008): the `tonedex-api` web service (Docker, Thruster on `HTTP_PORT` 10000, `/up` health check, `db:migrate` before each deploy), the `tonedex-worker` Sidekiq worker, the `tonedex-web` static site (SPA rewrite, security headers, CSP), `tonedex-db` (Postgres 15, private network only), `tonedex-redis` (Key Value, free plan, `noeviction`) and the `tonedex-backend` env group the api and worker share. `plan` and `apply` are run by hand; state is local and gitignored. The first seed copied the development `api_caches` table in, so it made no PokeAPI calls.

- **Fix:** `infra/render` declares the ToneDex project and its Production environment and places every resource in it, matching the dashboard, so `apply` no longer tries to move services out of the environment. An existing stack imports the project once before its next apply (see `infra/render/README.md`).
- **New:** deploys wait for CI. `tonedex-api`, `tonedex-worker` and `tonedex-web` set `auto_deploy_trigger = "checksPass"`, so Render deploys a commit on `main` only after its GitHub checks pass; before, every push deployed at once.
- **Security:** the static site's CSP is enforced: it is sent as `Content-Security-Policy` instead of `Content-Security-Policy-Report-Only`. `frontend/e2e-smoke/csp.spec.ts` loads every route signed out at desktop and phone widths, plus Google sign-in, and fails on any CSP console message; it passed against the report-only header, so the policy needed no new sources.

### Backend
- **Fix:** production boots from a single `DATABASE_URL`. `config/database.yml` has one `production` entry, `solid_cache` and its schema are gone, and the cache store is `:memory_store`.

### CI
- **New:** the `backend-image` job in `ci.yml` builds the production backend image and waits for `/up` to answer 200 against Postgres and Redis service containers.
- **New:** `terraform.yml` runs `terraform fmt -check`, `init -backend=false` and `validate` on `infra/`, without credentials. Both workflows' five jobs are required checks on `main`.
- **New:** a scheduled, read-only Playwright smoke suite against production (`frontend/e2e-smoke`, `.github/workflows/smoke.yml`, run locally with `npm run test:smoke`). It runs weekly, Sundays 14:17 UTC, and on demand.

### Docs
- **README** gains the live URL, a Screenshots section, a Render architecture sketch, suite sizes, a security-posture section and the dev and production `VITE_API_URL` values. **ARCHITECTURE** gains a Deployment section, **CLAUDE.md** a deployment rule (agents never run `plan` or `apply`), and `.env.example` documents the production-only `SECRET_KEY_BASE`, `DATABASE_URL`, `ALLOWED_HOSTS` and `HTTP_PORT`.

### Backend
- **Security:** loofah 2.25.2 → 2.25.3, nokogiri 1.19.4 → 1.19.7 and rails-html-sanitizer 1.7.1 → 1.7.2, for advisories published after the 2026-11-01 audit; the first CI run on GitHub caught them. (OWASP A06 — Vulnerable and Outdated Components)
- **Removed:** the `pokemon_moves` table, `PokemonMove` and `PokemonImporter#link_move`. Nothing ever wrote the table: the detail page reads move lists from the cached PokeAPI payload. `PokeapiAdapter#pokemon_moves_for_game` and `#pokedex_count_for_game`, `PreloadGamePokemonJob`, `WarmMoveCacheJob` and the one-off `backfill:past_types` task had no callers and are gone too.
- **Removed:** `CacheService`. It was a pass-through to `ApiCache` left over from the Redis cache option; `PokeapiClient` takes the model directly.
- **Refactor:** one `Generation` lookup maps PokeAPI generation names to numbers for both game seeding and `Pokemon#types_for_generation`; the adapter's roman-numeral parser is gone.
- **Refactor:** `Favorite` drops its `default_scope`; the favorites index orders by position explicitly.
- **Security:** `/up` reports a failing check by error class only and logs the message, which can name internal hosts.
- **Chore:** Rails scaffolding with no role here is removed: Action Mailer (railtie, base mailer, layouts and config), `bin/ci` with `config/ci.rb` (it ran RuboCop against a config that didn't exist; the project uses standardrb), `bin/jobs` (solid_queue) and `bin/rubocop`.
- **Fix:** the Sidekiq login page heading reads ToneDex.

### Frontend
- **Security:** `npm audit fix` clears every high and low npm advisory (vite, undici, react-router, postcss, zod, brace-expansion and others, all within existing semver ranges; `package.json` is unchanged). Fifteen moderate advisories in the ESLint, typescript-eslint and Vitest tooling remain, since the only fix npm offers is a downgrade.
- **Chore:** `App.css`, `index.css` and the Vite logo, none of which were imported, are removed. `GamePage`'s styled components move to `GamePage.styles.ts`. React Query devtools become a dev dependency, and the package is named `tonedex-frontend`.
- **Refactor:** `fetchJson` handles 204 responses, so the DELETE and reorder calls share its 401 and 429 handling instead of repeating it.

### CI
- **Fix:** the backend job sets placeholder `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `SIDEKIQ_ALLOWED_EMAIL` at job level. The OmniAuth initializer fetches them at boot, so `db:schema:load` raised `KeyError` on the first run on GitHub (earlier runs had only happened inside the dev container, where the real values exist).
- The e2e job no longer boots Docker Compose. Every API call is mocked, so Playwright's `webServer` starts the Vite dev server and that is the whole stack.

### Docs
- **CLAUDE.md** is rewritten: the architecture sections that duplicated ARCHITECTURE.md become a pointer plus the invariants an agent must keep, and it gains a Gotchas section (the worktree bind-mount trap with a verified one-off-container command, the `RAILS_ENV` override, the secrets-file rule, Brakeman, Thruster's port) and a Conventions section (commits, styling, docs, no planning in the repo).
- ADR-002 is retitled to say what it decides (seed through background jobs, never inside a request); the file name is unchanged. ADR-008 drops scheduling and personal context. ARCHITECTURE, CLAUDE.md and the backend README match the removals above. The desktop-app preview config `.claude/launch.json` is no longer tracked.

---

## 2026-11-02

### Frontend
- **Renamed** the app from PokéManiac to ToneDex: the header logo (styled as TONEDEX, with plain text "ToneDex" for screen readers), the page title, the Sidekiq login page and the docs. Domain examples in comments and `.env.example` now use `example.com`.
- **Copy:** generic "Pokédex" wording in the UI and README now says "dex" (the 404 page links "Back to ToneDex").
- **Fix:** `GamePage` passes lint again. The `?loaded=` restore depth is state instead of a ref, since render reads it; clearing the section-jump target stays in its effect, with the reason noted, because it depends on whether the card is in the DOM yet.

### Backend
- **Removed:** `config/initializers/content_security_policy.rb`. It never took effect: API-only Rails leaves the CSP middleware out of the stack, so no response carried the policy. The Sidekiq UI, the only HTML Rails serves, sets its own CSP. `API_ORIGIN`, which only that file read, is gone too.

### Docs
- **README** rewritten for a public audience: what the app does, how it works, a quick start that works on a fresh clone (copy `.env.example`, then `db:prepare`), how to run the tests, and links to ARCHITECTURE and the ADRs.
- **License:** MIT for the code, plus a fan-project disclaimer: Pokémon names, sprites and data belong to their owners and aren't covered.
- **Fix:** CLAUDE.md no longer calls `GAME_TO_POKEDEX` tech debt; `games.pokedex_name` has been authoritative since 2026-07-08, so adding a game is a DB insert.
- **Fix:** ARCHITECTURE, CLAUDE.md, the READMEs and ADRs 001–007 match the code again: the service and job lists (`PokemonImporter`, `SpriteStore`, `MirrorSpriteJob`), seeding that auto-refreshes instead of asking for a reload, the search throttle that replaced the games one, the health check's Redis ping, and status notes on superseded or refined decisions. `backend/README.md` replaces the Rails generator placeholder. In older entries, a wrong ADR link (003 → 005) and two misdated headers are corrected.

---

## 2026-11-01

### Infrastructure
- **Removed:** the Heroku config (`heroku.yml`, `app.json`, `Procfile`). It was never deployed, and the account is cancelled. Heroku and dyno wording in ARCHITECTURE, CLAUDE.md and code comments is now platform-neutral; Render specifics land once production is live (ADR-008).
- **CI:** Brakeman runs through `bundle exec` (the binstub's `--ensure-latest` fails whenever a newer release exists), and bundler-audit runs `check --update`, so a fresh GitHub runner gets the current advisory database.

### Backend
- **Security:** against a fresh advisory database, bundler-audit flagged 23 gems. A conservative, minor-level update of just those gems clears it: Rails 8.1.2 → 8.1.4, rack 3.2.5 → 3.2.8, puma 7.2.0 → 7.2.1, jwt 3.1.2 → 3.3.0, oauth2 2.0.18 → 2.1.0 and nokogiri 1.19.1 → 1.19.4, among others. No code changes; RSpec, standardrb and Brakeman pass. (OWASP A06 — Vulnerable and Outdated Components)

### Docs
- **Fix:** ARCHITECTURE and CLAUDE.md describe frontend state as it is: `AppContext` holds auth and the selected game, `UiContext` holds toast and color mode, and the deleted `moveCache` is gone. The query-key list gains `move` and `suggestions`.

---

## 2026-10-30

### Docs
- **Decision:** ADR-008 settles production hosting: Render, with every resource in Terraform (`infra/render`, applied by a human) and GitHub settings managed by hand.

---

## 2026-07-22

### Frontend
- **Accessibility:** Type-badge contrast audited — 9 of 18 pairings failed WCAG AA with white text; per-badge text color now puts every pairing at ≥5.59:1. Route changes move focus to the main region so keyboard/screen-reader users land on the new content.
- **Feature:** Infinite-scroll depth persists as `?loaded=` (history-replacing); back-navigation and refresh refetch to that depth so native scroll restoration has the content height it needs.
- **Feature:** Dex-section quick-jump — "Jump to" chips per 50 dex numbers on large dexes load through the target section and smooth-scroll to it; floating back-to-top for the return. (Shipped in place of generation tabs: regional dex ordering interleaves generations non-contiguously.)
- **Refactor:** Toast + color mode moved to a dedicated `UiContext`, so toast churn no longer re-renders every auth/game consumer; `AppContext` keeps auth + selected game.

### Backend
- **Refactor:** `PokemonImporter` extracted from `PokeapiAdapter` — the importer owns all ActiveRecord writes (concurrency-safe upserts, backfills, association linking, sprite-mirror enqueue); the adapter is a pure payload transformer with no AR references. Public API unchanged; 141 specs passed as-is.

---

## 2026-07-09 to 2026-07-13

### Backend
- **Feature:** Self-hosted sprites — `SpriteStore` mirrors PokeAPI sprite PNGs into `public/sprites/` (committed to git; production disks are ephemeral, so the mirror must ship in the image). `PokemonSerializer` serves mirrored URLs rooted at the request origin and falls back to the original PokeAPI URL for unmirrored files. `rails pokedex:mirror_sprites` backfills idempotently; `MirrorSpriteJob` (enqueued by the adapter) covers newly created pokemon. Fixes broken card images under fast scrolling — `raw.githubusercontent.com` throttles request bursts. *(Don't put a third party's rate limits in your render path)*

### Frontend
- **Fix:** Card sprites load lazily (`loading="lazy"` — only near-viewport images fetch, verified 14/40 on first paint) and show a pokéball placeholder on load failure instead of the browser's broken-image icon.
- **Feature:** Search-bar autocomplete — typing (2+ chars, 200ms debounce) shows up to eight matches with their self-hosted sprites, prefix matches first. Arrow keys highlight, Enter selects, Escape/click-outside dismiss; Enter with no highlight still runs the full search for unseeded names. Backed by a new DB-only `GET /api/v1/pokemon/suggestions` endpoint that never touches PokeAPI, so it's safe per keystroke.
- **Feature:** Comparison view at `/compare` — two autocomplete pickers, side-by-side stat bars with the winning stat highlighted per side, and base-stat totals (ties stay neutral). Selection is URL state (`?left=&right=`), so comparisons are shareable.
- **Accessibility:** Favorites reorder is keyboard-operable — move-earlier/later buttons per card (hover- or focus-revealed, boundary-disabled) with a polite `aria-live` announcement; drag-and-drop unchanged for mouse users.
- **Fix:** The game-less `/pokemon/:name` route (compare, favorites, deep links) showed no moves section; it now defaults the moves context to the game being browsed, falling back to Scarlet — the section title names the game used.
- **Chore:** Pokéball favicon replaces the stock Vite logo.
- **UX:** One search bar — the AppBar search now navigates within the selected game's context (`/game/:id/pokemon/:name`), so results are full detail pages with moves, caught toggle, and dex number; the dex grid's redundant name-filter box is gone (type chips remain, and whole-dex auto-fetch keys off them). *(User feedback: two look-alike inputs with different behaviours felt awkward.)*
- **Feature:** Team builder at `/game/:gameId/team` (entry point on the dex filter bar) — assemble up to six Pokémon from the current game's dex with a filterable picker, see a per-attacking-type defensive overview (weak vs. resist counts, net weaknesses highlighted) and STAB offensive-coverage gaps. Backed by a Gen-6+ type chart and pure analysis functions with 17 unit tests; the team persists per game in `localStorage`. *(Modern-chart simplification for older gens noted in code.)*
- **Fix (test infra):** Vitest 4 launches Node with `--localstorage-file` and no valid path, so Node's broken experimental webstorage shadowed jsdom's Storage in tests ("localStorage.removeItem is not a function"). The test setup now installs a real in-memory Storage.

---

## 2026-07-08

### Repository
- **Chore:** The backend, docs and infra config join the repository alongside the finished React Query migration, committed in logical chunks. Added `.gitignore` coverage for Playwright artifacts and a root `.env.example` documenting every env key.

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
- **Fix:** `GameSelector` dropdown showed "no game selected" while the correct game was loaded. Changed `Select` value to derive from the URL via `useMatch("/game/:gameId")` instead of `AppContext`, eliminating a race condition between the async games fetch and context hydration. *(URL as single source of truth — React Router best practice; see ADR-005)*
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
