import { Redis } from "@upstash/redis";
import {
  type SeriesArearangeOptions,
  type SeriesLineOptions,
  type SeriesScatterOptions,
  type XAxisPlotBandsOptions,
  type XAxisPlotLinesOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";
import { Regions } from "prisma/generated/prisma/enums";

import { env } from "~/env/server";

import { getAffixIconUrl } from "./affixes";
import { dungeonSlugMetaMap } from "./dungeons";
import { prisma } from "./prisma.server";
import { type Dataset, type EnhancedSeason, type Season } from "./seasons";
import { type Overlay, searchParamSeparator } from "./utils";
import { orderedRegionsBySize, overlays } from "./utils";

const dayInMs = 24 * 60 * 60 * 1000;
const oneWeekInMs = 7 * dayInMs;

function getCrossFactionHistory(
  region: Regions,
  gte: number | null,
  lte?: number,
) {
  if (!gte) {
    return [];
  }

  return prisma.crossFactionHistory.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      score: true,
      rank: true,
      score100: true,
      rank100: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
}

function getHistory(region: Regions, gte: number | null, lte?: number) {
  if (!gte) {
    return [];
  }

  return prisma.history.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      faction: true,
      customScore: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
}

function setupRedisProviders() {
  const upstash = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const persist = (data: Dataset[], key: string, expiry: number) => {
    if (env.NODE_ENV === "development") {
      return;
    }

    return upstash.set(key, data, {
      ex: expiry,
    });
  };

  const load = async (key: string): Promise<Dataset[] | null> => {
    if (env.NODE_ENV === "development") {
      return null;
    }

    return upstash.get(key);
  };

  return {
    persist,
    load,
  };
}

export async function loadExtrapolationHistoryForSeason(
  season: Season,
  region: Regions,
  overlays: readonly Overlay[],
): Promise<SeriesScatterOptions["data"]> {
  if (!season.supportsExtrapolationHistory) {
    return [];
  }

  if (!overlays.includes("extrapolation")) {
    return [];
  }

  if (season.startDates[region] === null) {
    return [];
  }

  const data = await prisma.extrapolation.findMany({
    orderBy: {
      timestamp: "asc",
    },
    where: {
      timestamp: {
        gte: Math.round(season.startDates[region] / 1000),
        lte: season.endDates[region]
          ? Math.round(season.endDates[region] / 1000)
          : undefined,
      },
      region: {
        equals: region,
      },
    },
    select: {
      score: true,
      timestamp: true,
      estimatedAt: true,
    },
  });

  // deduplicates extrapolation data to only have each individual extrapolated value per timestamp
  return Object.values(
    data.reduce<Record<string, (typeof data)[number]>>((acc, dataset) => {
      const key = [dataset.timestamp, dataset.score].join("-");

      if (!(key in acc)) {
        acc[key] = dataset;
      }

      return acc;
    }, {}),
  ).map((dataset) => ({
    x: dataset.timestamp * 1000,
    y: dataset.score,
    estimatedAt: dataset.estimatedAt * 1000,
  }));
}

export async function loadRecordsForSeason(
  season: Season,
  overlays: readonly Overlay[],
): Promise<SeriesLineOptions[]> {
  if (
    typeof season.dungeons === "number" ||
    season.dungeons.length === 0 ||
    season.startDates.US === null ||
    !overlays.includes("records") ||
    season.slug === "df-season-4"
  ) {
    return [];
  }

  const data = await prisma.dungeonHistory.findMany({
    orderBy: {
      timestamp: "asc",
    },
    where: {
      timestamp: {
        gte: Math.round(season.startDates.US / 1000),
        lte: season.endDates.US
          ? Math.round(season.endDates.US / 1000)
          : undefined,
      },
      keyLevel: {
        gte: 12,
      },
    },
    select: {
      slug: true,
      keyLevel: true,
      timestamp: true,
    },
  });

  return Object.values(
    data.reduce<Record<string, SeriesLineOptions>>((acc, dataset) => {
      if (!(dataset.slug in acc)) {
        const dungeonMetaInformation =
          dataset.slug in dungeonSlugMetaMap
            ? dungeonSlugMetaMap[dataset.slug]
            : null;

        const name = (dungeonMetaInformation?.name ?? dataset.slug).replace(
          "The ",
          "",
        );

        acc[dataset.slug] = {
          type: "line",
          data: [],
          name,
          // @ts-expect-error iconUrl is not in SeriesLineOptions but Highcharts uses it
          iconUrl: dungeonMetaInformation
            ? `https://wow.zamimg.com/images/wow/icons/medium/${dungeonMetaInformation.icon}.jpg`
            : null,
        };
      }

      const arr = acc[dataset.slug].data;

      if (Array.isArray(arr)) {
        arr.push([dataset.timestamp * 1000, dataset.keyLevel]);
      }

      return acc;
    }, {}),
  );
}

export async function loadDataForRegion(
  region: Regions,
  season: Season,
  timings: Timings,
): Promise<Dataset[]> {
  const gte = season.startDates[region];
  const lte = season.endDates[region] ?? undefined;
  const key = [season.slug, region, "v2"].join(searchParamSeparator);

  const { persist, load } = setupRedisProviders();

  const cached = await time(() => load(key), {
    type: `loadFromRedis-${region}`,
    timings,
  });

  if (cached) {
    return cached;
  }

  const [rawHistory, rawCrossFactionHistory] = await Promise.all([
    time(
      () =>
        season.crossFactionSupport === "complete"
          ? []
          : getHistory(region, gte, lte),
      { type: `getHistory-${region}`, timings },
    ),
    time(
      () =>
        season.crossFactionSupport === "none"
          ? []
          : getCrossFactionHistory(region, gte, lte),
      { type: `getCrossFactionHistory-${region}`, timings },
    ),
  ]);

  const datasets = await time(
    () =>
      [...rawHistory, ...rawCrossFactionHistory]
        .map((dataset) => {
          const next: Dataset = {
            ts: Number(dataset.timestamp) * 1000,
            score:
              "customScore" in dataset ? dataset.customScore : dataset.score,
            rank: "rank" in dataset ? dataset.rank : null,
            score100:
              "score100" in dataset && dataset.score100 > 0
                ? dataset.score100
                : null,
            rank100:
              "rank100" in dataset && dataset.rank100 > 0
                ? dataset.rank100
                : null,
          };

          if ("faction" in dataset) {
            next.faction = dataset.faction;
          }

          return next;
        })
        .filter((dataset) => dataset.score > 0)
        .sort((a, b) => a.ts - b.ts)
        .reduce<Dataset[]>((acc, dataset, index, arr) => {
          const next = arr[index + 1];
          const last = acc[acc.length - 1];

          if (acc.length === 0 || !next || last.score !== dataset.score) {
            acc.push(dataset);
          }

          return acc;
        }, []),
    { type: `normalizeDatasets-${region}`, timings },
  );

  await time(
    () =>
      persist(
        datasets,
        key,
        determineExpirationTimestamp(season, region, datasets),
      ),
    { type: `persist-${region}`, timings },
  );

  return datasets;
}

export function determineExpirationTimestamp(
  season: Season,
  region: Regions,
  datasets: Dataset[],
): number {
  const latestDataset =
    datasets.length > 0 ? datasets[datasets.length - 1] : null;

  const expiry = 5 * 60;

  if (!latestDataset) {
    return expiry;
  }

  const endDate = season.endDates[region];

  if (endDate && endDate < Date.now()) {
    return 30 * 24 * 60 * 60;
  }

  const threshold = 60 * 60 * 1000;
  const timeSinceUpdate = Date.now() - latestDataset.ts;
  const remaining = Math.round((threshold - timeSinceUpdate) / 1000 / 60) * 60;

  return remaining > 0 ? remaining : expiry;
}

export function determineRegionsToDisplayFromSearchParams(
  request: Request,
): Regions[] | null {
  const possiblyRegions = new URL(request.url).searchParams.get("regions");

  if (!possiblyRegions) {
    return null;
  }

  const maybeRegions = possiblyRegions
    .split(searchParamSeparator)
    .filter((maybeRegion): maybeRegion is Regions => maybeRegion in Regions);

  if (maybeRegions.length === 0) {
    return null;
  }

  return maybeRegions;
}

export function determineExtrapolationEnd(request: Request): number | null {
  const params = new URL(request.url).searchParams;

  const maybeDate = params.get("extrapolationEndDate");

  if (!maybeDate) {
    return null;
  }

  try {
    const date = new Date(maybeDate).getTime();

    if (date < Date.now()) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

export function calculateExtrapolation(
  season: Season,
  region: Regions,
  data: Dataset[],
  endOverride: number | null,
):
  | null
  | [number, number][]
  | {
      from: Omit<Dataset, "rank" | "rank100" | "score100">;
      to: Omit<Dataset, "rank" | "rank100" | "score100">;
    } {
  let seasonEnding = season.endDates[region];

  if (seasonEnding && Date.now() >= seasonEnding) {
    return null;
  }

  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return null;
  }

  if (!seasonEnding && endOverride) {
    // the date is unaware of hours, so adjust based on start time regionally
    const endOverrideDate = new Date(endOverride);
    endOverrideDate.setHours(new Date(seasonStart).getUTCHours());
    seasonEnding = endOverrideDate.getTime();
  }

  const daysUntilSeasonEnding = (() => {
    if (seasonEnding && seasonEnding > Date.now()) {
      return (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24;
    }

    return null;
  })();

  // don't allow nonsensical extrapolation
  if (daysUntilSeasonEnding && daysUntilSeasonEnding > 8 * 28) {
    return null;
  }

  const lastDataset = data[data.length - 1];
  const firstRelevantDataset = determineExtrapolationStart(
    data,
    season,
    region,
  );

  if (!firstRelevantDataset) {
    return null;
  }

  const weeks = seasonEnding ? (seasonEnding - seasonStart) / oneWeekInMs : 24;

  let passedWeeksDiff = Array.from({ length: weeks }, (_, index) => {
    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;

    return calculateFactionDiffForWeek(
      data,
      season.crossFactionSupport,
      index === 0,
      from,
      to,
    ).xFactionDiff;
  })
    .filter(Boolean)
    .slice(4);

  if (passedWeeksDiff.length === 0) {
    return null;
  }

  // for seasons with affixes, only take the last full rotation of affixes
  if (season.affixes.length > 0) {
    passedWeeksDiff = passedWeeksDiff.slice(-season.affixes.length);
  } else {
    // otherwise, take the last 6 weeks
    passedWeeksDiff = passedWeeksDiff.slice(-6);
  }

  const daysUntilSeasonEndingOrThreeWeeks = daysUntilSeasonEnding ?? 21;
  const to =
    seasonEnding ??
    lastDataset.ts + (daysUntilSeasonEndingOrThreeWeeks / 7) * oneWeekInMs;
  const timeUntilExtrapolationEnd = to - lastDataset.ts;

  const predictScoreAt = buildScorePredictor(
    data,
    passedWeeksDiff,
    seasonStart,
    lastDataset,
  );

  if (timeUntilExtrapolationEnd > oneWeekInMs / 7) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrThreeWeeks;

    const rawPoints: [number, number][] = [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrThreeWeeks - 1 },
        (_, i) => {
          const ts = Math.round(lastDataset.ts + interval * (i + 1));
          return [ts, predictScoreAt(ts)];
        },
      ),
      [to, predictScoreAt(to)],
    ];

    // the cutoff can never decrease, so enforce a monotonic trajectory
    let runningMax = lastDataset.score;

    return rawPoints.map(([ts, score], index): [number, number] => {
      runningMax = Math.max(runningMax, score);
      return [ts, index === 0 ? lastDataset.score : toOneDigit(runningMax)];
    });
  }

  return {
    from: lastDataset,
    to: {
      score: toOneDigit(Math.max(lastDataset.score, predictScoreAt(to))),
      ts: to,
    },
  };
}

const LOG_BLEND_WEIGHT = 0.7;
const DAMPED_ALPHA = 0.3;
const DAMPED_BETA = 0.1;
// damping is close to 1 because the horizon spans ~21 daily steps; smaller
// values would decay the trend away long before the horizon is reached
const DAMPED_PHI = 0.97;

function fitLeastSquares(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number } {
  const n = xs.length;
  const sumX = xs.reduce((acc, x) => acc + x, 0);
  const sumY = ys.reduce((acc, y) => acc + y, 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const sumXY = xs.reduce((acc, x, index) => acc + x * ys[index], 0);

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/** Collapses data to one score per calendar day, gaps forward-filled. */
function toDailySeries(
  data: Dataset[],
  seasonStart: number,
): { day: number; score: number }[] {
  if (data.length === 0) {
    return [];
  }

  const byDay = new Map<number, number>();
  for (const dataset of data) {
    byDay.set(Math.floor((dataset.ts - seasonStart) / dayInMs), dataset.score);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const series: { day: number; score: number }[] = [];
  let lastKnown = byDay.get(days[0])!;

  for (let day = days[0]; day <= days[days.length - 1]; day++) {
    if (byDay.has(day)) {
      lastKnown = byDay.get(day)!;
    }
    series.push({ day, score: lastKnown });
  }

  return series;
}

/**
 * Builds the "logDamped" predictor: given the season data so far it precomputes
 * the three sub-models once and returns a function giving the projected score at
 * any future timestamp.
 *
 * The projection is the mean of:
 *  - logBlend: a log(time) curve fit (deceleration) blended with the recent,
 *    recency-weighted weekly rate (responsiveness), and
 *  - dampedTrend: Holt linear smoothing with a damped trend.
 *
 * The two have opposite biases (the log side leans high, the damped side low),
 * so averaging them largely cancels the bias.
 */
function buildScorePredictor(
  data: Dataset[],
  weeklyDiffWindow: number[],
  seasonStart: number,
  lastDataset: Dataset,
): (ts: number) => number {
  const { ts: lastTs, score: lastScore } = lastDataset;

  // skip the volatile first four weeks
  const warmup = data.filter(
    (dataset) => dataset.ts >= seasonStart + 4 * oneWeekInMs,
  );

  // 1) logarithmic curve: score ~ ln(days since season start)
  const logFit =
    warmup.length >= 2
      ? fitLeastSquares(
          warmup.map((dataset) =>
            Math.log((dataset.ts - seasonStart) / dayInMs),
          ),
          warmup.map((dataset) => dataset.score),
        )
      : null;

  // 2) recency-weighted recent weekly rate (newest week 1, oldest ~0.1),
  // normalised by the sum of weights so it stays a true weighted mean
  const recentWeeks = [...weeklyDiffWindow].reverse();
  let weightedSum = 0;
  let weightTotal = 0;
  recentWeeks.forEach((diff, index) => {
    const factor =
      index === 0
        ? 1
        : 1 - (1 - 0.1) * (index / (recentWeeks.length - 1)) ** 1.5;
    weightedSum += diff * factor;
    weightTotal += factor;
  });
  const weeklyRate = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // 3) Holt damped-trend smoothing over a regular daily series
  const series = toDailySeries(warmup, seasonStart);
  let level = series.length > 0 ? series[0].score : lastScore;
  let trend = series.length >= 2 ? series[1].score - series[0].score : 0;
  for (let i = 1; i < series.length; i++) {
    const previousLevel = level;
    level =
      DAMPED_ALPHA * series[i].score +
      (1 - DAMPED_ALPHA) * (level + DAMPED_PHI * trend);
    trend =
      DAMPED_BETA * (level - previousLevel) +
      (1 - DAMPED_BETA) * DAMPED_PHI * trend;
  }
  const lastDay = series.length > 0 ? series[series.length - 1].day : 0;

  return (ts: number): number => {
    const horizonWeeks = (ts - lastTs) / oneWeekInMs;

    const logScore = logFit
      ? Math.max(
          logFit.intercept +
            logFit.slope * Math.log((ts - seasonStart) / dayInMs),
          lastScore,
        )
      : lastScore;
    const weightedScore = lastScore + weeklyRate * horizonWeeks;
    const logBlend =
      LOG_BLEND_WEIGHT * logScore + (1 - LOG_BLEND_WEIGHT) * weightedScore;

    let damped = lastScore;
    if (series.length >= 2) {
      const steps = Math.round((ts - seasonStart) / dayInMs - lastDay);
      if (steps <= 0) {
        damped = Math.max(level, lastScore);
      } else {
        let damping = 0;
        let phiPower = DAMPED_PHI;
        for (let i = 0; i < steps; i++) {
          damping += phiPower;
          phiPower *= DAMPED_PHI;
        }
        damped = Math.max(level + trend * damping, lastScore);
      }
    }

    return (logBlend + damped) / 2;
  };
}

function determineExtrapolationStart(
  data: Dataset[],
  season: Season,
  region: Regions,
): Dataset | null {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return null;
  }

  const firstDataset = data.find((dataset) => {
    return dataset.ts >= seasonStart + 4 * oneWeekInMs;
  });

  return firstDataset ?? null;
}

function toOneDigit(int: number) {
  return Number.parseFloat(int.toFixed(1));
}

export function calculateZoom(
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: EnhancedSeason["score"]["extrapolation"]["EU"],
): [number, number] {
  const seasonEnding = season.endDates[region];

  const daysUntilSeasonEnding =
    seasonEnding && seasonEnding > Date.now()
      ? (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24
      : null;

  const zoomEnd =
    (Array.isArray(extrapolation)
      ? extrapolation[extrapolation.length - 1][0]
      : extrapolation?.to.ts) ?? data[data.length - 1].ts;

  if (daysUntilSeasonEnding) {
    const offset =
      daysUntilSeasonEnding < 3
        ? 1.5
        : daysUntilSeasonEnding < 7
          ? 2.5
          : daysUntilSeasonEnding < 14
            ? 3.5
            : null;

    if (offset) {
      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset * oneWeekInMs);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }
  }

  // offset by +2 weeks since extrapolation is at least two into the future
  const offset = (extrapolation ? 6 : 4) * oneWeekInMs;

  const backThen = [...data]
    .reverse()
    .find((dataset) => dataset.ts < zoomEnd - offset);

  return [backThen ? backThen.ts : 0, zoomEnd];
}

export function determineOverlaysToDisplayFromSearchParams(
  request: Request,
): Overlay[] | null {
  const params = new URL(request.url).searchParams;

  const maybeOverlays = params.get("overlays");

  if (!maybeOverlays) {
    return null;
  }

  const fromSearchParams = new Set(maybeOverlays.split(searchParamSeparator));

  return overlays.filter((plotline) => fromSearchParams.has(plotline));
}

export function determineOverlaysToDisplayFromCookies(
  request: Request,
): Overlay[] | null {
  const cookie = request.headers.get("Cookie") ?? request.headers.get("cookie");

  if (!cookie) {
    return null;
  }

  const raw = cookie.split("; ").find((row) => row.includes("overlays"));

  if (!raw) {
    return null;
  }

  try {
    const values = raw.split("=")[1]?.split(searchParamSeparator);
    const filteredOverlays = overlays.filter((overlay) =>
      values.includes(overlay),
    );
    return filteredOverlays.length > 0 ? filteredOverlays : null;
  } catch {
    return null;
  }
}

export function determineRegionsToDisplayFromCookies(
  request: Request,
): Regions[] | null {
  const cookie = request.headers.get("Cookie") ?? request.headers.get("cookie");

  if (!cookie) {
    return null;
  }

  const raw = cookie.split("; ").find((row) => row.includes("regions"));

  if (!raw) {
    return null;
  }

  try {
    const values = raw.split("=")[1]?.split(searchParamSeparator);
    const filteredRegions = orderedRegionsBySize.filter((region) =>
      values.includes(region),
    );
    return filteredRegions.length > 0 ? filteredRegions : null;
  } catch {
    return null;
  }
}

const colors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#EEE7D8",
  extrapolation: "#ccaa8aff",
  extrapolationHistory: "gray",
  top1: "orange",
} as const;

// Per-day half-width of the confidence band, as a fraction of the predicted
// score. Calibrated by leave-one-season-out conformal prediction in
// scripts/backtest-advanced.ts: ±~1.7% at the 21-day lead gave ~90% coverage.
// The band starts at zero width "now" and grows linearly with the lead.
const CONFORMAL_BAND_RATE_PER_DAY = 0.0172 / 21;

/**
 * Derives an arearange [x, low, high] band around an extrapolation trajectory.
 * Width is ~0 at the anchor (now) and widens with the lead time; the lower bound
 * never drops below the current score, since the cutoff cannot decrease.
 */
export function calculateExtrapolationBand(
  extrapolation: ReturnType<typeof calculateExtrapolation>,
): [number, number, number][] {
  if (extrapolation === null) {
    return [];
  }

  const points: [number, number][] = Array.isArray(extrapolation)
    ? extrapolation
    : [
        [extrapolation.from.ts, extrapolation.from.score],
        [extrapolation.to.ts, extrapolation.to.score],
      ];

  if (points.length === 0) {
    return [];
  }

  const anchorTs = points[0][0];
  const anchorScore = points[0][1];

  return points.map(([ts, score]): [number, number, number] => {
    const daysAhead = (ts - anchorTs) / dayInMs;
    const halfWidth = score * CONFORMAL_BAND_RATE_PER_DAY * daysAhead;

    return [
      ts,
      toOneDigit(Math.max(anchorScore, score - halfWidth)),
      toOneDigit(score + halfWidth),
    ];
  });
}

type ChartSeries =
  | SeriesLineOptions
  | SeriesScatterOptions
  | SeriesArearangeOptions;

/** Pushes a dashed extrapolation line plus its confidence band onto `options`. */
function pushExtrapolationSeries(
  options: ChartSeries[],
  extrapolation: ReturnType<typeof calculateExtrapolation>,
  config: {
    lineId: string;
    bandId: string;
    name: string;
    bandName: string;
    color: string;
  },
): void {
  if (extrapolation === null) {
    return;
  }

  const data: [number, number][] = Array.isArray(extrapolation)
    ? extrapolation
    : [
        [extrapolation.from.ts, extrapolation.from.score],
        [extrapolation.to.ts, extrapolation.to.score],
      ];

  // push the band first so the extrapolation line renders on top of it
  const band = calculateExtrapolationBand(extrapolation);

  if (band.length > 0) {
    options.push({
      type: "arearange",
      id: config.bandId,
      name: config.bandName,
      accessibility: {
        description:
          "Confidence band around the extrapolation; historically ~90% of outcomes landed within it.",
      },
      color: config.color,
      fillOpacity: 0.15,
      lineWidth: 0,
      data: band,
      marker: {
        enabled: false,
      },
      enableMouseTracking: false,
      visible: true,
    });
  }

  options.push({
    type: "line",
    id: config.lineId,
    name: config.name,
    accessibility: {
      description:
        "A projection of how the cutoff will evolve over time based on various parameters.",
    },
    color: config.color,
    data,
    dashStyle: "ShortDash",
    marker: {
      enabled: true,
      radius: 3,
      symbol: "triangle",
    },
    visible: true,
  });
}

export function calculateSeries(
  season: Season,
  data: Dataset[],
  extrapolation: ReturnType<typeof calculateExtrapolation>,
  extrapolationHistory: Awaited<
    ReturnType<typeof loadExtrapolationHistoryForSeason>
  >,
  extrapolation100: ReturnType<typeof calculateExtrapolation> = null,
): ChartSeries[] {
  const options: ChartSeries[] = [];

  if (season.crossFactionSupport !== "complete") {
    options.push(
      {
        type: "line",
        name: "Score Horde",
        id: "horde",
        color: colors.horde,
        data: data
          .filter((dataset) => dataset.faction === "horde")
          .map((dataset) => {
            return [dataset.ts, dataset.score];
          }),
      },
      {
        type: "line",
        name: "Score Alliance",
        id: "alliance",
        color: colors.alliance,
        data: data
          .filter((dataset) => dataset.faction === "alliance")
          .map((dataset) => {
            return [dataset.ts, dataset.score];
          }),
      },
    );
  }

  if (season.crossFactionSupport !== "none") {
    options.push({
      type: "line",
      name: "Score 0.1%",
      id: "score",
      color: colors.xFaction,
      data: data
        .filter((dataset) => !("faction" in dataset))
        .map((dataset) => {
          return [dataset.ts, dataset.score];
        }),
    });
  }

  pushExtrapolationSeries(options, extrapolation, {
    lineId: "extrapolation",
    bandId: "extrapolation-confidence",
    name: "Score Extrapolated",
    bandName: "Extrapolation Confidence",
    color: colors.extrapolation,
  });

  if (Array.isArray(extrapolationHistory) && extrapolationHistory.length > 0) {
    options.push({
      type: "scatter",
      id: "extrapolation-history",
      name: "Extrapolation History",
      color: colors.extrapolationHistory,
      accessibility: {
        description:
          "Series of data the score was expected to be at for a given point in time. Useful to compare how accurate prediction was.",
      },
      dashStyle: "Dot",
      marker: {
        enabled: true,
        radius: 2,
        symbol: "circle",
      },
      visible: false,
      data: extrapolationHistory,
    });
  }

  if (data.some((dataset) => dataset.score100 !== null)) {
    options.push({
      type: "line",
      name: "Score 1%",
      id: "score100",
      color: colors.top1,
      data: data
        .filter((dataset) => dataset.score100 !== null)
        .map((dataset) => {
          return [dataset.ts, dataset.score100];
        }),
    });

    pushExtrapolationSeries(options, extrapolation100, {
      lineId: "extrapolation-score100",
      bandId: "extrapolation-score100-confidence",
      name: "Score 1% Extrapolated",
      bandName: "Score 1% Confidence",
      color: colors.top1,
    });
  }

  {
    const charactersAboveCutoff = data
      .reduce<Dataset[]>((acc, dataset) => {
        if (dataset.rank === null) {
          return acc;
        }

        const prev = acc[acc.length - 1];

        if (prev?.rank !== dataset.rank) {
          acc.push(dataset);
        }

        return acc;
      }, [])
      .map((dataset) => [dataset.ts, dataset.rank]);

    if (charactersAboveCutoff.length > 0) {
      options.push({
        type: "line",
        name: "# Characters Above Cutoff",
        data: charactersAboveCutoff,
        color: "white",
        visible: false,
      });
    }
  }

  return options;
}

function createWeekDiffString(value: number, color: string): string {
  const prefix = value > 0 ? "+" : value === 0 ? "±" : "";
  return `<span style='font-size: 10px; color: ${color};'>${prefix}${value.toFixed(1)}</span>`;
}

export function calculateXAxisPlotBands(
  season: Season,
  region: Regions,
  data: Dataset[],
  overlays: readonly Overlay[],
): XAxisPlotBandsOptions[] {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return [];
  }

  const seasonEnd = season.endDates[region];
  const { affixes, crossFactionSupport, wcl } = season;

  let weeks: number;

  if (seasonEnd) {
    weeks = (seasonEnd - seasonStart) / oneWeekInMs + 1;
  } else {
    const hasExtrapolation = true;
    weeks =
      (Date.now() + (hasExtrapolation ? oneWeekInMs * 3 : 0) - seasonStart) /
        oneWeekInMs +
      1;
  }

  const now = Date.now();

  return Array.from({
    length: weeks,
  }).flatMap<XAxisPlotBandsOptions>((_, index) => {
    const options: XAxisPlotBandsOptions[] = [];

    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;
    const color = index % 2 === 0 ? "#4b5563" : "#1f2937";

    const rotation =
      affixes[index >= affixes.length ? index % affixes.length : index] ?? [];

    const relevantRotationSlice =
      // for future weeks early into a season without a full rotation, default to -1 // questionmarks
      from > now && affixes.length < 10
        ? [-1, -1, -1]
        : rotation.length === 3
          ? rotation
          : rotation.slice(0, 3);

    options.push({
      id: "background-color",
      from,
      to,
      color: from > now ? `${color}50` : color,
      label: {
        useHTML: true,
        style: {
          display: "flex",
        },
        text:
          (wcl?.zoneId ?? 0) < 39 && overlays.includes("affixes")
            ? relevantRotationSlice
                .map((affix) => {
                  return `<img width="18" height="18" style="transform: rotate(-90deg); opacity: 0.75;" src="${getAffixIconUrl(
                    affix,
                  )}"/>`;
                })
                .join("")
            : undefined,
        rotation: 90,
        align: "left",
        x: 5,
        y: 5,
      },
    });

    const { allianceDiff, hordeDiff, xFactionDiff, score100Diff } =
      calculateFactionDiffForWeek(
        data,
        crossFactionSupport,
        index === 0,
        from,
        to,
      );

    const text: string[] = [];

    if (crossFactionSupport !== "complete") {
      text.push(
        createWeekDiffString(hordeDiff, colors.horde),
        createWeekDiffString(allianceDiff, colors.alliance),
      );
    }

    if (
      from > now ||
      crossFactionSupport === "none" ||
      (crossFactionSupport === "partial" && xFactionDiff === 0)
    ) {
    } else {
      const xFactionStr = createWeekDiffString(xFactionDiff, colors.xFaction);
      const score100Str =
        score100Diff === 0
          ? ""
          : ` | ${createWeekDiffString(score100Diff, colors.top1)}`;
      text.push(xFactionStr + score100Str);
    }

    options.push({
      from,
      to,
      id: "weekly-difference",
      color: "transparent",
      label: {
        verticalAlign: "bottom",
        text: text.join("<br>"),
        useHTML: true,
        y: text.length * -15,
      },
    });

    return options.filter(
      (options): options is XAxisPlotBandsOptions => options !== null,
    );
  });
}

export function calculateYAxisPlotLines(
  season: Season,
  region: Regions,
): YAxisPlotLinesOptions[] {
  const cutoffs = season.confirmedCutoffs[region];

  if ("alliance" in cutoffs && "horde" in cutoffs) {
    return [
      {
        label: {
          text: `Confirmed cutoff for Alliance at ${cutoffs.alliance}`,
          rotation: 0,
          style: { color: colors.alliance },
        },
        value: cutoffs.alliance,
        dashStyle: "Dash",
      },
      {
        label: {
          text: `Confirmed cutoff for Horde at ${cutoffs.horde}`,
          rotation: 0,
          style: { color: colors.horde },
        },
        value: cutoffs.horde,
        dashStyle: "Dash",
      },
    ];
  }

  if (cutoffs.score === 0) {
    return [];
  }

  return [
    {
      label: {
        text: `Confirmed cutoff at ${cutoffs.score}`,
        rotation: 0,
        style: { color: colors.xFaction },
      },
      value: cutoffs.score,
      dashStyle: "Dash",
    },
  ];
}

export function calculateXAxisPlotLines(
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: ReturnType<typeof calculateExtrapolation>,
  overlays: readonly Overlay[],
): XAxisPlotLinesOptions[] {
  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  const lines: XAxisPlotLinesOptions[] = [];

  if (overlays.includes("patches")) {
    Object.entries(season.patches).forEach(([description, regionalData]) => {
      const timestamp = regionalData[region];

      lines.push({
        zIndex: 100,
        label: {
          text: description,
          rotation: 0,
          y: 100,
          style: {
            color: "orange",
          },
        },
        value: timestamp,
        dashStyle: "Dash",
        color: "orange",
      });
    });
  }

  if (overlays.includes("dungeonHotfixes")) {
    Object.entries(season.dungeonHotfixes).forEach(
      ([description, regionalData]) => {
        const timestamp = regionalData[region];

        lines.push({
          zIndex: 100,
          label: {
            text: description,
            rotation: 0,
            y: 75,
            style: {
              color: "yellow",
            },
          },
          value: timestamp,
          dashStyle: "Dash",
          color: "yellow",
        });
      },
    );
  }

  if (endDate) {
    lines.push({
      zIndex: 100,
      label: {
        text: "Season End",
        rotation: 0,
        x: -75,
        y: 225,
        style: {
          color: "red",
        },
      },
      value: endDate,
      color: "red",
      dashStyle: "Dash",
    });
  }

  // since the score computation is partially season dependant, dont bother for older seasons
  if (
    overlays.includes("levelCompletion") &&
    season.crossFactionSupport === "complete" &&
    (season.wcl?.zoneId ?? 0) >= 32 &&
    data.length > 0 &&
    startDate
  ) {
    if ((season.wcl?.zoneId ?? 0) < 37) {
      lines.push(
        ...calcOldLevelCompletionLines(season, data, startDate, extrapolation),
      );
    } else if ((season.wcl?.zoneId ?? 0) === 39) {
      lines.push(
        ...calcTwwS1LevelCompletionLines(
          season,
          data,
          startDate,
          extrapolation,
        ),
      );
    } else if ((season.wcl?.zoneId ?? 0) >= 43) {
      lines.push(
        ...calcTwwS2LevelCompletionLines(
          season,
          data,
          startDate,
          extrapolation,
        ),
      );
    }
  }

  if (startDate) {
    const end = endDate ?? Date.now();

    for (let i = startDate; i <= end; i += oneWeekInMs) {
      const weeksSinceStart = Math.round((i - startDate) / oneWeekInMs) + 1;

      lines.push({
        zIndex: 100,
        id: "week-number",
        label: {
          text: `W${weeksSinceStart}`,
          align: "center",
          rotation: 0,
          y: 15,
          x: 25,
          style: {
            color: "lightgreen",
          },
        },
        color: "transparent",
        value: i,
      });

      if (weeksSinceStart === 1) {
        continue;
      }

      const match = data.find((dataset) => dataset.ts >= i);

      if (match) {
        lines.push({
          zIndex: 100,
          label: {
            text: `${match.score}`,
            align: "center",
            rotation: 0,
            y: 265,
            style: {
              color: "lightgreen",
            },
          },
          color: "transparent",
          value: i,
        });
      }
    }
  }

  return lines;
}

export function setCookie(
  key: string,
  value?: string | null,
  maxAge?: number,
): string {
  return `${key}=${value ?? ""}; Max-Age=${maxAge ?? 0}`;
}

export type Timings = Record<
  string,
  { desc?: string; type: string; time: number }[]
>;

export function getServerTimeHeader(timings: Timings): string {
  return Object.entries(timings)
    .map(([key, timingInfos]) => {
      const dur = timingInfos
        .reduce((acc, timingInfo) => acc + timingInfo.time, 0)
        .toFixed(1);
      const desc = timingInfos
        .map((t) => t.desc)
        .filter(Boolean)
        .join(" & ");
      return [
        key.replaceAll(/([ ,:;=@])/gu, "_"),
        desc ? `desc=${JSON.stringify(desc)}` : null,
        `dur=${dur}`,
      ]
        .filter(Boolean)
        .join(";");
    })
    .join(",");
}

export async function time<ReturnType>(
  fn: Promise<ReturnType> | (() => ReturnType | Promise<ReturnType>),
  {
    type,
    desc,
    timings,
  }: {
    type: string;
    desc?: string;
    timings?: Timings;
  },
): Promise<ReturnType> {
  const start = performance.now();
  const promise = typeof fn === "function" ? fn() : fn;
  if (!timings) {
    return promise;
  }
  const result = await promise;
  let timingType = timings[type];
  if (!timingType) {
    // eslint-disable-next-line no-multi-assign
    timingType = timings[type] = [];
  }

  timingType.push({ desc, type, time: performance.now() - start });
  return result;
}

function calculateFactionDiffForWeek(
  data: Dataset[],
  crossFactionSupport: Season["crossFactionSupport"],
  isFirstWeek: boolean,
  from: number,
  to: number,
): {
  hordeDiff: number;
  allianceDiff: number;
  xFactionDiff: number;
  score100Diff: number;
} {
  const hasCompleteXFactionSupport = crossFactionSupport === "complete";
  const thisWeeksData = data.filter(
    (dataset) => dataset.ts >= from && dataset.ts <= to,
  );

  let horde: Dataset[];
  let alliance: Dataset[];
  let hordeEndMatch = null;
  let hordeStartMatch = null;
  let allianceEndMatch = null;
  let allianceStartMatch = null;
  let xFactionEndMatch = null;
  let xFactionStartMatch = null;

  if (hasCompleteXFactionSupport) {
    xFactionEndMatch = thisWeeksData[thisWeeksData.length - 1];
    xFactionStartMatch = thisWeeksData[0];
  } else {
    horde = thisWeeksData.filter((dataset) => dataset.faction === "horde");
    alliance = thisWeeksData.filter(
      (dataset) => dataset.faction === "alliance",
    );

    hordeEndMatch = [...horde].reverse()[0];
    hordeStartMatch = horde[0];
    allianceEndMatch = [...alliance].reverse()[0];
    allianceStartMatch = alliance[0];

    if (crossFactionSupport === "partial") {
      xFactionEndMatch = [...thisWeeksData]
        .reverse()
        .find((dataset) => !dataset.faction);
      xFactionStartMatch = thisWeeksData.find((dataset) => !dataset.faction);
    }
  }

  const score100Data = thisWeeksData.filter(
    (dataset) => dataset.score100 !== null,
  );
  const score100StartMatch = score100Data[0];
  const score100EndMatch = score100Data[score100Data.length - 1];

  let hordeDiff = 0;
  let allianceDiff = 0;
  let xFactionDiff = 0;
  let score100Diff = 0;

  if (hordeEndMatch && hordeStartMatch) {
    hordeDiff =
      hordeEndMatch.score -
      (isFirstWeek && hordeStartMatch === data[0] ? 0 : hordeStartMatch.score);
  }

  if (allianceEndMatch && allianceStartMatch) {
    allianceDiff =
      allianceEndMatch.score -
      (isFirstWeek && allianceStartMatch === data[0]
        ? 0
        : allianceStartMatch.score);
  }

  if (xFactionEndMatch && xFactionStartMatch) {
    xFactionDiff =
      xFactionEndMatch.score -
      (isFirstWeek && xFactionStartMatch === data[0]
        ? 0
        : xFactionStartMatch.score);
  }

  if (score100EndMatch && score100StartMatch) {
    const firstScore100InData = data.find((d) => d.score100 !== null);
    score100Diff =
      score100EndMatch.score100! -
      (isFirstWeek && score100StartMatch === firstScore100InData
        ? 0
        : score100StartMatch.score100!);
  }

  return {
    hordeDiff,
    allianceDiff,
    xFactionDiff,
    score100Diff,
  };
}

function calcTwwS2LevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: ReturnType<typeof calculateExtrapolation>,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 125;
  const perLevelPoints = 15;

  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  for (let level = 5; level <= 25; level++) {
    let affixPoints = 0;

    if (level >= 7) {
      affixPoints += 15;
    }

    if (level >= 10) {
      affixPoints += 15;
    }

    if (level >= 4 && level <= 11) {
      affixPoints += 15;
    }

    if (level >= 12) {
      affixPoints += 30;
    }

    const total =
      (base + perLevelPoints * level + affixPoints) * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => dataset.score >= total);

    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= total,
      );

      if (extrapolationMatchIndex > -1) {
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        if (extrapolationMatch[1] === total) {
          match = {
            ts: extrapolationMatch[0],
            score: total,
          };
        } else {
          const last = data[data.length - 1];
          const timeDiff = extrapolationMatch[0] - last.ts;
          const scoreDiff = extrapolationMatch[1] - last.score;

          const step = scoreDiff / timeDiff;

          // expensive, but a lot more precise than just picking next match
          for (let i = 0; i <= timeDiff; i += 60_000) {
            if (last.score + step * i >= total) {
              match = {
                ts: last.ts + i,
                score: total,
              };
              break;
            }
          }
        }
      }
    }

    if (match) {
      lines.push({
        zIndex: 100,
        label: {
          text: `All ${level}`,
          rotation: 0,
          y: 200,
          style: {
            color: "white",
          },
        },
        value: match.ts,
        dashStyle: "Dash",
        color: "white",
      });
    }
  }

  return lines;
}

// TODO: merge these eventually
function calcTwwS1LevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: ReturnType<typeof calculateExtrapolation>,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 125;
  const perLevelPoints = 15;

  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  for (let level = 5; level <= 20; level++) {
    let affixPoints = 0;

    if (level >= 4) {
      affixPoints += 10;
    }

    if (level >= 10) {
      affixPoints += 10;
    }

    if (level >= 7) {
      affixPoints += 15;
    }

    if (level >= 2 && level <= 11) {
      affixPoints += 10;
    }

    if (level >= 12) {
      affixPoints += 25;
    }

    const total =
      (base + perLevelPoints * level + affixPoints) * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => {
        if (dataset.ts - startDate < oneWeekInMs) {
          return dataset.score >= total;
        }

        return false;
      });

    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= total,
      );

      if (extrapolationMatchIndex > -1) {
        const last = data[data.length - 1];
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        const timeDiff = extrapolationMatch[0] - last.ts;
        const scoreDiff = extrapolationMatch[1] - last.score;

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (last.score + step * i > total) {
            match = {
              ts: last.ts + i,
              score: total,
            };
            break;
          }
        }
      }
    }

    if (match) {
      lines.push({
        zIndex: 100,
        label: {
          text: `All ${level}`,
          rotation: 0,
          y: 200,
          style: {
            color: "white",
          },
        },
        value: match.ts,
        dashStyle: "Dash",
        color: "white",
      });
    }
  }

  return lines;
}

function calcOldLevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: ReturnType<typeof calculateExtrapolation>,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 25;
  const affixPoints = 25;

  const startLevel = 15;
  const endLevel = 23;
  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  // calculate thresholds for week 1 separeately in order to show low key levels again across both weeks
  for (let level = startLevel; level <= endLevel; level++) {
    const levelPoints = 5 * level + (level - (level > 10 ? 10 : 0)) * 2;
    const total = base + levelPoints + affixPoints;
    // week 1 naturally has only 1 affix set
    const firstWeek = total * 1.5 * numberOfDungeons;

    const match: Omit<Dataset, "rank"> | undefined = data.find((dataset) => {
      if (dataset.ts - startDate < oneWeekInMs) {
        return dataset.score >= firstWeek;
      }

      return false;
    });

    if (match) {
      lines.push({
        zIndex: 100,
        label: {
          text: `All ${level}`,
          rotation: 0,
          y: 200,
          style: {
            color: "white",
          },
        },
        value: match.ts,
        dashStyle: "Dash",
        color: "white",
      });
    }
  }

  for (let level = startLevel + 1; level <= 35; level++) {
    const levelPoints = 5 * level + (level - (level > 10 ? 10 : 0)) * 2;

    const total = base + levelPoints + affixPoints;

    const set1 = total * 1.5; // basically tyrannical only
    const set2 = total * 0.5; // fort

    // week 1 naturally has only 1 affix set
    const bothWeeks = set1 + set2;
    const allDungeonsBothWeeks = bothWeeks * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => {
        return dataset.score >= allDungeonsBothWeeks;
      });

    // if we have an extrapolation, check whether a key level threshold is
    // reached during the extrapolation window
    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= allDungeonsBothWeeks,
      );

      if (extrapolationMatchIndex > -1) {
        const last = data[data.length - 1];
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        const timeDiff = extrapolationMatch[0] - last.ts;
        const scoreDiff = extrapolationMatch[1] - last.score;

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (last.score + step * i > allDungeonsBothWeeks) {
            match = {
              ts: last.ts + i,
              score: allDungeonsBothWeeks,
            };
            break;
          }
        }
      }
    }

    if (match) {
      lines.push({
        zIndex: 100,
        label: {
          text: `All ${level}`,
          rotation: 0,
          y: 200,
          style: {
            color: "white",
          },
        },
        value: match.ts,
        dashStyle: "Dash",
        color: "white",
      });
    }
  }

  return lines;
}

export async function protectCronRoute(request: Request): Promise<null | {
  status: number;
  payload: Record<string, string>;
}> {
  if (env.NODE_ENV === "production") {
    const body = await request.text();
    const payload = JSON.parse(body);

    const secret = env.SECRET;

    if (!secret) {
      return { payload: { error: "secret missing" }, status: 500 };
    }

    const maybeSecret = payload.secret;

    if (!maybeSecret || secret !== maybeSecret) {
      return { payload: { error: "secret missing" }, status: 204 };
    }

    return null;
  }
  console.info("Skipping verification of secret.");
  return null;
}
