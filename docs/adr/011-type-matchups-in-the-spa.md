# ADR-011 — Type Matchups Computed in the SPA, per Generation, with One Ability Folded In

**Date:** 2026-11-17
**Status:** Accepted

## Context

The detail page needs a defensive type chart: which attacking types hit the Pokémon for 4×, 2×, ½×, ¼× and 0× in the selected game. The team builder already computes the same tiers in the SPA from a static Gen 6+ chart (`constants/typeChart.ts`), and the detail response already carries the game's types and its abilities in slot order.

The chart changed across generations: Gen 1 had no Dark or Steel and four matchups that differ from later games, and Steel resisted Ghost and Dark until Gen 6, when Fairy arrived. Some abilities change incoming damage too, so a types-only chart is wrong for them: in a Gen 3–6 game, Gengar has Levitate and takes nothing from Ground.

PokeAPI's `/type/{name}` has `damage_relations` and `past_damage_relations`, but it says nothing about abilities.

## Decision

Compute the chart in the SPA, from data the page already has:

- `typeChart.ts` takes an optional generation. With one, it applies Gen 1's and Gen 2–5's differences and leaves out types the generation lacks. Without one it is the modern chart. The team builder passes none, so its output is unchanged.
- `utils/matchupAbilities.ts` is a small data table of the abilities that change incoming type damage (immunities, per-type scaling, Filter-style reductions of super-effective damage, and Wonder Guard). The detail chart folds in the first of the game's abilities that is in the table, regular slots before hidden.
- When the Pokémon has other possible abilities, each type the folded ability moved carries a "with <Ability>" tag. A tagged type that drops to 1× stays listed in a 1× row so the change shows.

## Consequences

**Positive:**
- No new endpoint, query or PokeAPI call: the chart is computed from the types and abilities that come with the detail response (ADR-002, ADR-007).
- The team builder and the detail page share the tier logic (`utils/typeDefense.ts`) and the tier rows (`DefenseTierList`).

**Negative:**
- The generation differences and the ability effects are hand-kept tables. A new game that changes a matchup or an ability's effect needs an edit and a test.
- Only one ability is folded in. A Pokémon with two different matchup abilities shows the first, tagged.
- Effects that don't depend on the attacking type (weather, Tera types, items, contact) are left out.

## Alternatives Considered

**Read `/type/{name}` from PokeAPI through the backend:** it has the generation history, but it would add a cached fetch and a payload field to replace a static chart the SPA already ships, and it still says nothing about abilities.

**A note beside a types-only chart:** keeps the chart simple, but the chart then lists a weakness the Pokémon may not have (Ground for a Levitate Gengar).
