import { Regions } from "prisma/generated/prisma/enums";

import { env } from "~/env/server";

import { calculateFactionDiffForWeek, toOneDigit } from "./chart/builders";
import { type Dataset, type Season } from "./seasons";
import { type Overlay, searchParamSeparator } from "./utils";
import { overlays } from "./utils";

const dayInMs = 24 * 60 * 60 * 1000;
const oneWeekInMs = 7 * dayInMs;

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
      from: Omit<Dataset, "score100">;
      to: Omit<Dataset, "score100">;
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

export function determineOverlaysToDisplayFromSearchParams(
  request: Request,
): Overlay[] | null {
  const params = new URL(request.url).searchParams;

  const maybeOverlays = params.get("overlays");

  // Absent param ⇒ default (all overlays); present-but-empty (`?overlays=`) ⇒
  // explicit none. See `parseOverlaysFromSearchParams` for the rationale.
  if (maybeOverlays === null) {
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
