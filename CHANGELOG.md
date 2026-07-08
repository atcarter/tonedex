# Changelog

Changes are listed newest first. Each entry notes the affected layer and the principle it relates to where relevant.

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
- **Add:** Sidekiq service in `docker-compose.yml`. Redis split into db/0 (Sidekiq) and db/1 (app cache) via `REDIS_URL` / `REDIS_CACHE_URL`. *(See ADR-004)*
- **Add:** Single root-level `.env.local` / `.env.production`. Vite configured with `envDir: '..'`. *(12-Factor III — config in the environment)*
- **Add:** GitHub Actions CI: backend runs `brakeman` + `bundler-audit`; frontend runs `tsc --noEmit` + `vite build`. *(Shift left on security and type safety)*
- **Add:** Heroku scaffolding — `heroku.yml`, `app.json`, root `Procfile`, `backend/Procfile.dev`. *(12-Factor — dev/prod parity)*
- **Add:** `sentry-ruby` + `sentry-rails` with `config/initializers/sentry.rb`. *(Observability — detect regressions in production)*
