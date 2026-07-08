# ADR-002 — Pre-seeding over lazy loading

**Date:** 2026-02-28
**Status:** Accepted

## Context

Pokémon data was originally fetched from the PokeAPI on the first user request for a game. This approach had several problems:

- The first visitor to a game page triggered a fan-out of hundreds of PokeAPI requests inside the HTTP request cycle, causing slow or timed-out responses.
- Concurrent first-visit requests triggered duplicate inserts (requiring unique-index migrations and `rescue ActiveRecord::RecordNotUnique` workarounds).
- The request path depended on an external API being available.

Pokémon data changes infrequently — only when a new mainline game is released, which happens roughly once per year.

## Decision

Seed all data **once at deploy time** via `rails pokedex:seed`. The HTTP request path reads exclusively from the database and never calls the PokeAPI at runtime.

A background job (`SeedGamePokemonJob`) is auto-enqueued only when a specific game has zero `game_pokemons` rows — i.e., on the first deploy after a new game is added to the `games` table.

## Consequences

**Accepted trade-offs:**
- The seed job takes several minutes to complete (one PokeAPI request per Pokémon, per game). The app must be running a Sidekiq worker during the initial deploy.
- Adding support for a new game requires a manual `rails pokedex:reseed_pokemon` or a new deploy that triggers the auto-enqueue logic.
- If the seed job fails partway through, re-running it is safe (all writes are idempotent via `find_or_create_by!`).

**Benefits gained:**
- Page loads are fast regardless of whether data exists — only the DB is queried.
- No external API dependency at runtime; the app degrades gracefully if PokeAPI is down.
- No request-path race conditions or duplicate-insert pressure.
- The seeding system is independently testable and retryable.
