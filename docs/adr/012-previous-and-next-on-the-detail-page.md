# ADR-012 — Previous and Next on the Detail Page

**Date:** 2026-11-19
**Status:** Accepted

## Context

Moving from one Pokémon to the next meant going Back to the list and opening the next card. The detail page should move to the Pokémon before or after it directly.

"Next" has to mean the next card in the list the user came from: the game's regional or national view, named by `?dex=` (ADR-005, ADR-009). The SPA can't work that out on its own. The list loads 40 rows a page, and page one's whole-view `pokemon_ids` and `dex_numbers` carry no names, so a deep link, a refresh or the last card of a page has no neighbor to link to.

## Decision

**The API supplies the neighbors.** `GET /api/v1/pokemon/:id?game_id=&dex=` returns `neighbors: {previous, next}` in the list row shape. `DexView` is the one definition of a view's members and order, read by both the list endpoint and this lookup, with `pokeapi_id` breaking a tied number. The lookup reads the database only (ADR-002).

**One move behind every input.** `go()` in `PokemonPager` is the only navigation; the buttons and the arrow keys call it.

- It replaces the history entry, so Back returns to the list in one step however many Pokémon were passed. Evolution links stay ordinary pushes.
- It sets `state.neighbor` to the direction. `App.tsx`, which scrolls a new page to the top and moves focus to `<main>`, leaves focus where it is for such a move, so a keyboard user can press Next again.
- The controls are two `<button>`s marked `aria-disabled` at an end rather than `disabled`, and they stay mounted while the next Pokémon loads, so the pressed button keeps focus. A hidden live region names the Pokémon moved to.
- The arrow keys ignore auto-repeat, modifier keys (Alt+Left is the browser's Back) and targets that use arrows themselves (fields, menus, listboxes, sliders, tabs, dialogs).

**Neighbors are prefetched.** 250ms after a page settles, both neighbors' details are prefetched with `pokemonQueryOptions`, the key the page itself reads, and their sprites warmed, so a move renders from cache. Encounters are not prefetched: a miss can enqueue a warm-up job for a page nobody opened.

**Scope:** controls show only on a game route whose response names a neighbor. There is no wrap-around from the last Pokémon to the first. A type filter on the list is component state, not in the URL, so "next" follows the whole view. A response without `neighbors` (an API older than the SPA) shows no controls.

## Consequences

**Positive:**
- Deep links, refreshes and page boundaries all have neighbors, with no list loaded.
- The list and the neighbor lookup can't disagree about order: both read `DexView`.
- A move costs at most one lookahead request, and none when the neighbor was prefetched.

**Negative:**
- A detail request runs up to three more small queries.
- Each newly viewed Pokémon still costs a detail and an encounters request against the 300-per-5-minutes limit; prefetching adds one lookahead. Ignoring auto-repeat keeps a held key from reaching it.
- A replaced entry means Forward can't step back through the Pokémon passed.

## Alternatives Considered

**Derive neighbors in the SPA from the list:** needs every page loaded and names the whole-view arrays don't carry, and fails on a deep link.

**Push each move:** thirty moves would cost thirty Backs to reach the list.

**Router links for the controls:** a link that unmounts while the next page loads drops focus on the first press.
