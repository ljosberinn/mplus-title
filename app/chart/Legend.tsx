/** Chart legend. Interactive (clickable series toggles) when `onToggle` is
 * provided — used by the dungeon-records chart for per-dungeon toggling. Without
 * it, a display-only colour key: the score chart's series visibility now lives in
 * the global Features menu, so its legend just labels what's currently shown. */
import { type ReactNode } from "react";

import { type LegendItem } from "./uplotData";

type LegendProps = {
  items: LegendItem[];
  visibility?: Record<number, boolean>;
  onToggle?: (seriesIdx: number) => void;
};

export function Legend({
  items,
  visibility,
  onToggle,
}: LegendProps): ReactNode {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 py-1 text-sm">
      {items.map((item) => {
        const visible = visibility?.[item.seriesIdx] ?? item.defaultVisible;

        const swatch = (
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 border border-gray-500"
            style={{
              backgroundColor: item.color,
              opacity: visible ? 1 : 0.3,
            }}
          />
        );
        const icon = item.iconUrl ? (
          <img
            aria-hidden
            src={item.iconUrl}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
            style={{ opacity: visible ? 1 : 0.3 }}
          />
        ) : null;
        const label = (
          <span
            className={
              visible ? "text-stone-100" : "text-stone-500 line-through"
            }
          >
            {item.label}
          </span>
        );

        return (
          <li key={item.seriesIdx}>
            {onToggle ? (
              <button
                type="button"
                onClick={() => {
                  onToggle(item.seriesIdx);
                }}
                className="flex items-center gap-1.5"
                aria-pressed={visible}
              >
                {swatch}
                {icon}
                {label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                {swatch}
                {icon}
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
