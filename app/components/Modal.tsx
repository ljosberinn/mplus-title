/**
 * Minimal accessible modal built on the native `<dialog>` element (focus trap
 * and inert background come for free). Driven by the `open` prop via
 * `showModal()`/`close()`; closes on Escape (the dialog `cancel` event), a
 * backdrop pointerdown (shared `useDismiss` against the inner panel) or the ×
 * button. Square-bordered to match the rest of the UI.
 */
import { type ReactNode, useEffect, useRef } from "react";

import { useDismiss } from "./useDismiss";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  children,
}: ModalProps): ReactNode {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // a pointerdown outside the inner panel (i.e. on the ::backdrop, whose event
  // target is the dialog element) dismisses — same hook the season menu uses.
  useDismiss(open, panelRef, onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => {
        // Escape: stop the dialog closing itself so React stays the source of
        // truth (the effect closes it once `open` flips).
        event.preventDefault();
        onClose();
      }}
      className="fixed left-1/2 top-1/2 max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-gray-600 bg-gray-800 p-0 text-stone-100 shadow-xl backdrop:bg-black/60"
    >
      <div ref={panelRef}>
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border border-gray-600 px-2 leading-none text-stone-300 hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </dialog>
  );
}
