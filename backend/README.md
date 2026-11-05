# ToneDex backend

The Rails 8 API-only app: the JSON API under `/api/v1`, the Sidekiq jobs that seed data from PokeAPI, and the Sidekiq Web UI. Setup is in the [root README](../README.md); the design is in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Layout

- `app/controllers/api/v1/`: JSON endpoints; signed-in routes use `ApplicationController#authenticate_user!` (JWT)
- `app/services/`: PokeAPI access (`PokeapiClient`, `PokeapiAdapter`), the response cache (the `ApiCache` model), database writes (`PokemonImporter`) and sprite mirroring (`SpriteStore`)
- `app/jobs/`: seeding, cache-warming and sprite-mirroring jobs (Sidekiq)
- `lib/tasks/pokedex.rake`: `pokedex:seed`, `pokedex:reseed_pokemon`, `pokedex:seed_national`, `pokedex:mirror_sprites`

## Commands

Run inside Docker Compose:

```bash
docker compose exec backend bundle exec rspec                # tests
docker compose exec backend bundle exec standardrb --no-fix  # lint
docker compose exec backend bundle exec brakeman             # security scan
docker compose exec backend bundle exec rails pokedex:seed   # seed every game (slow; runs through Sidekiq)
```
