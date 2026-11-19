# ADR-010 — Encounter Locations Read Cache-Only, Warmed by a Job and Settled per Game

**Date:** 2026-11-17
**Status:** Accepted

## Context

The detail page gains a "Where to Catch It" section: the areas where a Pokémon is encountered in the selected game, with the method, level range and chance. PokeAPI serves this as `/pokemon/{id}/encounters`, one payload per Pokémon covering every version.

PokeAPI's coverage is uneven. It has no encounters at all for Brilliant Diamond/Shining Pearl, Legends: Arceus, Scarlet/Violet or Legends: Z-A, and it files Sword/Shield's DLC areas under versions of their own (`the-isle-of-armor-sword`, `the-crown-tundra-shield`). So an empty list for one Pokémon is ambiguous: either the Pokémon isn't in the wild in that game, or PokeAPI has no data for the game. The page has to say which, and that can't be read from the one Pokémon's payload.

ADR-002 keeps PokeAPI out of the request path, except for search and move details. The abilities text (ADR-002's 2026-11-05 note) is read cache-only so that it isn't a third runtime path.

## Decision

- **Request path is cache-only.** `GET /api/v1/pokemon/:id/encounters?game_id=` reads the cached payload with `cache_only: true` and returns `{status, locations, evolves_from}`. Status is `found`, `none` (the game has data and this Pokémon has no rows in it), `unavailable` (PokeAPI has no encounters for the game) or `pending`.
- **Per game, not per Pokémon.** `games.encounters_available` (boolean, null until checked) records whether any of the game's Pokémon has an encounter in the game's versions. `WarmEncountersJob` settles it: it caches the requested Pokémon first, then every Pokémon the game has (regional first, in dex order). The first hit sets `true`. A pass with no hit and no failed fetch sets `false`, but only over a seeded dex: while the game has no regional rows or `SeedGamePokemonJob` holds its lock, a partial list proves nothing. Otherwise it stays null so a later visit retries.
- **Lazy, behind one lock per game.** A `pending` answer (payload not cached, or no rows while the game is unsettled) enqueues the job through `enqueue_once`, and the SPA polls every 5 seconds until the status changes, as the dex does while seeding.
- **DLC versions** are listed per game in `PokeapiAdapter::ENCOUNTER_DLC_VERSIONS`, and each row they produce carries its DLC's name. The app models DLC as part of the base game, so they are not separate games.
- **Rows** are one per area and method, base game first, in PokeAPI's area order. The chance in a condition state sums every slot whose conditions it satisfies, and the row shows the best of them (marked "up to" when they differ). States take one value per kind of condition (time, swarm, radio…), since slots that depend on different kinds can be active together, and each slot's own set. Conditions every slot needs are listed; the others are named by kind ("varies with time of day").
- **Earlier stage.** With `none`, `evolves_from` names the stage the Pokémon evolves from when the game has both, so the page can say "Evolve it from …". It is decided here, not from the page's evolution chain, which is shown in full for a species the game lacks. The species and chain are read cache-only too; the detail page has just fetched them.

## Consequences

**Positive:**
- No new runtime path to PokeAPI. Each encounters endpoint is fetched once, ever, like every other payload.
- "No data for this game" is a fact about the game, decided once, so Scarlet never says a Pokémon can't be caught.
- One boolean column; no new table.

**Negative:**
- The first visit to a game's detail pages starts a pass over all of its Pokémon. For a game PokeAPI has no data for, the section shows "Checking where to find it…" for the minutes that pass takes, once.
- A searched Pokémon outside the game's list is warmed on its own, but only after a running pass for that game releases the lock.
- Both the payloads and the flag are permanent. If PokeAPI adds encounters for a game, delete the `/pokemon/%/encounters` cache rows and set the game's `encounters_available` back to null.

## Alternatives Considered

**Fetch cache-first in the request, like move details:** simpler for one Pokémon, but a third runtime path, and it still can't tell "none" from "no data for this game" without a per-game check.

**A hard-coded list of games without data:** no job, but wrong as soon as PokeAPI fills a gap, and a guess rather than a reading of the data.

**Warm every game in the seed jobs:** doubles the seed's PokeAPI calls and still needs a backfill for games already seeded. The lazy job covers both.
