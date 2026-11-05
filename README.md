# ToneDex

A dex for the game you're actually playing. Pick a Pokémon game and browse its regional dex, or every Pokémon the game can hold, with each Pokémon's moves and types as they are in that game.

**Live:** https://tonedex-web.onrender.com

## Features

- **Game-specific dex:** choose a game and scroll its regional dex, jump to any section of large dexes, and filter by type across the whole dex. A Regional/National toggle switches to every species in the game's data, including transfer-only ones, and mythical Pokémon carry a label.
- **Detail pages:** types (accurate to the game's generation), base stats, abilities, flavor text, evolution chain, and the moves learnable in that game with their learn levels.
- **Search:** one game-aware search bar with autocomplete and sprites.
- **Compare:** two Pokémon side by side, with a shareable URL.
- **Team builder:** pick up to six Pokémon from the game's regional or national dex. The picker collapses once the team is full, and each slot links to that Pokémon's detail page. The defensive overview lists the types the team is weak to, resists and is immune to, with the sprites of the members each type affects (4× and ¼× marked), and the offensive check names the types that none of the members' own types hit super-effectively.
- **Game switching keeps your place:** switching games on the team builder stays on the team builder, and on a detail page stays on that Pokémon when the new game has it.
- **Accounts:** sign in with Google to keep favorites (reorderable by drag or keyboard) and a caught tracker across devices.
- **Phone layouts:** every page fits a 375px screen, and the header collapses to one row that hides while scrolling down.
- **Dark mode** and accessibility work: AA contrast, keyboard-operable controls, focus management on navigation, and an axe audit of the detail, compare, team, favorites and 404 pages at desktop and phone widths in the end-to-end suite.

## How it works

- **Data comes from [PokeAPI](https://pokeapi.co/), fetched at most once.** Every response is cached permanently in Postgres, including not-found results, so the app never asks PokeAPI the same question twice.
- **Seeding is lazy.** The first visit to a game queues a Sidekiq job that crawls its dex, and the first national view queues one pass that fills every game's national list; the page fills in as the jobs run.
- **Sprites are self-hosted**, so fast scrolling never hits a third party's rate limits.
- **Two independent auth flows:** the SPA exchanges a Google ID token for a JWT, while the Sidekiq admin UI uses a server-side OmniAuth session restricted to one account.

[ARCHITECTURE.md](ARCHITECTURE.md) covers the system in detail, and [`docs/adr/`](docs/adr/) records the reasoning behind each major decision.

## Tech stack

- **Backend:** Ruby 3.3, Ruby on Rails 8.1 (API-only), Puma behind Thruster, Sidekiq, PostgreSQL 15, Redis 7
- **Frontend:** React 19, TypeScript, Vite 8, TanStack Query, MUI with styled-components, React Router
- **Testing:** RSpec, Vitest, Playwright (mocked end-to-end tests, plus a read-only smoke suite against production)
- **CI:** GitHub Actions running linters, all three test suites, Brakeman and bundler-audit, a boot check of the production backend image, and Terraform fmt and validate; the production smoke suite runs weekly
- **Dev environment:** Docker Compose
- **Hosting:** Render, declared in Terraform

## Running locally

Prerequisites: Docker with Docker Compose.

```bash
cp .env.example .env.local
docker compose up --build -d
docker compose exec backend bundle exec rails db:prepare
```

`db:prepare` creates the database and seeds the game list from PokeAPI. Then open:

- Frontend: http://localhost:5173
- API: http://localhost:3000

Browsing works with the placeholder values in `.env.example`. Google sign-in needs your own OAuth client ID in `.env.local`.

`VITE_API_URL` tells the SPA where the API lives: `http://localhost:3000` in development (the value in `.env.example`, and the fallback when it's unset) and `https://tonedex-api.onrender.com` in production, where Terraform sets it on the static site. Vite bakes it into the bundle at build time, so changing it means rebuilding the frontend.

## Tests

```bash
docker compose exec backend bundle exec rspec   # backend
docker compose exec frontend npm test           # frontend unit tests
cd frontend && npm run test:e2e                 # Playwright (API calls are mocked)
```

Playwright starts the Vite dev server itself (or reuses one already on :5173); it needs `npm ci` and `npx playwright install chromium` in `frontend/` first.

The backend suite has about 170 RSpec examples, the frontend about 90 Vitest tests, and the end-to-end suite about 70 Playwright tests.

The smoke suite (`frontend/e2e-smoke`, 18 tests) checks a live deployment without mocks, sign-in or writes: the API's health and game list, Scarlet's dex and a deep-linked detail page, and that no route triggers a Content Security Policy violation at desktop or phone width. `.github/workflows/smoke.yml` runs it against production every Sunday and on demand. To run it locally:

```bash
cd frontend && SMOKE_BASE_URL=https://tonedex-web.onrender.com SMOKE_API_URL=https://tonedex-api.onrender.com npm run test:smoke
```

## Deployment

Production runs on [Render](https://render.com) in the ohio region, in the ToneDex project's Production environment. Every resource is declared in Terraform under `infra/render` with the `render-oss/render` provider. [infra/render/README.md](infra/render/README.md) is the source of truth for how the stack is built, applied and torn down, and [ADR-008](docs/adr/008-render-via-terraform.md) records why.

- Frontend: https://tonedex-web.onrender.com
- API: https://tonedex-api.onrender.com

```mermaid
flowchart LR
  browser(["Browser"])
  subgraph render["Render: ToneDex project, Production environment"]
    web["tonedex-web<br/>static site, global CDN"]
    env{{"tonedex-backend<br/>env group"}}
    subgraph ohio["Region ohio"]
      api["tonedex-api<br/>Rails API in Docker, Thruster"]
      worker["tonedex-worker<br/>Sidekiq in Docker"]
      subgraph private["Private network only"]
        db[("tonedex-db<br/>Postgres 15")]
        redis[("tonedex-redis<br/>Key Value")]
      end
    end
  end
  browser -->|"HTML, JS, CSS"| web
  browser -->|"API calls with a JWT"| api
  api --> db
  api --> redis
  worker --> db
  worker --> redis
  env -.->|"connection strings, secrets"| api
  env -.->|"connection strings, secrets"| worker
```

- **tonedex-api** builds the production stage of `backend/Dockerfile`. Thruster listens on `HTTP_PORT` 10000 and starts Puma behind it, `/up` is the health check, and `db:migrate` runs before each deploy.
- **tonedex-worker** runs `bundle exec sidekiq` from the same image.
- **tonedex-web** is the Vite build of `frontend/`, with a rewrite to `index.html` for deep links and the headers listed under Security.
- **tonedex-db** is PostgreSQL 15. **tonedex-redis** is a Key Value instance on the free plan with the `noeviction` policy, so Sidekiq jobs are never evicted. Neither accepts external connections.
- **tonedex-backend** is the env group the api and worker share: `DATABASE_URL`, `REDIS_URL`, the secrets, `CORS_ORIGINS` and `ALLOWED_HOSTS`.

Render deploys a commit on `main` only after its GitHub checks pass (`ci.yml` and `terraform.yml`), so a failing commit never reaches production. The first production seed copied the development `api_caches` table into the production database, so seeding made no PokeAPI calls.

## Security

- **Authentication:** the SPA exchanges a Google ID token for a 30-day JWT, sent as a bearer token on authenticated calls. The Sidekiq UI uses a separate OmniAuth session restricted to one Google account.
- **CORS allowlist:** the API accepts cross-origin requests only from `CORS_ORIGINS` (the frontend URL in production), and production refuses to boot without it.
- **Host authorization:** production checks the `Host` header against `ALLOWED_HOSTS` and forces SSL with HSTS.
- **Rate limiting:** Rack::Attack throttles the API, auth and search routes per IP.
- **Static-site headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and an enforcing Content Security Policy that blocks anything it doesn't allow. [infra/render/README.md](infra/render/README.md#content-security-policy) explains each source.
- **Private data stores:** Postgres and Key Value accept connections only from Render's private network.
- **Scanning:** CI runs Brakeman on the Rails code, bundler-audit on the gems, gitleaks on the git history and Trivy on the production image and infrastructure config for every pull request and push to `main`. GitHub secret scanning is on for the repository, and Dependabot opens weekly update pull requests for the gems, npm packages, GitHub Actions and the backend's Ruby base image.

## Disclaimer

ToneDex is an unofficial fan project. It isn't affiliated with, endorsed by or sponsored by Nintendo, Game Freak, Creatures Inc. or The Pokémon Company. Pokémon and Pokémon character names are trademarks of Nintendo. Sprites and game data come from [PokeAPI](https://pokeapi.co/) and belong to their respective owners.

## License

The code is released under the [MIT License](LICENSE). The license covers the code only, not Pokémon names, sprites or data.
