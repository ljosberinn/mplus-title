/**
 * Pure adapter for the Dungeon Records uPlot chart: turns the assembled
 * `EnhancedSeason.records` (one Highcharts line per dungeon, `[ts, keyLevel]`
 * points) plus the season's week backgrounds / week-number markers into uPlot's
 * columnar inputs. Mirrors `uplotData.ts` but for the simpler records chart
 * (no extrapolation/bands/scatter). Timestamps are emitted in seconds.
 */
import type uPlot from "uplot";

import { type EnhancedSeason } from "../seasons";
import { type LegendItem } from "./uplotData";

/** Highcharts' default series palette, so colours match the prior look. */
const PALETTE = [
  "#7cb5ec",
  "#90ed7d",
  "#f7a35c",
  "#8085e9",
  "#f15c80",
  "#e4d354",
  "#2b908f",
  "#f45b5b",
  "#91e8e1",
  "#434348",
  "#e6b3ff",
  "#c0ff7c",
];

export type RecordsWeekBand = {
  /** seconds */
  from: number;
  to: number;
};

export type RecordsWeekLine = {
  /** seconds */
  value: number;
  label: string;
  labelColor: string;
};

export type DungeonRecordsConfig = {
  data: uPlot.AlignedData;
  series: uPlot.Series[];
  legend: LegendItem[];
  weekBands: RecordsWeekBand[];
  weekLines: RecordsWeekLine[];
  lineSeriesIdx: number[];
  /** seconds; right edge of the x-axis (now, capped to season end). */
  softMax: number | null;
};

type Pt = { ts: number; value: number };

function toPoints(data: unknown): Pt[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const out: Pt[] = [];

  for (const point of data) {
    if (Array.isArray(point)) {
      const [ts, value] = point as [number, number];
      out.push({ ts: Number(ts), value: Number(value) });
    } else if (point && typeof point === "object" && "x" in point) {
      const p = point as { x: number; y: number };
      out.push({ ts: Number(p.x), value: Number(p.y) });
    }
  }

  return out;
}

export function buildDungeonRecordsConfig(
  season: EnhancedSeason,
): DungeonRecordsConfig {
  const records = season.records ?? [];

  // 1) union of all timestamps (seconds) across every dungeon line.
  const tsSet = new Set<number>();
  const perRecord = records.map((record) => toPoints(record.data));
  for (const points of perRecord) {
    for (const { ts } of points) {
      tsSet.add(Math.round(ts / 1000));
    }
  }
  const xs = [...tsSet].sort((a, b) => a - b);
  const indexOf = new Map(xs.map((ts, i) => [ts, i]));

  const data: uPlot.AlignedData = [xs];
  const series: uPlot.Series[] = [{}]; // x
  const legend: LegendItem[] = [];
  const lineSeriesIdx: number[] = [];

  records.forEach((record, recordIdx) => {
    const color = PALETTE[recordIdx % PALETTE.length];
    const label = record.name || `Dungeon ${recordIdx + 1}`;
    const { iconUrl } = record;

    const column: (number | null)[] = Array.from(
      { length: xs.length },
      () => null,
    );
    for (const { ts, value } of perRecord[recordIdx]) {
      const i = indexOf.get(Math.round(ts / 1000));
      if (i !== undefined) {
        column[i] = value;
      }
    }
    data.push(column);

    const seriesIdx = series.length;
    lineSeriesIdx.push(seriesIdx);

    series.push({
      label,
      scale: "y",
      stroke: color,
      width: 2,
      // dungeon points are sparse on the unified x; bridge the artificial gaps.
      spanGaps: true,
      points: { show: false },
    });

    legend.push({
      seriesIdx,
      label,
      color,
      iconUrl,
      toggleable: true,
      defaultVisible: true,
    });
  });

  // 2) faded week backgrounds — reuse the first region that has them.
  let weekBands: RecordsWeekBand[] = [];
  for (const bands of Object.values(season.score.xAxisPlotBands)) {
    const backgrounds = bands.filter((band) => band.id === "background-color");
    if (backgrounds.length > 0) {
      weekBands = backgrounds.map((band) => ({
        from: Math.round(band.from / 1000),
        to: Math.round(band.to / 1000),
      }));
      break;
    }
  }

  // 3) week-number markers (transparent line, lightgreen "WN" label).
  let weekLines: RecordsWeekLine[] = [];
  for (const lines of Object.values(season.score.xAxisPlotLines)) {
    const weekNumbers = lines.filter((line) => line.id === "week-number");
    if (weekNumbers.length > 0) {
      weekLines = weekNumbers
        .filter((line) => typeof line.value === "number")
        .map((line) => ({
          value: Math.round(line.value / 1000),
          label: line.label?.text ?? "",
          labelColor: line.label?.color ?? "lightgreen",
        }));
      break;
    }
  }

  // 4) right edge: now, capped to the earliest known season end.
  const ends = Object.values(season.endDates).filter(
    (value): value is number => value !== null,
  );
  const softMaxMs = Math.min(Date.now(), ...ends);
  const softMax = Number.isFinite(softMaxMs)
    ? Math.round(softMaxMs / 1000)
    : null;

  return { data, series, legend, weekBands, weekLines, lineSeriesIdx, softMax };
}
