# ADR-012 — Previous and Next on the Detail Page

**Date:** 2026-11-19
**Status:** Accepted

## Context

Moving from one Pokémon to the next meant going Back to the list and opening the next card. The detail page should move to the Pokémon before or after it directly.

"Next" has to mean the next card in the list the user came from: the game's regional or national view, named by `?dex=` (ADR-005, ADR-009). The SPA can't work that out on its own. The list loads 40 rows a page, and page one's whole-view `pokemon_ids` and `dex_numbers` carry no names, so a deep link, a refresh or the last card of a page has no neighbor to link to.

## Decision

**The API supplies the neighbors.** `GET /api/v1/pokemon/:id?game_id=&dex=` returns `neighbors: {previous, next}` in the list row shape. `DexView` is the one definition of a view's members and order, read by both the list endpoint and this lookup, with `pokeapi_id` breaking a tied number. The lookup reads the database only (ADR-002).

**One move behind every input.** `go()` in `PokemonPager` is the only navigation; the buttons, the arrow keys and the swipe call it.

- It replaces the history entry, so Back returns to the list in one step however many Pokémon were passed. Evolution links stay ordinary pushes.
- It sets `state.neighbor` to the direction. `App.tsx`, which scrolls a new page to the top and moves focus to `<main>`, leaves focus where it is for such a move, so a keyboard user can press Next again.
- The controls are two `<button>`s marked `aria-disabled` at an end rather than `disabled`, and they stay mounted while the next Pokémon loads, so the pressed button keeps focus. A hidden live region names the Pokémon moved to.
- The arrow keys ignore auto-repeat, modifier keys (Alt+Left is the browser's Back) and targets that use arrows themselves (fields, menus, listboxes, sliders, tabs, dialogs).

**A sideways swipe on touch screens.** The page follows the finger, then the new Pokémon slides in from that side. `useSwipeNavigation` uses Pointer Events, with window listeners through `followPointer` (shared with the favorites drag), and declares which pans are its own with `touch-action` on the gesture element, as the favorites drag handle does:

- The surface is `touch-action: pan-y pinch-zoom`, so vertical scrolling, pull-to-refresh and zoom stay the browser's: the browser cancels the pointer the moment it scrolls, and the swipe stops. Nothing new is set on `html` or `body`.
- A browser lets the nearest scroll container claim a pan, whether or not it overflows. Nothing inside the surface may be `overflow-x: auto` or `scroll` unless it should scroll instead of the page swiping (then mark it `data-swipe-ignore`); `MoveList` is `overflow-x: clip` for that reason. `e2e/pokemon-pager.spec.ts` checks it.
- Touches starting within 32px of a screen edge are left to the system Back and Forward swipes. A mouse doesn't swipe (it selects text), nor does a second finger, a zoomed page, or a drag within 1.5× of vertical.
- A move commits past 30% of the width (at most 140px) or on a flick of 40px at 0.3 px/ms. At an end the content moves a quarter of the finger's travel and springs back.
- The drag sets `transform` on a wrapper through a ref, with no React state per move. The enter animation is Web Animations on the same wrapper, so `PokemonDetail` isn't remounted and keeps its state, as with evolution links. With `prefers-reduced-motion: reduce` there is no transform and no animation; the swipe still commits.

**Neighbors are prefetched.** 250ms after a page settles, both neighbors' details are prefetched with `pokemonQueryOptions`, the key the page itself reads, and their sprites warmed, so a move renders from cache. Encounters are not prefetched: a miss can enqueue a warm-up job for a page nobody opened.

**Favorites and Compare move through their own list.** A detail page opened from Favorites steps through the favorites list in its saved order; one opened from Compare swaps between the two compared Pokémon. It is the same `go()` with a different neighbor source: the opening link puts `state.origin` (`{from: "favorites"}` or `{from: "compare", pair}`) in history state, every move carries it, and `useNeighbors` derives the neighbors from that list (the `useFavorites` cache, or the pair) instead of the API's. Moves stay on `/pokemon/<name>`. History state survives a reload but not a copied link, which then opens without previous/next, like a search hit. An evolution link pushes without the origin, so it leaves the list.

**Scope:** without an origin, controls show only on a game route whose response names a neighbor, so a search hit the game doesn't have and alternate forms have none. There is no wrap-around from the last Pokémon to the first. A type filter on the list is component state, not in the URL, so "next" follows the whole view. A response without `neighbors` (an API older than the SPA) shows no controls.

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

**One long vertical page, scrolling into the next Pokémon:** the next one would sit below 40 to 100 move rows, and the URL, Back, the caught toggle and the header would each need a rule for which Pokémon is current.

**A native `scroll-snap` pager holding previous, current and next:** each pane would need its own vertical scroller, which breaks the hide-on-scroll header and pull-to-refresh, or all three would share the tallest height. It also mounts three detail trees.

**React Router view transitions:** `BrowserRouter` passes `navigate` options straight to `history.replace`, which ignores `viewTransition`, and wraps the update in `startTransition`, so the new page can't be rendered synchronously for the animation either.

**Trackpad or wheel scrolling sideways:** on macOS that gesture is the browser's Back and Forward.

**The Favorites or Compare list in the URL (`?from=favorites`, the pair as a parameter):** a shared link would name a list that belongs to someone else's account or session. The URL keeps naming only the Pokémon (ADR-005), and the origin is navigation context.

**Fall back to national-number order outside a dex view:** gives a search hit or an alternate form a "next" no list on screen shows.
