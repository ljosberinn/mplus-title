/**
 * The score chart renderer (uPlot — the only renderer; Highcharts was dropped).
 * Consumes the assembled `EnhancedSeason.score` for a region through
 * `buildUplotConfig` and draws the annotations (alternating affix-week
 * backgrounds, patch/hotfix/week plot lines, confirmed-cutoff lines) via canvas
 * hooks, plus a custom React legend and a cursor tooltip.
 *
 * Zoom: mouse box-select (uPlot `cursor.drag`) + touch pan/pinch (bound manually
 * in the `init` hook, since uPlot's cursor is mouse-only) + double-click to reset.
 * All route through the shared `onZoom` so every region zooms/resets together,
 * matching the "Reset zoom" button.
 *
 * Known gaps: affix icons in the week backgrounds (never ported from the old
 * Highcharts renderer).
 */
import { type Regions } from "prisma/generated/prisma/enums";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";

import { type EnhancedSeason } from "../seasons";
import { Legend } from "./Legend";
import { buildUplotConfig } from "./uplotData";

type ZoomExtremes = { min: number; max: number } | null;

type UplotChartProps = {
  season: EnhancedSeason;
  region: Regions;
  extremes: ZoomExtremes;
  onZoom: (extremes: ZoomExtremes) => void;
};

const numberFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const FUTURE_ALPHA = 0.31;

// daily-reset gains only render once the visible x-range is ~2 weeks or less,
// so they don't clutter the zoomed-out view.
const DAILY_GAINS_MAX_SPAN_SEC = 21 * 24 * 60 * 60;

const oneDecimal = (v: number): string =>
  numberFormatter.format(Math.round(v * 10) / 10);

/**
 * Linearly interpolates a (sparse) series' value at the cursor index, using the
 * nearest non-null points bracketing it. Returns null when the cursor is
 * outside the series' own range, so a line only contributes to the tooltip
 * where it actually exists (e.g. extrapolation only in the future).
 */
function interpolateAt(
  xs: ArrayLike<number>,
  ys: ArrayLike<number | null | undefined>,
  idx: number,
): number | null {
  let lo = -1;
  let hi = -1;
  for (let i = idx; i >= 0; i -= 1) {
    if (ys[i] !== null && ys[i] !== undefined) {
      lo = i;
      break;
    }
  }
  for (let i = idx; i < ys.length; i += 1) {
    if (ys[i] !== null && ys[i] !== undefined) {
      hi = i;
      break;
    }
  }
  if (lo < 0 || hi < 0) {
    return null;
  }
  const y0 = ys[lo] as number;
  if (lo === hi) {
    return y0;
  }
  const y1 = ys[hi] as number;
  const x0 = xs[lo];
  const x1 = xs[hi];
  if (x1 === x0) {
    return y0;
  }
  return y0 + ((y1 - y0) * (xs[idx] - x0)) / (x1 - x0);
}

/**
 * Linearly interpolates a confidence band's low/high bounds at timestamp `x`
 * (seconds). Returns null when the cursor is outside the band's range, so the
 * bounds only show in the tooltip where the band actually exists.
 */
function interpolateBandAt(
  points: [number, number, number][],
  x: number,
): { low: number; high: number } | null {
  if (
    points.length === 0 ||
    x < points[0][0] ||
    x > points[points.length - 1][0]
  ) {
    return null;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const [t0, lo0, hi0] = points[i];
    const [t1, lo1, hi1] = points[i + 1];
    if (x >= t0 && x <= t1) {
      const f = t1 === t0 ? 0 : (x - t0) / (t1 - t0);
      return { low: lo0 + (lo1 - lo0) * f, high: hi0 + (hi1 - hi0) * f };
    }
  }
  const [, low, high] = points[points.length - 1];
  return { low, high };
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) {
    return hex;
  }
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Positions the cursor tooltip near (left, top) but keeps it inside the plot
 * overlay: flips to the other side of the cursor when it would overflow the
 * right/bottom edge, then clamps so it never spills off-screen.
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

export default function UplotChart({
  season,
  region,
  extremes,
  onZoom,
}: UplotChartProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mythicLinksRef = useRef<{ el: HTMLAnchorElement; center: number }[]>(
    [],
  );
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const config = useMemo(
    () => buildUplotConfig(season, region),
    [season, region],
  );

  // (re)create the plot whenever the underlying config changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const dpr = uPlot.pxRatio;

    const drawWeekBands = (u: uPlot) => {
      const { ctx, bbox } = u;
      ctx.save();
      // custom hook drawing isn't clipped to the plot area by uPlot, so confine
      // it to the bbox — bands extend into the future, past the visible x-range.
      ctx.beginPath();
      ctx.rect(bbox.left, bbox.top, bbox.width, bbox.height);
      ctx.clip();
      for (const band of config.weekBands) {
        const x0 = u.valToPos(band.from, "x", true);
        const x1 = u.valToPos(band.to, "x", true);
        ctx.fillStyle = band.future
          ? withAlpha(band.color, FUTURE_ALPHA)
          : band.color;
        ctx.fillRect(x0, bbox.top, x1 - x0, bbox.height);
      }
      ctx.restore();
    };

    // draws text with a dark halo so labels stay readable over data + bands.
    const haloText = (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      color: string,
    ) => {
      ctx.setLineDash([]);
      ctx.lineJoin = "round";
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    const drawLines = (u: uPlot) => {
      const { ctx, bbox } = u;
      ctx.save();
      ctx.lineWidth = dpr;
      ctx.font = `${10 * dpr}px sans-serif`;
      ctx.textBaseline = "top";

      for (const line of config.verticalLines) {
        const x = u.valToPos(line.value, "x", true);
        if (x < bbox.left || x > bbox.left + bbox.width) {
          continue;
        }
        // week markers use a transparent line + a coloured label only.
        if (line.color !== "transparent") {
          ctx.strokeStyle = line.color;
          ctx.lineWidth = dpr;
          ctx.setLineDash([4 * dpr, 4 * dpr]);
          ctx.beginPath();
          ctx.moveTo(x, bbox.top);
          ctx.lineTo(x, bbox.top + bbox.height);
          ctx.stroke();
        }
        if (line.label) {
          const labelY =
            bbox.top + Math.min(line.labelY, bbox.height - 14) * dpr;
          if (line.color === "transparent") {
            // week markers (W{n} + weekly starting score): centre on the line,
            // i.e. the boundary where the background bands swap.
            ctx.textAlign = "center";
            haloText(ctx, line.label, x, labelY, line.labelColor);
          } else if (
            x + 3 * dpr + ctx.measureText(line.label).width >
            bbox.left + bbox.width
          ) {
            // near the right edge (e.g. "Season End"): flip the label left so
            // it stays on-screen instead of spilling past the axis.
            ctx.textAlign = "right";
            haloText(ctx, line.label, x - 3 * dpr, labelY, line.labelColor);
          } else {
            // patch/hotfix markers: keep beside their dashed line.
            ctx.textAlign = "start";
            haloText(ctx, line.label, x + 3 * dpr, labelY, line.labelColor);
          }
        }
      }

      ctx.textAlign = "start";
      for (const line of config.horizontalLines) {
        const y = u.valToPos(line.value, "y", true);
        if (y < bbox.top || y > bbox.top + bbox.height) {
          continue;
        }
        ctx.strokeStyle = line.color;
        ctx.lineWidth = dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(bbox.left, y);
        ctx.lineTo(bbox.left + bbox.width, y);
        ctx.stroke();
        if (line.label) {
          haloText(
            ctx,
            line.label,
            bbox.left + 4 * dpr,
            y - 12 * dpr,
            line.color,
          );
        }
      }
      ctx.restore();
    };

    const drawConfidenceBands = (u: uPlot) => {
      const { ctx, bbox, series } = u;
      ctx.save();
      // clip to the plot area: the band runs into the future and its upper edge
      // can exceed the y-range, so an unclipped fill spills over axes/margins.
      ctx.beginPath();
      ctx.rect(bbox.left, bbox.top, bbox.width, bbox.height);
      ctx.clip();
      ctx.globalAlpha = 0.18;
      for (const band of config.confidenceBands) {
        if (band.points.length === 0) {
          continue;
        }
        // a band is slaved to its extrapolation line — hide it when that line
        // is toggled off via the legend.
        if (
          band.linkedSeriesIdx !== null &&
          !series[band.linkedSeriesIdx]?.show
        ) {
          continue;
        }
        ctx.beginPath();
        band.points.forEach(([ts, , high], i) => {
          const x = u.valToPos(ts, "x", true);
          const y = u.valToPos(high, "y", true);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        for (let i = band.points.length - 1; i >= 0; i -= 1) {
          const [ts, low] = band.points[i];
          ctx.lineTo(u.valToPos(ts, "x", true), u.valToPos(low, "y", true));
        }
        ctx.closePath();
        ctx.fillStyle = band.color;
        ctx.fill();
      }
      ctx.restore();
    };

    const drawValueLabels = (u: uPlot) => {
      const { ctx, data, bbox } = u;
      ctx.save();
      ctx.font = `${11 * dpr}px sans-serif`;
      ctx.textAlign = "start";
      ctx.textBaseline = "middle";
      for (const idx of config.lineSeriesIdx) {
        const series = u.series[idx];
        if (!series.show) {
          continue;
        }
        const ys = data[idx];
        let value: number | null = null;
        let li = -1;
        for (let i = ys.length - 1; i >= 0; i -= 1) {
          const v = ys[i];
          if (v !== null && v !== undefined) {
            value = v;
            li = i;
            break;
          }
        }
        if (value === null || li < 0) {
          continue;
        }
        const x = u.valToPos(data[0][li], "x", true);
        const y = u.valToPos(value, "y", true);
        if (
          x < bbox.left ||
          x > bbox.left + bbox.width ||
          y < bbox.top ||
          y > bbox.top + bbox.height
        ) {
          continue;
        }
        // nudge the primary cutoff labels (0.1% / 1%) up so they clear the line.
        const labelY = config.primaryLineSeriesIdx.includes(idx)
          ? y - 9 * dpr
          : y;
        ctx.fillStyle = config.colorBySeriesIdx[idx] ?? "#fff";
        const text = numberFormatter.format(value);
        // flip the label left when the final point sits at the right edge
        // (e.g. an ended season, where the line ends at "Season End"), and lift
        // it a bit more so it clears the endpoint/line it now sits beside.
        if (
          x + 4 * dpr + ctx.measureText(text).width >
          bbox.left + bbox.width
        ) {
          ctx.textAlign = "right";
          ctx.fillText(text, x - 4 * dpr, labelY - 8 * dpr);
          ctx.textAlign = "start";
        } else {
          ctx.fillText(text, x + 4 * dpr, labelY);
        }
      }
      ctx.restore();
    };

    // when zoomed in, annotate each line with its per-day
    // gain (delta vs the previous daily-reset cutoff) at that cutoff point —
    // fainter than the solid latest-value labels so it reads as secondary.
    const drawDailyGains = (u: uPlot) => {
      const { min, max } = u.scales.x;
      if (
        min === undefined ||
        max === undefined ||
        max - min > DAILY_GAINS_MAX_SPAN_SEC
      ) {
        return;
      }
      const { ctx, bbox } = u;
      ctx.save();
      ctx.font = `${11 * dpr}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      // fainter than the latest-value labels (which draw at full opacity).
      ctx.globalAlpha = 0.55;
      for (const idx of config.primaryLineSeriesIdx) {
        const series = u.series[idx];
        const gains = config.dailyGainsBySeries[idx];
        if (!series.show || !gains) {
          continue;
        }
        ctx.fillStyle = config.colorBySeriesIdx[idx] ?? "#fff";
        for (const point of gains) {
          if (point.ts < min || point.ts > max) {
            continue;
          }
          const x = u.valToPos(point.ts, "x", true);
          const y = u.valToPos(point.value, "y", true);
          if (
            x < bbox.left ||
            x > bbox.left + bbox.width ||
            y < bbox.top ||
            y > bbox.top + bbox.height
          ) {
            continue;
          }
          const text = `${point.gain >= 0 ? "+" : ""}${numberFormatter.format(
            Math.round(point.gain * 10) / 10,
          )}`;
          ctx.fillText(text, x, y - 6 * dpr);
        }
      }
      ctx.restore();
    };

    const drawBandLabels = (u: uPlot) => {
      const { ctx, series, bbox } = u;
      ctx.save();
      ctx.font = `${10 * dpr}px sans-serif`;
      ctx.fillStyle = "#9ca3af";
      ctx.textBaseline = "middle";
      for (const band of config.confidenceBands) {
        if (band.points.length === 0) {
          continue;
        }
        if (
          band.linkedSeriesIdx !== null &&
          !series[band.linkedSeriesIdx]?.show
        ) {
          continue;
        }
        const [ts, low, high] = band.points[band.points.length - 1];
        const x = u.valToPos(ts, "x", true);
        if (x < bbox.left || x > bbox.left + bbox.width) {
          continue;
        }
        for (const value of [high, low]) {
          const y = u.valToPos(value, "y", true);
          if (y >= bbox.top && y <= bbox.top + bbox.height) {
            ctx.fillText(numberFormatter.format(value), x + 4 * dpr, y);
          }
        }
      }
      ctx.restore();
    };

    const drawWeeklyDiffs = (u: uPlot) => {
      const { ctx, bbox } = u;
      ctx.save();
      ctx.font = `${10 * dpr}px sans-serif`;
      // pin alignment: uPlot leaves textAlign as "center"/"right" after drawing
      // its axis labels, which would break the manual centering below.
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      const lineHeight = 12 * dpr;
      // lift the block clear of the x-axis instead of sitting right on it.
      const bottom = bbox.top + bbox.height - 16 * dpr;
      for (const diff of config.weeklyDiffs) {
        const cx = u.valToPos((diff.from + diff.to) / 2, "x", true);
        if (cx < bbox.left || cx > bbox.left + bbox.width) {
          continue;
        }
        diff.lines.forEach((segments, lineIdx) => {
          const totalWidth = segments.reduce(
            (w, seg) => w + ctx.measureText(seg.text).width,
            0,
          );
          let x = cx - totalWidth / 2;
          const y = bottom - (diff.lines.length - 1 - lineIdx) * lineHeight;
          for (const seg of segments) {
            ctx.fillStyle = seg.color;
            ctx.fillText(seg.text, x, y);
            x += ctx.measureText(seg.text).width;
          }
        });
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
      // shared tooltip: show every line/scatter that spans the hovered x,
      // interpolating its value there (the series are sparse on the unified x,
      // so reading the raw cell would be null between a series' own points).
      for (const i of [...config.lineSeriesIdx, ...config.scatterSeriesIdx]) {
        const series = u.series[i];
        if (!series.show || typeof series.label !== "string") {
          continue;
        }
        const value = interpolateAt(xs, u.data[i], idx);
        if (value === null) {
          continue;
        }
        // uPlot wraps `series.stroke` into a function internally, so read the
        // colour from the config map instead.
        const stroke = config.colorBySeriesIdx[i] ?? "#fff";
        // the extrapolation-history scatter carries the timestamp the
        // prediction was made (`estimatedAt`, already in ms — unlike the
        // seconds-based unified x), so format it directly.
        const est = config.estimatedAtBySeries[i]?.[idx];
        const estLabel =
          typeof est === "number"
            ? ` <span style="opacity:.6">(est. ${dateFormatter.format(
                est,
              )})</span>`
            : "";
        rows.push(
          `<div style="color:${stroke}">${series.label}: <b>${numberFormatter.format(
            Math.round(value * 10) / 10,
          )}</b>${estLabel}</div>`,
        );
      }

      // confidence bands aren't series — interpolate their low/high bounds at
      // the cursor and show them where the band exists (the future region).
      for (const band of config.confidenceBands) {
        if (
          band.linkedSeriesIdx !== null &&
          !u.series[band.linkedSeriesIdx]?.show
        ) {
          continue;
        }
        const bounds = interpolateBandAt(band.points, xs[idx]);
        if (bounds === null) {
          continue;
        }
        const linked =
          band.linkedSeriesIdx === null
            ? undefined
            : u.series[band.linkedSeriesIdx]?.label;
        const label =
          typeof linked === "string" ? `${linked} band` : "Confidence";
        rows.push(
          `<div style="color:${band.color}">${label}: <b>${oneDecimal(
            bounds.low,
          )}</b> – <b>${oneDecimal(bounds.high)}</b></div>`,
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

    // width emphasis on focus (uPlot focus-cursor demo): the hovered line gets a
    // bolder stroke and the rest thin out, on top of the `focus.alpha` dim.
    // uPlot runs `setFocus` (the alpha redraw) *before* this hook, so the widths
    // are mutated here and an explicit redraw repaints with them.
    const baseWidths = config.series.map((s) =>
      typeof s.width === "number" ? s.width : 1,
    );
    let lastFocus: number | null = -1;
    const applyFocusWidths = (
      u: uPlot,
      seriesIdx: number | null,
      opts: uPlot.Series,
    ) => {
      // only react to cursor focus (opts === {focus:true}), not legend
      // show/hide (also a setSeries event).
      if (!(opts as { focus?: boolean }).focus || seriesIdx === lastFocus) {
        return;
      }
      lastFocus = seriesIdx;
      u.series.forEach((s, i) => {
        const base = baseWidths[i];
        // leave the x series and points-only (scatter, width 0) untouched.
        if (i === 0 || base === 0) {
          return;
        }
        s.width = seriesIdx === null ? base : i === seriesIdx ? base + 1 : 1;
      });
      u.redraw();
    };

    // MythicStats links are clickable, so they're real DOM <a> overlays in
    // `u.over` (created in the init hook) rather than canvas — repositioned to
    // the centre-top of their week band on every redraw/zoom, hidden off-view.
    const positionMythicLinks = (u: uPlot) => {
      const overW = u.over.clientWidth;
      for (const { el, center } of mythicLinksRef.current) {
        const x = u.valToPos(center, "x");
        if (x < 0 || x > overW) {
          el.style.display = "none";
        } else {
          el.style.display = "block";
          el.style.left = `${x}px`;
        }
      }
    };

    const opts: uPlot.Options = {
      // floor to whole pixels: uPlot's root is `width: min-content`, so a
      // fractional width rounds up and spills ~1px past the container.
      width: Math.floor(container.clientWidth) || 600,
      height: Math.floor(container.clientHeight) || 240,
      series: config.series,
      legend: { show: false },
      // proximity focus: the line nearest the cursor stays vivid, the rest dim
      // (matches Highcharts highlighting the dataset under the cursor).
      focus: { alpha: 0.3 },
      cursor: {
        drag: { x: true, y: false },
        focus: { prox: 30 },
        points: { size: 6 },
      },
      scales: {
        x: { time: true },
        y: {
          // The confidence band is drawn manually (not a uPlot series), so uPlot
          // doesn't see its upper edge when auto-ranging y. Extend the range to
          // include the visible band's high plus a little headroom, so the top
          // of the 0.1% band isn't clipped off the top of the plot.
          range: (u, dataMin, dataMax) => {
            const xMin = u.scales.x.min ?? Number.NEGATIVE_INFINITY;
            const xMax = u.scales.x.max ?? Number.POSITIVE_INFINITY;
            let hi = dataMax;
            for (const band of config.confidenceBands) {
              if (
                band.linkedSeriesIdx !== null &&
                !u.series[band.linkedSeriesIdx]?.show
              ) {
                continue;
              }
              for (const point of band.points) {
                if (point[0] >= xMin && point[0] <= xMax && point[2] > hi) {
                  hi = point[2];
                }
              }
            }
            const span = hi - dataMin || Math.abs(hi) || 1;
            return [dataMin - span * 0.05, hi + span * 0.08];
          },
        },
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
          values: (_u, splits) => splits.map((v) => numberFormatter.format(v)),
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

            const links: { el: HTMLAnchorElement; center: number }[] = [];
            for (const link of config.mythicLinks) {
              const a = document.createElement("a");
              a.href = `https://mythicstats.com/period/${link.period}`;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              a.title = `MythicStats for week ${link.week}`;
              a.style.cssText =
                "position:absolute;top:2px;z-index:5;display:none;" +
                "pointer-events:auto;transform:translateX(-50%)";
              const img = document.createElement("img");
              img.src = "/mythic-stats.png";
              img.width = 30;
              img.height = 30;
              img.alt = "";
              img.loading = "lazy";
              a.append(img);
              u.over.append(a);
              links.push({ el: a, center: link.center });
            }
            mythicLinksRef.current = links;

            // ---- touch pan / pinch zoom ----
            // uPlot's core cursor + drag-select is mouse-only (browsers don't
            // synthesise a mousedown→move stream from a touch drag), so there's
            // no touch zoom by default. Bind it on `u.over` and route the result
            // through `onZoomRef` — the same shared-zoom channel the mouse
            // box-select uses — so a gesture on one region syncs the others and
            // the "Reset zoom" button still clears it. All math is anchored to
            // the gesture-start scale so it stays stable as the scale updates.
            const { over, scales } = u;

            const valAtClientX = (clientX: number) =>
              u.posToVal(clientX - over.getBoundingClientRect().left, "x");

            // `min`/`max` are the x-scale (seconds) at gesture start; `vals` are
            // the data-x under each finger at start (used to pin them on pinch).
            let touch: {
              vals: number[];
              min: number;
              max: number;
              clientX: number;
              clientY: number;
              panning: boolean;
            } | null = null;

            const onTouchStart = (e: TouchEvent) => {
              const { touches } = e;
              if (touches.length > 2) {
                touch = null;
                return;
              }
              const { min, max } = scales.x;
              const { clientX, clientY } = touches[0];
              touch = {
                vals: Array.from(touches, ({ clientX: cx }) =>
                  valAtClientX(cx),
                ),
                min: min ?? 0,
                max: max ?? 0,
                clientX,
                clientY,
                // two fingers is always a pinch; one finger only pans once the
                // drag is clearly horizontal, so vertical page scroll between
                // the stacked region charts still works.
                panning: touches.length === 2,
              };
            };

            const onTouchMove = (e: TouchEvent) => {
              if (!touch) {
                return;
              }
              const w = over.clientWidth;
              if (w <= 0) {
                return;
              }
              const { touches } = e;
              const rect = over.getBoundingClientRect();

              if (touches.length === 2 && touch.vals.length === 2) {
                // pinch: solve for the scale that keeps the two anchored data-x
                // pinned under the two (live) finger positions.
                e.preventDefault();
                const pA = touches[0].clientX - rect.left;
                const pB = touches[1].clientX - rect.left;
                if (pA === pB) {
                  return;
                }
                const span = ((touch.vals[0] - touch.vals[1]) * w) / (pA - pB);
                if (span <= 0) {
                  return;
                }
                const min = touch.vals[0] - (pA / w) * span;
                onZoomRef.current({
                  min: min * 1000,
                  max: (min + span) * 1000,
                });
                return;
              }

              if (touches.length === 1) {
                const dxPx = touches[0].clientX - touch.clientX;
                const dyPx = touches[0].clientY - touch.clientY;
                // defer to vertical page scroll until the drag is clearly
                // horizontal (and past a small dead zone).
                if (!touch.panning) {
                  if (Math.abs(dxPx) < 10 || Math.abs(dxPx) <= Math.abs(dyPx)) {
                    return;
                  }
                  touch.panning = true;
                }
                e.preventDefault();
                // shift the start scale by the finger's pixel delta, in scale
                // units — content tracks the finger.
                const valuePerPx = (touch.max - touch.min) / w;
                const shift = dxPx * valuePerPx;
                onZoomRef.current({
                  min: (touch.min - shift) * 1000,
                  max: (touch.max - shift) * 1000,
                });
              }
            };

            const onTouchEnd = (e: TouchEvent) => {
              if (e.touches.length === 0) {
                touch = null;
              }
            };

            // `passive: false` so `preventDefault()` can suppress scroll during
            // an active gesture. The listeners live on `u.over`, which uPlot
            // removes on `destroy()`, so they're GC'd with the plot.
            over.addEventListener("touchstart", onTouchStart, {
              passive: false,
            });
            over.addEventListener("touchmove", onTouchMove, { passive: false });
            over.addEventListener("touchend", onTouchEnd);
            over.addEventListener("touchcancel", onTouchEnd);

            // double-click resets the zoom for *all* regions by clearing the
            // shared extremes (the `[extremes]` effect then re-applies each
            // region's initial zoom), matching the "Reset zoom" button. uPlot's
            // built-in dblclick would otherwise only reset this chart locally.
            over.addEventListener("dblclick", () => {
              onZoomRef.current(null);
            });
          },
        ],
        drawClear: [drawWeekBands, drawConfidenceBands],
        draw: [
          drawLines,
          drawValueLabels,
          drawDailyGains,
          drawBandLabels,
          drawWeeklyDiffs,
          positionMythicLinks,
        ],
        setCursor: [updateTooltip],
        setSeries: [applyFocusWidths],
        setSelect: [
          (u) => {
            if (u.select.width <= 0) {
              return;
            }
            const min = u.posToVal(u.select.left, "x");
            const max = u.posToVal(u.select.left + u.select.width, "x");
            onZoomRef.current({
              min: Math.round(min * 1000),
              max: Math.round(max * 1000),
            });
          },
        ],
      },
    };

    // eslint-disable-next-line new-cap -- uPlot is the library's exported class
    const plot = new uPlot(opts, config.data, container);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      plotRef.current = null;
      tooltipRef.current = null;
      mythicLinksRef.current = [];
    };
  }, [config]);

  // keep the plot sized to its container.
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

  // apply the shared zoom (or the initial zoom) imperatively.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) {
      return;
    }
    if (extremes) {
      plot.setScale("x", {
        min: extremes.min / 1000,
        max: extremes.max / 1000,
      });
    } else if (config.initialZoom) {
      plot.setScale("x", {
        min: config.initialZoom[0],
        max: config.initialZoom[1],
      });
    }
  }, [extremes, config]);

  const resetZoom = () => {
    const plot = plotRef.current;
    if (plot) {
      if (config.initialZoom) {
        plot.setScale("x", {
          min: config.initialZoom[0],
          max: config.initialZoom[1],
        });
      } else {
        const xs = plot.data[0];
        if (xs.length > 0) {
          plot.setScale("x", { min: xs[0], max: xs[xs.length - 1] });
        }
      }
    }
    // clear the shared zoom so the other regions reset too.
    onZoomRef.current(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <button
          type="button"
          onClick={resetZoom}
          className="absolute bottom-12 right-6 z-10 border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-stone-200 hover:bg-gray-700"
        >
          Reset zoom
        </button>
      </div>
      <Legend items={config.legend} />
    </div>
  );
}
