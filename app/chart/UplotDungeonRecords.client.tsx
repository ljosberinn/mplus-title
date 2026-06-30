/**
 * The Dungeon Records chart renderer (uPlot — the only renderer). One line per
 * dungeon (highest key level over time) drawn over faded week backgrounds +
 * lightgreen week-number markers, with a custom icon legend and a cursor
 * tooltip.
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";

import { type EnhancedSeason } from "../seasons";
import { buildDungeonRecordsConfig } from "./dungeonRecordsData";
import { Legend } from "./Legend";

type UplotDungeonRecordsProps = {
  season: EnhancedSeason;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** The level of a (sparse) series at-or-before the cursor index — dungeon
 * records are a running maximum, so the meaningful value is the last point. */
function valueAtOrBefore(
  ys: ArrayLike<number | null | undefined>,
  idx: number,
): number | null {
  for (let i = idx; i >= 0; i -= 1) {
    const v = ys[i];
    if (v !== null && v !== undefined) {
      return v;
    }
  }
  return null;
}

/** The index of the last non-null point of a (sparse) series, or -1. */
function lastDefinedIndex(ys: ArrayLike<number | null | undefined>): number {
  for (let i = ys.length - 1; i >= 0; i -= 1) {
    const v = ys[i];
    if (v !== null && v !== undefined) {
      return i;
    }
  }
  return -1;
}

/**
 * Short tag for a dungeon name, used in the end-of-line label. Multi-word names
 * become an initialism ("Nexus-Point Xenas" → "NPX"); single-word names use
 * their first three letters ("Skyreach" → "SKY"). Apostrophes are stripped first
 * so a possessive stays one word ("Magister's Terrace" → "MT", not "MST"), then
 * splits on any non-alphanumeric run (spaces, hyphens, punctuation).
 */
function abbreviate(name: string): string {
  const words = name
    .replaceAll(/['’]/gu, "")
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean);

  if (words.length === 0) {
    return name.slice(0, 3).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words.map((word) => word[0].toUpperCase()).join("");
}

/**
 * Positions the cursor tooltip near (left, top) but keeps it inside the plot
 * overlay: flips to the other side of the cursor when it would overflow an edge,
 * then clamps so it never spills off-screen.
 */
function placeTooltip(
  u: uPlot,
  tt: HTMLDivElement,
  left: number,
  top: number,
): string {
  const pad = 12;
  const overW = u.over.clientWidth;
  const overH = u.over.clientHeight;
  const ttW = tt.offsetWidth;
  const ttH = tt.offsetHeight;

  let x = left + pad;
  if (x + ttW > overW) {
    x = left - pad - ttW;
  }
  x = Math.max(0, Math.min(x, Math.max(0, overW - ttW)));

  let y = top + pad;
  if (y + ttH > overH) {
    y = top - pad - ttH;
  }
  y = Math.max(0, Math.min(y, Math.max(0, overH - ttH)));

  return `translate(${x}px, ${y}px)`;
}

export default function UplotDungeonRecords({
  season,
}: UplotDungeonRecordsProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const config = useMemo(() => buildDungeonRecordsConfig(season), [season]);

  const [visibility, setVisibility] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(config.legend.map((item) => [item.seriesIdx, true])),
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setVisibility(
      Object.fromEntries(config.legend.map((item) => [item.seriesIdx, true])),
    );

    const dpr = uPlot.pxRatio;

    const drawWeekBands = (u: uPlot) => {
      const { ctx, bbox } = u;
      ctx.save();
      // confine to the plot area — custom hook drawing isn't clipped by uPlot.
      ctx.beginPath();
      ctx.rect(bbox.left, bbox.top, bbox.width, bbox.height);
      ctx.clip();
      ctx.globalAlpha = 0.25;
      config.weekBands.forEach((band, index) => {
        const x0 = u.valToPos(band.from, "x", true);
        const x1 = u.valToPos(band.to, "x", true);
        ctx.fillStyle = index % 2 === 0 ? "#4b5563" : "#1f2937";
        ctx.fillRect(x0, bbox.top, x1 - x0, bbox.height);
      });
      ctx.restore();
    };

    const drawWeekLines = (u: uPlot) => {
      const { ctx, bbox } = u;
      ctx.save();
      ctx.font = `${10 * dpr}px sans-serif`;
      ctx.textBaseline = "top";
      for (const line of config.weekLines) {
        const x = u.valToPos(line.value, "x", true);
        if (x < bbox.left || x > bbox.left + bbox.width || !line.label) {
          continue;
        }
        ctx.lineWidth = 3 * dpr;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line.label, x + 3 * dpr, bbox.top + 4 * dpr);
        ctx.fillStyle = line.labelColor;
        ctx.fillText(line.label, x + 3 * dpr, bbox.top + 4 * dpr);
      }
      ctx.restore();
    };

    // abbreviation per dungeon line, computed once per config.
    const endLabelAbbr = new Map<number, string>();
    for (const i of config.lineSeriesIdx) {
      const { label } = config.series[i];
      if (typeof label === "string") {
        endLabelAbbr.set(i, abbreviate(label));
      }
    }

    // Draws each visible dungeon line's final value at its last point as
    // "<abbr> +<level>" (e.g. "NPX +24"), nudged to the side that fits and
    // greedily de-overlapped vertically so clustered endpoints stay readable.
    const drawEndLabels = (u: uPlot) => {
      const { ctx, bbox, data, series } = u;
      const right = bbox.left + bbox.width;

      type EndLabel = { x: number; y: number; text: string; color: string };
      const labels: EndLabel[] = [];

      for (const i of config.lineSeriesIdx) {
        const line = series[i];
        if (!line.show) {
          continue;
        }

        const ys = data[i];
        const lastIdx = lastDefinedIndex(ys);
        if (lastIdx < 0) {
          continue;
        }

        const value = ys[lastIdx]!;
        const xPos = u.valToPos(data[0][lastIdx], "x", true);
        if (xPos < bbox.left || xPos > right) {
          continue;
        }

        const abbr = endLabelAbbr.get(i) ?? "";
        labels.push({
          x: xPos,
          y: u.valToPos(value, "y", true),
          text: abbr ? `${abbr} +${value}` : `+${value}`,
          color: typeof line.stroke === "string" ? line.stroke : "#fff",
        });
      }

      ctx.save();
      ctx.font = `${11 * dpr}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3 * dpr;
      ctx.lineJoin = "round";

      // greedy top-to-bottom declutter so overlapping endpoints don't stack.
      const lineH = 13 * dpr;
      labels.sort((a, b) => a.y - b.y);
      let lastY = -Infinity;
      for (const label of labels) {
        const y = Math.min(
          Math.max(label.y, bbox.top + lineH / 2),
          bbox.top + bbox.height - lineH / 2,
        );
        label.y = y - lastY < lineH ? lastY + lineH : y;
        lastY = label.y;
      }

      for (const label of labels) {
        const { width } = ctx.measureText(label.text);
        const fitsRight = label.x + 6 * dpr + width <= right - 2 * dpr;
        ctx.textAlign = fitsRight ? "left" : "right";
        const tx = fitsRight ? label.x + 6 * dpr : label.x - 6 * dpr;

        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(label.text, tx, label.y);
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, tx, label.y);
      }

      ctx.restore();
    };

    const updateTooltip = (u: uPlot) => {
      const tt = tooltipRef.current;
      if (!tt) {
        return;
      }
      const { idx } = u.cursor;
      const { left } = u.cursor;
      if (
        idx === null ||
        idx === undefined ||
        left === null ||
        left === undefined ||
        left < 0
      ) {
        tt.style.display = "none";
        return;
      }

      const xs = u.data[0];
      const rows: string[] = [
        `<div style="opacity:.7;margin-bottom:2px">${dateFormatter.format(
          xs[idx] * 1000,
        )}</div>`,
      ];
      for (const i of config.lineSeriesIdx) {
        const series = u.series[i];
        if (!series.show || typeof series.label !== "string") {
          continue;
        }
        const value = valueAtOrBefore(u.data[i], idx);
        if (value === null) {
          continue;
        }
        const stroke =
          typeof series.stroke === "string" ? series.stroke : "#fff";
        rows.push(
          `<div style="color:${stroke}">${series.label}: <b>+${value}</b></div>`,
        );
      }

      if (rows.length <= 1) {
        tt.style.display = "none";
        return;
      }

      tt.innerHTML = rows.join("");
      tt.style.display = "block";
      const top = u.cursor.top ?? 0;
      tt.style.transform = placeTooltip(u, tt, left, top);
    };

    // width emphasis on focus (uPlot focus-cursor demo): the hovered dungeon
    // line bolds and the rest thin, on top of the `focus.alpha` dim. uPlot's
    // alpha redraw runs before this hook, so widths are mutated and repainted.
    const baseWidths = config.series.map((s) =>
      typeof s.width === "number" ? s.width : 1,
    );
    let lastFocus: number | null = -1;
    const applyFocusWidths = (
      u: uPlot,
      seriesIdx: number | null,
      opts: uPlot.Series,
    ) => {
      if (!(opts as { focus?: boolean }).focus || seriesIdx === lastFocus) {
        return;
      }
      lastFocus = seriesIdx;
      u.series.forEach((s, i) => {
        const base = baseWidths[i];
        if (i === 0 || base === 0) {
          return;
        }
        s.width = seriesIdx === null ? base : i === seriesIdx ? base + 1 : 1;
      });
      u.redraw();
    };

    const yZoom = config.initialYZoom;

    const opts: uPlot.Options = {
      // floor to whole pixels: uPlot's root is `width: min-content`, so a
      // fractional width rounds up and spills ~1px past the container.
      width: Math.floor(container.clientWidth) || 600,
      height: Math.floor(container.clientHeight) || 240,
      series: config.series,
      legend: { show: false },
      focus: { alpha: 0.3 },
      cursor: {
        drag: { x: false, y: false },
        focus: { prox: 30 },
        points: { size: 6 },
      },
      scales: {
        x: { time: true },
        // when the completed-level span is wide, hard-pin the y view to the top
        // key levels (a static range function, so it survives redraws instead of
        // being re-auto-ranged like a post-init setScale was).
        y: yZoom ? { range: (): [number, number] => [yZoom[0], yZoom[1]] } : {},
      },
      axes: [
        {
          stroke: "#fff",
          grid: { stroke: "rgba(255,255,255,0.04)", width: 1 },
          ticks: { stroke: "rgba(255,255,255,0.1)" },
        },
        {
          stroke: "#fff",
          grid: { stroke: "rgba(255,255,255,0.05)", width: 1 },
          ticks: { stroke: "rgba(255,255,255,0.1)" },
          values: (_u, splits) => splits.map((v) => `+${Math.round(v)}`),
        },
      ],
      hooks: {
        init: [
          (u) => {
            const tt = document.createElement("div");
            tt.style.cssText =
              "position:absolute;z-index:10;pointer-events:none;display:none;" +
              "padding:4px 8px;font-size:12px;background:rgba(17,24,39,.95);" +
              "border:1px solid #374151;border-radius:4px;white-space:nowrap;" +
              "color:#fff;top:0;left:0";
            u.over.append(tt);
            tooltipRef.current = tt;
          },
        ],
        drawClear: [drawWeekBands],
        draw: [drawWeekLines, drawEndLabels],
        setCursor: [updateTooltip],
        setSeries: [applyFocusWidths],
      },
    };

    // eslint-disable-next-line new-cap -- uPlot is the library's exported class
    const plot = new uPlot(opts, config.data, container);
    plotRef.current = plot;

    // cap the right edge at `softMax` (now / season end), matching Highcharts.
    // When zoomed into the top key levels, leave ~5% spare on the right so the
    // end-of-line "+level" labels have room instead of being jammed at the edge.
    if (config.softMax !== null && config.data[0].length > 0) {
      const xs = config.data[0];
      const min = xs[0];
      const pad =
        config.initialYZoom === null ? 0 : (config.softMax - min) * 0.05;
      plot.setScale("x", { min, max: config.softMax + pad });
    }

    return () => {
      plot.destroy();
      plotRef.current = null;
      tooltipRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const plot = plotRef.current;
      if (plot && container.clientWidth > 0) {
        plot.setSize({
          width: Math.floor(container.clientWidth),
          height: Math.floor(container.clientHeight),
        });
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const toggle = (seriesIdx: number) => {
    const plot = plotRef.current;
    if (!plot) {
      return;
    }
    const next = !(visibility[seriesIdx] ?? true);
    plot.setSeries(seriesIdx, { show: next });
    setVisibility((prev) => ({ ...prev, [seriesIdx]: next }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <Legend items={config.legend} visibility={visibility} onToggle={toggle} />
    </div>
  );
}
