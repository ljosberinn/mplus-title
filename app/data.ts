/**
 * Compact, columnar wire contract for a season's chart data + the
 * client-safe `decode()` that turns it back into the `Dataset[]` the chart
 * builders consume.
 *
 * The loader ships `SeasonData` (this shape) instead of the fully-baked
 * `EnhancedSeason`: the per-region time series is transposed into parallel
 * arrays with delta-encoded second timestamps and sparse columns dropped, and
 * the derived presentation (series/plotBands/plotLines/blueprint) and the
 * static season config are no longer sent — they are rebuilt in the browser
 * from `decode()` + the bundled season config. See `app/chart/assemble.ts`.
 */
import { type Regions } from "prisma/generated/prisma/enums";

import { type Extrapolation } from "./chart/builders";
import { type RecordSeries } from "./chart/types";
import { type Dataset } from "./seasons";

/** A region's `Dataset[]` transposed into parallel, delta-encoded columns. */
export type ColumnarSeries = {
  /** Anchor timestamp in ms; per-row timestamps are `base + dt[i] * 1000`. */
  base: number;
  /** Seconds from `base` per row, ascending. */
  dt: number[];
  score: number[];
  /** `null` when the whole column is absent (saves the array entirely). */
  score100: (number | null)[] | null;
  /** 0 = horde, 1 = alliance, null = cross-faction. `null` for modern seasons. */
  faction: (0 | 1 | null)[] | null;
};

/** `[x, y, estimatedAt]` — the extrapolation-history scatter, key-stripped. */
export type ExtrapolationHistoryTuple = [number, number, number];

export type RegionPayload = {
  series: ColumnarSeries;
  extrapolation: Extrapolation;
  extrapolation100: Extrapolation;
  extrapolationHistory: ExtrapolationHistoryTuple[];
};

export type SeasonData = {
  slug: string;
  regionsToDisplay: Regions[];
  regions: Partial<Record<Regions, RegionPayload>>;
  records: RecordSeries[];
};

export type DecodedRegion = {
  data: Dataset[];
  extrapolation: Extrapolation;
  extrapolation100: Extrapolation;
  extrapolationHistory: { x: number; y: number; estimatedAt: number }[];
};

export type DecodedSeasonData = {
  slug: string;
  regionsToDisplay: Regions[];
  regions: Partial<Record<Regions, DecodedRegion>>;
  records: RecordSeries[];
};

/** Transposes a region's `Dataset[]` into delta-encoded parallel columns,
 * dropping columns that are entirely empty. Inverse of `decodeSeries`. */
export function encodeSeries(data: Dataset[]): ColumnarSeries {
  const base = data.length > 0 ? data[0].ts : 0;
  const dt: number[] = [];
  const score: number[] = [];
  const score100: (number | null)[] = [];
  const faction: (0 | 1 | null)[] = [];

  let hasScore100 = false;
  let hasFaction = false;

  for (const dataset of data) {
    dt.push(Math.round((dataset.ts - base) / 1000));
    score.push(dataset.score);

    score100.push(dataset.score100);
    if (dataset.score100 !== null) {
      hasScore100 = true;
    }

    const factionCode =
      dataset.faction === "horde"
        ? 0
        : dataset.faction === "alliance"
          ? 1
          : null;
    faction.push(factionCode);
    if (factionCode !== null) {
      hasFaction = true;
    }
  }

  return {
    base,
    dt,
    score,
    score100: hasScore100 ? score100 : null,
    faction: hasFaction ? faction : null,
  };
}

function decodeSeries(series: ColumnarSeries): Dataset[] {
  const out: Dataset[] = [];

  for (let i = 0; i < series.dt.length; i += 1) {
    const dataset: Dataset = {
      ts: series.base + series.dt[i] * 1000,
      score: series.score[i],
      score100: series.score100 ? series.score100[i] : null,
    };

    const faction = series.faction ? series.faction[i] : null;

    if (faction !== null) {
      dataset.faction = faction === 0 ? "horde" : "alliance";
    }

    out.push(dataset);
  }

  return out;
}

/** Reconstructs the per-region `Dataset[]` + extrapolation needed by the chart
 * builders. Pure and client-safe. */
export function decode(payload: SeasonData): DecodedSeasonData {
  const regions: Partial<Record<Regions, DecodedRegion>> = {};

  for (const region of payload.regionsToDisplay) {
    const regionPayload = payload.regions[region];

    if (!regionPayload) {
      regions[region] = {
        data: [],
        extrapolation: null,
        extrapolation100: null,
        extrapolationHistory: [],
      };
      continue;
    }

    regions[region] = {
      data: decodeSeries(regionPayload.series),
      extrapolation: regionPayload.extrapolation,
      extrapolation100: regionPayload.extrapolation100,
      extrapolationHistory: regionPayload.extrapolationHistory.map(
        ([x, y, estimatedAt]) => ({ x, y, estimatedAt }),
      ),
    };
  }

  return {
    slug: payload.slug,
    regionsToDisplay: payload.regionsToDisplay,
    regions,
    records: payload.records,
  };
}
