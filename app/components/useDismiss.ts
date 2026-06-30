import { type RefObject, useEffect } from "react";

/**
 * Closes a popover/modal on outside pointerdown or Escape while it's open.
 * Extracted from the SeasonMenu so the season dropdown and the Features modal
 * share one implementation. `ref` wraps the interactive surface; a pointerdown
 * outside it dismisses (for a modal whose `ref` is the panel, the surrounding
 * backdrop counts as "outside").
 */
export function useDismiss(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, onDismiss]);
}
