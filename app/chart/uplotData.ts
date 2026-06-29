/**
 * Pure adapter: turns the already-assembled `EnhancedSeason.score` for one
 * region (the same Highcharts-shaped series/plotBands/plotLines the Highcharts
 * renderer consumes) into uPlot's native columnar inputs. Consuming the
 * assembled score guarantees *which* series/annotations appear is identical to
 * the Highcharts path; only the drawing differs (Step 3 is visual-only).
 *
 * uPlot needs a single shared x with `null` gaps, so every series is aligned
 * onto the union of all timestamps. Timestamps are emitted in seconds (uPlot's
 * native time unit).
 */
import { type Regions } from "prisma/generated/prisma/enums";
import type uPlot from "uplot";

import { type EnhancedSeason } from "../seasons";

export type LegendItem = {
  /** index into the uPlot series array (1-based; 0 is x). */
  seriesIdx: number;
  label: string;
  color: string;
  /** band fill series have no toggle of their own. */
  toggleable: boolean;
  defaultVisible: boolean;
  /** optional leading icon (dungeon records legend shows the dungeon icon). */
  iconUrl?: string | null;
};

export type VerticalLine = {
  /** seconds */
  value: number;
  color: string;
  /** label text colour (separate from the line — e.g. week markers have a
   * transparent line but a lightgreen label). */
  labelColor: string;
  label: string;
  /** vertical label offset hint from the original Highcharts `label.y`. */
  labelY: number;
};

export type HorizontalLine = {
  value: number;
  color: string;
  label: string;
};

export type WeekBand = {
  /** seconds */
  from: number;
  to: number;
  color: string;
  future: boolean;
};

export type DiffSegment = { text: string; color: string };

/** Per-week score gain/loss labels (the `+x.x` / `-x.x` annotations). */
export type WeekDiff = {
  /** seconds */
  from: number;
  to: number;
  /** one entry per line; each line is a row of coloured text segments. */
  lines: DiffSegment[][];
};

/** Parses the Highcharts weekly-diff label HTML (coloured `<span>`s joined by
 * `<br>`, with literal separators like ` | `) into drawable colour segments. */
function parseDiffSegments(html: string): DiffSegment[][] {
  const re = /<span[^>]*color:\s*([^;]+);[^>]*>([^<]*)<\/span>/gu;

  return html
    .split("<br>")
    .map((line) => {
      const segments: DiffSegment[] = [];
      let last = 0;
      for (const match of line.matchAll(re)) {
        const idx = match.index ?? 0;
        const literal = line.slice(last, idx).replaceAll(/<[^>]*>/gu, "");
        if (literal.trim()) {
          segments.push({ text: literal, color: "#9ca3af" });
        }
        segments.push({
          color: (match[1] ?? "#fff").trim(),
          text: match[2] ?? "",
        });
        last = idx + match[0].length;
      }
      return segments;
    })
    .filter((segments) => segments.length > 0);
}

/** A MythicStats icon link placed at the centre-top of a (past) week band.
 * Only present for no-affix seasons with a known startingPeriod. */
export type MythicLink = {
  /** seconds; centre of the week band */
  center: number;
  /** mythicstats period id (startingPeriod + week index) */
  period: number;
  /** 1-based week number (for the link title) */
  week: number;
};

/** A confidence band, drawn manually as a filled polygon between low/high. */
export type ConfidenceBand = {
  color: string;
  /** [tsSeconds, low, high] per point. */
  points: [number, number, number][];
  /** uPlot series index of the line this band is slaved to (the band hides
   * when that extrapolation line is toggled off), or null if standalone. */
  linkedSeriesIdx: number | null;
};

export type UplotConfig = {
  data: uPlot.AlignedData;
  series: uPlot.Series[];
  confidenceBands: ConfidenceBand[];
  legend: LegendItem[];
  verticalLines: VerticalLine[];
  horizontalLines: HorizontalLine[];
  weekBands: WeekBand[];
  weeklyDiffs: WeekDiff[];
  mythicLinks: MythicLink[];
  /** uPlot series indices that are lines (get a last-point value label). */
  lineSeriesIdx: number[];
  /** primary cutoff lines (Score 0.1% / 1%) — their value label is nudged up. */
  primaryLineSeriesIdx: number[];
  /** uPlot series indices that are scatters (shown in the tooltip too). */
  scatterSeriesIdx: number[];
  /** scatter point metadata keyed by series index, for the tooltip. */
  estimatedAtBySeries: Record<number, (number | null)[]>;
  initialZoom: [number, number] | null;
};

type Point2 = [number, number];

function toPoints2(data: unknown): { ts: number; value: number | null }[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const out: { ts: number; value: number | null }[] = [];

  for (const point of data) {
    if (Array.isArray(point)) {
      const [ts, value] = point as Point2;
      out.push({
        ts: Number(ts),
        value: value === null ? null : Number(value),
      });
    } else if (point && typeof point === "object" && "x" in point) {
      const p = point as { x: number; y: number };
      out.push({ ts: Number(p.x), value: Number(p.y) });
    }
  }

  return out;
}

const stripeEven = "#4b5563";
const stripeOdd = "#1f2937";

export function buildUplotConfig(
  season: EnhancedSeason,
  region: Regions,
): UplotConfig {
  const rawSeries = season.score.series[region] ?? [];

  // 1) collect the union of all timestamps (seconds) across every series.
  const tsSet = new Set<number>();
  for (const s of rawSeries) {
    for (const { ts } of toPoints2(s.data)) {
      tsSet.add(Math.round(ts / 1000));
    }
  }
  // extend the x-scale to an ended season's end so the "Season End" line renders
  // even when the last scrape falls a few hours short of it (uPlot otherwise
  // scales x to the data only). Highcharts gets this for free via its plot bands.
  const seasonEndMs = season.endDates[region];
  if (typeof seasonEndMs === "number" && seasonEndMs <= Date.now()) {
    tsSet.add(Math.round(seasonEndMs / 1000));
  }
  const xs = [...tsSet].sort((a, b) => a - b);
  const indexOf = new Map(xs.map((ts, i) => [ts, i]));

  const align = (
    points: { ts: number; value: number | null }[],
  ): (number | null)[] => {
    const arr: (number | null)[] = Array.from(
      { length: xs.length },
      () => null,
    );
    for (const { ts, value } of points) {
      const i = indexOf.get(Math.round(ts / 1000));
      if (i !== undefined) {
        arr[i] = value;
      }
    }
    return arr;
  };

  const data: uPlot.AlignedData = [xs];
  const series: uPlot.Series[] = [{}]; // x
  const legend: LegendItem[] = [];
  const lineSeriesIdx: number[] = [];
  const scatterSeriesIdx: number[] = [];
  const estimatedAtBySeries: Record<number, (number | null)[]> = {};

  // bands reference their parent line by id; the line is created after the band
  // in `calculateSeries`, so collect bands then resolve the link in a 2nd pass.
  type PendingBand = {
    color: string;
    points: [number, number, number][];
    lineId: string | null;
  };
  const pendingBands: PendingBand[] = [];
  const lineIdxById = new Map<string, number>();

  for (const s of rawSeries) {
    const color = s.color ?? "#fff";
    const label = s.name ?? s.type ?? "series";
    const visible = s.visible ?? true;
    const points = toPoints2(s.data);

    if (s.type === "arearange") {
      // [ts, low, high] -> drawn manually as a filled polygon (uPlot's native
      // bands are finicky with the unified-x/null layout).
      const bandPoints: [number, number, number][] = [];
      if (Array.isArray(s.data)) {
        for (const point of s.data) {
          if (!Array.isArray(point)) {
            continue;
          }
          const [ts, lo, hi] = point as [number, number, number];
          bandPoints.push([
            Math.round(Number(ts) / 1000),
            Number(lo),
            Number(hi),
          ]);
        }
      }
      if (bandPoints.length > 0) {
        // band id is `${lineId}-confidence`; strip the suffix to find the line.
        const bandId = typeof s.id === "string" ? s.id : null;
        pendingBands.push({
          color,
          points: bandPoints,
          lineId: bandId ? bandId.replace(/-confidence$/u, "") : null,
        });
      }
      continue;
    }

    const isScatter = s.type === "scatter";
    const isExtrapolation = s.dashed && !isScatter;

    data.push(align(points));
    const seriesIdx = series.length;
    if (isScatter) {
      scatterSeriesIdx.push(seriesIdx);
    } else {
      lineSeriesIdx.push(seriesIdx);
    }
    if (typeof s.id === "string") {
      lineIdxById.set(s.id, seriesIdx);
    }

    series.push({
      label,
      scale: "y",
      stroke: color,
      width: isScatter ? 0 : 2,
      dash: isExtrapolation ? [6, 4] : undefined,
      // every series shares one unified x, so a series is `null` at any
      // timestamp it didn't sample (e.g. the spread-out extrapolation-history
      // scatter points). Bridge those artificial gaps so lines stay connected,
      // matching Highcharts. Scatter stays points-only via `paths`.
      spanGaps: !isScatter,
      points: {
        show: isScatter || isExtrapolation,
        size: isScatter ? 5 : 6,
        stroke: color,
        fill: color,
      },
      paths: isScatter ? () => null : undefined,
      show: visible,
    });

    legend.push({
      seriesIdx,
      label,
      color,
      toggleable: true,
      defaultVisible: visible,
    });

    if (isScatter && Array.isArray(s.data)) {
      const estimatedAt: (number | null)[] = Array.from(
        { length: xs.length },
        () => null,
      );
      for (const point of s.data) {
        if (point && typeof point === "object" && "x" in point) {
          const p = point as { x: number; estimatedAt?: number };
          const i = indexOf.get(Math.round(Number(p.x) / 1000));
          if (i !== undefined && p.estimatedAt !== undefined) {
            estimatedAt[i] = p.estimatedAt;
          }
        }
      }
      estimatedAtBySeries[seriesIdx] = estimatedAt;
    }
  }

  const confidenceBands: ConfidenceBand[] = pendingBands.map((band) => ({
    color: band.color,
    points: band.points,
    linkedSeriesIdx:
      band.lineId === null ? null : (lineIdxById.get(band.lineId) ?? null),
  }));

  // the primary cutoff lines (0.1% / 1%) — their last-point value label is
  // nudged up so it clears the line instead of sitting on top of it.
  const primaryLineSeriesIdx = ["score", "score100"]
    .map((id) => lineIdxById.get(id))
    .filter((i): i is number => i !== undefined);

  const verticalLines: VerticalLine[] = (
    season.score.xAxisPlotLines[region] ?? []
  )
    .filter((line) => typeof line.value === "number")
    .map((line) => ({
      value: Math.round(line.value / 1000),
      color: line.color ?? "#fff",
      labelColor: line.label?.color ?? line.color ?? "#fff",
      label: line.label?.text ?? "",
      labelY: typeof line.label?.y === "number" ? line.label.y : 0,
    }));

  const horizontalLines: HorizontalLine[] = (
    season.score.yAxisPlotLines[region] ?? []
  )
    .filter((line) => typeof line.value === "number")
    .map((line) => ({
      value: line.value,
      color: line.label?.color ?? line.color ?? "#fff",
      label: line.label?.text ?? "",
    }));

  const weekBands: WeekBand[] = (season.score.xAxisPlotBands[region] ?? [])
    .filter((band) => band.id === "background-color")
    .map((band, index) => ({
      from: Math.round(band.from / 1000),
      to: Math.round(band.to / 1000),
      // colour encodes future weeks via a trailing alpha ("...50")
      color: index % 2 === 0 ? stripeEven : stripeOdd,
      future: band.color.endsWith("50"),
    }));

  const weeklyDiffs: WeekDiff[] = (season.score.xAxisPlotBands[region] ?? [])
    .filter(
      (band) =>
        band.id === "weekly-difference" && typeof band.label?.text === "string",
    )
    .map((band) => ({
      from: Math.round(Number(band.from) / 1000),
      to: Math.round(Number(band.to) / 1000),
      lines: parseDiffSegments(band.label?.text ?? ""),
    }))
    .filter((diff) => diff.lines.length > 0);

  // MythicStats links sit in the week backgrounds, but only for seasons without
  // an affix rotation (affix seasons surface them in the header affix row) and
  // only for weeks that have already started — mirrors addMythicStatsLinksToBands.
  // direct read (not destructuring) so it doesn't trip
  // unicorn/consistent-destructuring against the other `season.*` reads below.
  // eslint-disable-next-line prefer-destructuring
  const startingPeriod = season.startingPeriod;
  const mythicLinks: MythicLink[] =
    season.affixes.length === 0 && startingPeriod
      ? (season.score.xAxisPlotBands[region] ?? [])
          .filter((band) => band.id === "background-color")
          .map((band, index) => ({ band, index }))
          .filter(
            ({ band }) =>
              !(typeof band.color === "string" && band.color.endsWith("50")),
          )
          .map(({ band, index }) => ({
            center: Math.round(
              (Number(band.from) + Number(band.to)) / 2 / 1000,
            ),
            period: startingPeriod + index,
            week: index + 1,
          }))
      : [];

  const zoom = season.score.initialZoom[region];

  return {
    data,
    series,
    confidenceBands,
    legend,
    verticalLines,
    horizontalLines,
    weekBands,
    weeklyDiffs,
    mythicLinks,
    lineSeriesIdx,
    primaryLineSeriesIdx,
    scatterSeriesIdx,
    estimatedAtBySeries,
    initialZoom: zoom
      ? [Math.round(zoom[0] / 1000), Math.round(zoom[1] / 1000)]
      : null,
  };
}
