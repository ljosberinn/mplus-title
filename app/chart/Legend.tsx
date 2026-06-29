/** Custom React legend driving uPlot series visibility (replaces Highcharts'
 * built-in legend). Grouped toggles will follow once parity is verified. */
import { type ReactNode } from "react";

import { type LegendItem } from "./uplotData";

type LegendProps = {
  items: LegendItem[];
  visibility: Record<number, boolean>;
  onToggle: (seriesIdx: number) => void;
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
        const visible = visibility[item.seriesIdx] ?? item.defaultVisible;

        return (
          <li key={item.seriesIdx}>
            <button
              type="button"
              onClick={() => {
                onToggle(item.seriesIdx);
              }}
              className="flex items-center gap-1.5"
              aria-pressed={visible}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: item.color,
                  opacity: visible ? 1 : 0.3,
                }}
              />
              {item.iconUrl ? (
                <img
                  aria-hidden
                  src={item.iconUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5"
                  style={{ opacity: visible ? 1 : 0.3 }}
                />
              ) : null}
              <span
                className={
                  visible ? "text-stone-100" : "text-stone-500 line-through"
                }
              >
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
