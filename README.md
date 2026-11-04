# ToneDex

A dex for the game you're actually playing. Pick a Pokémon game and browse its regional dex, with each Pokémon's moves and types as they are in that game.

## Features

- **Game-specific dex:** choose a game and scroll its regional dex, jump to any section of large dexes, and filter by type across the whole dex.
- **Detail pages:** types (accurate to the game's generation), base stats, abilities, flavor text, evolution chain, and the moves learnable in that game with their learn levels.
- **Search:** one game-aware search bar with autocomplete and sprites.
- **Compare:** two Pokémon side by side, with a shareable URL.
- **Team builder:** pick up to six Pokémon from the game's dex and see where the team is weak, what it resists, and the gaps in its offensive coverage.
- **Accounts:** sign in with Google to keep favorites (reorderable by drag or keyboard) and a caught tracker across devices.
- **Dark mode** and accessibility work: AA contrast on type badges, keyboard-operable controls, focus management on navigation.

## How it works

- **Data comes from [PokeAPI](https://pokeapi.co/), fetched at most once.** Every response is cached permanently in Postgres, including not-found results, so the app never asks PokeAPI the same question twice.
- **Seeding is lazy.** The first visit to a game queues a Sidekiq job that crawls its dex; the page fills in as the job runs.
- **Sprites are self-hosted**, so fast scrolling never hits a third party's rate limits.
- **Two independent auth flows:** the SPA exchanges a Google ID token for a JWT, while the Sidekiq admin UI uses a server-side OmniAuth session restricted to one account.

[ARCHITECTURE.md](ARCHITECTURE.md) covers the system in detail, and [`docs/adr/`](docs/adr/) records the reasoning behind each major decision.

## Tech stack

- **Backend:** Ruby on Rails 8 (API-only), Sidekiq, PostgreSQL 15, Redis 7
- **Frontend:** React 19, TypeScript, Vite, TanStack Query, MUI with styled-components, React Router
- **Testing:** RSpec, Vitest, Playwright
- **CI:** GitHub Actions running linters, all three test suites, Brakeman and bundler-audit
- **Dev environment:** Docker Compose

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

## Tests

```bash
docker compose exec backend bundle exec rspec   # backend
docker compose exec frontend npm test           # frontend unit tests
cd frontend && npm run test:e2e                 # Playwright (API calls are mocked)
```

Playwright starts the Vite dev server itself (or reuses one already on :5173); it needs `npm ci` and `npx playwright install chromium` in `frontend/` first.

## Disclaimer

ToneDex is an unofficial fan project. It isn't affiliated with, endorsed by or sponsored by Nintendo, Game Freak, Creatures Inc. or The Pokémon Company. Pokémon and Pokémon character names are trademarks of Nintendo. Sprites and game data come from [PokeAPI](https://pokeapi.co/) and belong to their respective owners.

## License

The code is released under the [MIT License](LICENSE). The license covers the code only, not Pokémon names, sprites or data.
