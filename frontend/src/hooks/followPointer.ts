interface Handlers {
  move: (e: PointerEvent) => void;
  up: (e: PointerEvent) => void;
  cancel: (e: PointerEvent) => void;
}

// Window listeners, so events still arrive while React moves what is under the pointer
export function followPointer(pointerId: number, on: Handlers) {
  const only = (handler: (e: PointerEvent) => void) => (e: PointerEvent) => {
    if (e.pointerId === pointerId) handler(e);
  };
  const move = only(on.move);
  const up = only(on.up);
  const cancel = only(on.cancel);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
  };
}
