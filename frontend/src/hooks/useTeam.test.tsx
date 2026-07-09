import { renderHook, act } from "@testing-library/react";
import { useTeam, MAX_TEAM_SIZE } from "./useTeam";
import type { Pokemon } from "../types";

function mon(id: number, name = `mon-${id}`): Pokemon {
  return { id, name, types: ["normal"], sprite_url: "" };
}

describe("useTeam", () => {
  // Bare `localStorage` resolves to Node's stub under vitest — use window's
  beforeEach(() => {
    window.localStorage.removeItem("pokedex_team_1");
    window.localStorage.removeItem("pokedex_team_2");
  });

  it("adds members, dedupes, and caps at six", () => {
    const { result } = renderHook(() => useTeam(1));

    act(() => result.current.addMember(mon(1)));
    act(() => result.current.addMember(mon(1))); // duplicate ignored
    expect(result.current.team).toHaveLength(1);

    // One act per add — addMember reads the committed team state
    for (let i = 2; i <= 8; i++) {
      act(() => result.current.addMember(mon(i)));
    }
    expect(result.current.team).toHaveLength(MAX_TEAM_SIZE);
    expect(result.current.isFull).toBe(true);
  });

  it("removes members and clears the team", () => {
    const { result } = renderHook(() => useTeam(1));

    act(() => {
      result.current.addMember(mon(1));
      result.current.addMember(mon(2));
    });
    act(() => result.current.removeMember(1));
    expect(result.current.team.map((m) => m.id)).toEqual([2]);

    act(() => result.current.clearTeam());
    expect(result.current.team).toEqual([]);
  });

  it("persists to localStorage and rehydrates", () => {
    const { result, unmount } = renderHook(() => useTeam(1));
    act(() => result.current.addMember(mon(7, "pikachu")));
    unmount();

    const { result: fresh } = renderHook(() => useTeam(1));
    expect(fresh.current.team.map((m) => m.name)).toEqual(["pikachu"]);
  });

  it("keeps teams separate per game and reloads when gameId changes", () => {
    const first = renderHook(() => useTeam(1));
    act(() => first.result.current.addMember(mon(1, "team-one")));
    first.unmount();

    const { result, rerender } = renderHook(
      ({ gameId }: { gameId: number }) => useTeam(gameId),
      { initialProps: { gameId: 2 } },
    );
    expect(result.current.team).toEqual([]);

    act(() => result.current.addMember(mon(2, "team-two")));

    rerender({ gameId: 1 });
    expect(result.current.team.map((m) => m.name)).toEqual(["team-one"]);

    rerender({ gameId: 2 });
    expect(result.current.team.map((m) => m.name)).toEqual(["team-two"]);
  });

  it("stores only the slim member shape", () => {
    const { result } = renderHook(() => useTeam(1));
    act(() =>
      result.current.addMember({
        ...mon(1),
        pokedex_number: 25,
        favorite_id: 99, // extra fields must not be persisted
      }),
    );

    const stored = JSON.parse(window.localStorage.getItem("pokedex_team_1")!);
    expect(Object.keys(stored[0]).sort()).toEqual([
      "id",
      "name",
      "pokedex_number",
      "sprite_url",
      "types",
    ]);
  });
});
