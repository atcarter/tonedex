import { useEffect, useRef, type RefObject } from "react";
import { followPointer } from "./followPointer";
import type { Neighbor } from "./useNeighbors";

// A sideways swipe on touch screens; the surface needs `touch-action: pan-y
// pinch-zoom`, so vertical scrolling, pull-to-refresh and zoom stay native.

// The browser's back and forward swipes start at the screen edges
export const EDGE_GUARD = 32;
const SLOP = 10;
const AXIS_RATIO = 1.5;
const COMMIT_FRACTION = 0.3;
const COMMIT_MAX = 140;
const FLICK_DISTANCE = 40;
const FLICK_VELOCITY = 0.3; // px per ms
const VELOCITY_WINDOW_MS = 100;
const RUBBER_BAND = 0.25;
const SETTLE_MS = 160;

export type Axis = "pending" | "horizontal" | "vertical";

export function decideAxis(dx: number, dy: number): Axis {
  if (Math.hypot(dx, dy) < SLOP) return "pending";
  return Math.abs(dx) > Math.abs(dy) * AXIS_RATIO ? "horizontal" : "vertical";
}

export function decideSwipe(
  dx: number,
  velocity: number,
  width: number,
): Neighbor | null {
  const distance = Math.abs(dx);
  const far = distance >= Math.min(COMMIT_MAX, width * COMMIT_FRACTION);
  const flick =
    distance >= FLICK_DISTANCE &&
    Math.abs(velocity) >= FLICK_VELOCITY &&
    Math.sign(velocity) === Math.sign(dx);
  if (!far && !flick) return null;
  // Content follows the finger, so a drag left shows what comes after
  return dx < 0 ? "next" : "previous";
}

// A touch inside something that scrolls sideways belongs to it
export function startsInHorizontalScroller(target: Element, surface: Element) {
  for (
    let el: Element | null = target;
    el && el !== surface;
    el = el.parentElement
  ) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const { overflowX } = getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}

const IGNORED =
  "[data-swipe-ignore], input, textarea, select, [contenteditable]";

export const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

interface Options {
  enabled: boolean;
  canGo: (to: Neighbor) => boolean;
  onGo: (to: Neighbor) => void;
}

// surface comes from a callback ref: it mounts after the page's loading branch
export function useSwipeNavigation(
  surface: HTMLElement | null,
  content: RefObject<HTMLElement | null>,
  options: Options,
) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const el = surface;
    if (!el) return;
    let stop: (() => void) | null = null;

    const down = (e: PointerEvent) => {
      if (!latest.current.enabled) return;
      // A mouse drag selects text
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      if (e.clientX < EDGE_GUARD || e.clientX > window.innerWidth - EDGE_GUARD)
        return;
      // Zoomed in, a one-finger pan moves the zoomed page
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      const target = e.target as Element;
      if (target.closest(IGNORED)) return;
      if (startsInHorizontalScroller(target, el)) return;
      stop?.();

      const reduced = prefersReducedMotion();
      const s = {
        x0: e.clientX,
        y0: e.clientY,
        axis: "pending" as Axis,
        dx: 0,
        samples: [{ x: e.clientX, t: e.timeStamp }],
      };
      const place = (x: number, settle: boolean) => {
        const c = content.current;
        if (!c || reduced) return;
        c.style.transition = settle ? `transform ${SETTLE_MS}ms ease-out` : "";
        c.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
      };

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - s.x0;
        const dy = ev.clientY - s.y0;
        if (s.axis === "pending") {
          s.axis = decideAxis(dx, dy);
          if (s.axis === "vertical") return end(null);
          if (s.axis === "pending") return;
        }
        s.dx = dx;
        s.samples.push({ x: ev.clientX, t: ev.timeStamp });
        while (
          s.samples.length > 2 &&
          ev.timeStamp - s.samples[0].t > VELOCITY_WINDOW_MS
        )
          s.samples.shift();
        const to: Neighbor = dx < 0 ? "next" : "previous";
        // At an end the content lags the finger, then springs back
        place(latest.current.canGo(to) ? dx : dx * RUBBER_BAND, false);
      };
      const up = () => {
        const first = s.samples[0];
        const last = s.samples[s.samples.length - 1];
        const velocity =
          last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
        const to =
          s.axis === "horizontal"
            ? decideSwipe(s.dx, velocity, el.clientWidth)
            : null;
        end(to && latest.current.canGo(to) ? to : null);
      };
      // A second finger makes it a pinch
      const second = (ev: PointerEvent) =>
        ev.pointerId !== e.pointerId && end(null);

      const end = (to: Neighbor | null) => {
        unfollow();
        window.removeEventListener("pointerdown", second, true);
        if (stop === cancel) stop = null;
        // A committed move hands over to the page's enter animation
        if (s.axis === "horizontal") place(0, !to);
        if (to) latest.current.onGo(to);
      };
      // The browser took the gesture
      const cancel = () => end(null);
      const unfollow = followPointer(e.pointerId, { move, up, cancel });
      window.addEventListener("pointerdown", second, true);
      stop = cancel;
    };

    el.addEventListener("pointerdown", down);
    return () => {
      el.removeEventListener("pointerdown", down);
      stop?.();
    };
  }, [surface, content]);
}
