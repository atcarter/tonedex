import { useEffect, useRef, useState } from "react";

// Drag-to-reorder with Pointer Events: one path for mouse, touch and pen.
// A mouse drags from anywhere on an item; touch and pen drag only from a
// handle (HANDLE_ATTR), which needs `touch-action: none` so other swipes scroll.

const INDEX_ATTR = "data-reorder-index";
const HANDLE_ATTR = "data-reorder-handle";
const THRESHOLD = 4; // px a press moves before it becomes a drag
const EDGE = 64; // px from the viewport edge where a drag auto-scrolls
const MAX_SCROLL = 16; // px per frame at the edge

export function moveItem<T>(list: readonly T[], from: number, to: number) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// A drag ending over a card would otherwise click it and open its detail page
function suppressNextClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, true), 0);
}

export function usePointerReorder<T>(
  items: T[],
  onMove: (next: T[]) => void,
  onDrop: (next: T[]) => void,
) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const endSession = useRef<((commit: boolean) => void) | null>(null);
  const callbacks = useRef({ onMove, onDrop });
  useEffect(() => {
    callbacks.current = { onMove, onDrop };
  });
  useEffect(() => () => endSession.current?.(false), []);

  const start = (e: React.PointerEvent<HTMLElement>, index: number) => {
    const target = e.target as Element;
    if (target.closest("button, a, input")) return;
    const onHandle = target.closest(`[${HANDLE_ATTR}]`) !== null;
    if (e.pointerType === "mouse" ? e.button !== 0 : !onHandle) return;
    endSession.current?.(false);

    const list = e.currentTarget.parentElement;
    const s = {
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      index,
      order: items,
      frame: 0,
    };

    // Move the dragged item to whichever sibling is under the pointer
    const retarget = () => {
      const hit = document
        .elementFromPoint(s.x, s.y)
        ?.closest(`[${INDEX_ATTR}]`);
      if (!hit || hit.parentElement !== list) return;
      const to = Number(hit.getAttribute(INDEX_ATTR));
      if (to === s.index) return;
      s.order = moveItem(s.order, s.index, to);
      s.index = to;
      setDragIndex(to);
      callbacks.current.onMove(s.order);
    };

    const autoScroll = () => {
      const bottom = window.innerHeight - EDGE;
      const depth = s.y < EDGE ? s.y - EDGE : s.y > bottom ? s.y - bottom : 0;
      if (depth) {
        const speed = Math.max(-1, Math.min(1, depth / EDGE)) * MAX_SCROLL;
        window.scrollBy(0, Math.round(speed));
        retarget();
      }
      s.frame = requestAnimationFrame(autoScroll);
    };

    const ours = (ev: PointerEvent) => ev.pointerId === e.pointerId;
    const move = (ev: PointerEvent) => {
      if (!ours(ev)) return;
      // A mouse released where pointerup never reached us (menu, focus loss)
      if (ev.pointerType === "mouse" && ev.buttons === 0) return end(false);
      s.x = ev.clientX;
      s.y = ev.clientY;
      if (!s.active) {
        if (Math.hypot(s.x - s.startX, s.y - s.startY) < THRESHOLD) return;
        s.active = true;
        setDragIndex(s.index);
        s.frame = requestAnimationFrame(autoScroll);
      }
      retarget();
    };
    const up = (ev: PointerEvent) => ours(ev) && end(true);
    const cancel = (ev: PointerEvent) => ours(ev) && end(false);
    const abort = () => end(false);
    const menu = () => e.pointerType === "mouse" && end(false);

    // Window listeners, so events still arrive while React moves the item
    const end = (commit: boolean) => {
      cancelAnimationFrame(s.frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", abort);
      window.removeEventListener("contextmenu", menu);
      if (endSession.current === end) endSession.current = null;
      if (!s.active) return;
      setDragIndex(null);
      if (commit) {
        const moved = s.order.some((item, i) => item !== items[i]);
        if (moved) callbacks.current.onDrop(s.order);
        suppressNextClick();
      } else {
        callbacks.current.onMove(items);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", abort);
    window.addEventListener("contextmenu", menu);
    endSession.current = end;
  };

  const itemProps = (index: number) => ({
    "data-reorder-index": index,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => start(e, index),
    // Stop native image and text drags from stealing the pointer
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  });

  return { dragIndex, itemProps };
}
