# ADR-009 — A Per-Game National View Built from Learnsets and Every Version-Group Dex

**Date:** 2026-11-05
**Status:** Accepted

## Context

Each game page listed one PokeAPI `/pokedex/{name}`, the game's main in-game dex. Players also want to see every Pokémon a game can hold, including species brought in by transfer: Mew should appear in Sword/Shield, not only in the Kanto and Johto games.

PokeAPI has no per-game national dex. No version group lists `national`, and a version group's `pokedexes` cover only its in-game dexes, so Mew is in none of the Gen 3–9 dexes. Two other sources were rejected:

- `game_indices` lists nearly every species in every later version, including games it is absent from (Bulbasaur in Legends: Arceus).
- Encounter data has no gifts, events, starters or trades, and nothing for BDSP, Legends: Arceus, Scarlet/Violet or Legends: Z-A.

A species' learnsets (`/pokemon/{id}` → `moves[].version_group_details`) name a version group exactly when the game's data includes the species. That matches each era's national dex for Gen 1–7 and gives Sword/Shield 664 and Scarlet/Violet 733. It has small gaps: Legends: Arceus lacks Porygon2, Legends: Z-A has no learnsets at all, DLC species are filed under the base version group, and FireRed/LeafGreen's Deoxys learnset exists only on its Attack and Defense forms.

## Decision

A game's **national** view is the union of:

1. every species whose default-form learnset names the game's version group;
2. every species in all of the version group's `pokedexes`, sub-dexes and DLC dexes included (X/Y Coastal and Mountain, Isle of Armor, Crown Tundra, Kitakami, Blueberry, Hyperspace);
3. the game's regional rows.

So national is always a superset of regional, and a game without learnsets (Legends: Z-A) falls back to its dexes. The **regional** view stays the game's main dex; sub-dexes and DLC dexes appear only nationally. "Available" includes transfer-only species, and mythical species (`/pokemon-species/{id}` → `is_mythical`) carry a label.

Storage stays in `game_pokemons`: `regional boolean NOT NULL DEFAULT true`, a null `pokedex_number` on national-only rows, and `pokemons.pokeapi_id` as the national number. `games.national_seeded_at` marks a filled national view, since for some games (Red/Blue/Yellow, Gold/Silver/Crystal, Legends: Arceus) national adds no rows and row counts can't tell. `pokemons.mythical` holds the label.

`SeedNationalDexJob` (Sidekiq, ADR-002) fills every unstamped game in one pass over the national dex's species, loading one cached payload at a time and inserting with `ON CONFLICT DO NOTHING`, so a national link never changes a regional row. The first `?dex=national` request for an unstamped game enqueues it behind one `enqueue_once` lock and shows a seeding state until the stamp lands.

The SPA keeps the view in the URL (`?dex=national`, ADR-005) and the query key (`["game", gameId, dex]`). The toggle governs the dex page, the team builder's picker, the caught counter (it counts caught Pokémon in the view only) and the detail page's number.

## Consequences

**Positive:**
- Gen 8+ games, where the in-game dex leaves out the most, get a correct "everything in this game" list from data already cached: the pass over cached payloads takes under a minute, and only species no game had seeded (29) need new `/pokemon/` calls.
- X/Y's box legendaries and the DLC species become reachable without changing any regional list.
- Two columns and a flag; no new table.

**Negative:**
- `game_pokemons` roughly doubles (about 8,700 rows to about 18,900).
- The first pass fetches `/pokemon-species/{id}` for species whose detail page was never opened, to read `is_mythical`.
- The known gaps stay: Deoxys is missing from FireRed/LeafGreen's national view, and BDSP's lacks Deoxys, Phione, Darkrai, Shaymin and Arceus, which have no BDSP learnset in PokeAPI.
- Cached payloads are fetched once, forever. When PokeAPI adds learnsets (for Legends: Z-A, say), delete the affected `/pokemon/%` cache rows and run `rails pokedex:seed_national FORCE=1`.

## Alternatives Considered

**Union of the version group's dexes only:** fixes the sub-dex and DLC gaps but never shows transfer-only species; Mew would stay in 10 games.

**Generation cutoff on the national number:** no new data, but wrong from Gen 8 on (it would show every species in Sword/Shield and Bulbasaur in Legends: Arceus).

**A separate `game_dex_entries` table with one row per dex membership:** allows a picker per sub-dex (Central, Coastal, Mountain, National). More migration and query work than a two-state toggle needs; it remains open if per-sub-dex views are wanted.
