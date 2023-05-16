import { Regions } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { type XAxisPlotLinesOptions } from "highcharts";

import { env } from "~/env/server";

import { prisma } from "./prisma.server";
import { type Dataset, type EnhancedSeason, type Season } from "./seasons";
import { type Overlay, searchParamSeparator } from "./utils";
import {
  calculateFactionDiffForWeek,
  orderedRegionsBySize,
  overlays,
} from "./utils";

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

const getCrossFactionHistory = (
  region: Regions,
  gte: number | null,
  lte?: number
) => {
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
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

const getHistory = (region: Regions, gte: number | null, lte?: number) => {
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
};

const setupRedisProviders = () => {
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
};

export const loadDataForRegion = async (
  region: Regions,
  season: Season,
  timings: Timings
): Promise<Dataset[]> => {
  const gte = season.startDates[region];
  const lte = season.endDates[region] ?? undefined;
  const key = [season.slug, region].join(searchParamSeparator);

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
      { type: `getHistory-${region}`, timings }
    ),
    time(
      () =>
        season.crossFactionSupport === "none"
          ? []
          : getCrossFactionHistory(region, gte, lte),
      { type: `getCrossFactionHistory-${region}`, timings }
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
          };

          if ("faction" in dataset) {
            next.faction = dataset.faction;
          }

          return next;
        })
        .filter((dataset) => {
          return dataset.score > 0;
        })
        .sort((a, b) => a.ts - b.ts),
    { type: `normalizeDatasets-${region}`, timings }
  );

  await time(
    () =>
      persist(
        datasets,
        key,
        determineExpirationTimestamp(season, region, datasets)
      ),
    { type: `persist-${region}`, timings }
  );

  return datasets;
};

export const determineExpirationTimestamp = (
  season: Season,
  region: Regions,
  datasets: Dataset[]
): number => {
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
};

export const determineRegionsToDisplayFromSearchParams = (
  request: Request
): Regions[] | null => {
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
};

export const determineExtrapolationEnd = (request: Request): number | null => {
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
};

export const calculateExtrapolation = (
  season: Season,
  region: Regions,
  data: Dataset[],
  endOverride: number | null
):
  | null
  | [number, number][]
  | { from: Omit<Dataset, "rank">; to: Omit<Dataset, "rank"> } => {
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
    region
  );

  if (!firstRelevantDataset) {
    return null;
  }

  const weeks = seasonEnding ? (seasonEnding - seasonStart) / oneWeekInMs : 36;

  const passedWeeksDiff = Array.from({ length: weeks }, (_, index) => {
    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;

    return calculateFactionDiffForWeek(
      data,
      season.crossFactionSupport,
      index === 0,
      from,
      to
    ).xFactionDiff;
  })
    .filter(Boolean)
    .slice(4);

  const daysUntilSeasonEndingOrFourWeeks = daysUntilSeasonEnding ?? 21;
  const to =
    seasonEnding ??
    lastDataset.ts + (daysUntilSeasonEndingOrFourWeeks / 7) * oneWeekInMs;
  const timeUntilExtrapolationEnd = to - lastDataset.ts;

  // given a couple weeks past the first four, apply weighting on older weeks
  if (
    passedWeeksDiff.length >= 4 &&
    timeUntilExtrapolationEnd > oneWeekInMs / 7
  ) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrFourWeeks;
    const scoreIncreaseSteps =
      passedWeeksDiff.reduce((acc, diff, index) => {
        // looking at week 5 in week 10 means its 5 weeks ago, applying a weight of 0.5
        // looking at week 10 in week 10 means its the current week, applying a weight of 1
        const factor = 1 - (passedWeeksDiff.length - index - 1) / 10;
        return acc + diff * (factor > 0 ? factor : 0.1);
      }) /
      passedWeeksDiff.length /
      7;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrFourWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        }
      ),
      [
        to,
        toOneDigit(
          lastDataset.score +
            scoreIncreaseSteps * daysUntilSeasonEndingOrFourWeeks
        ),
      ],
    ];
  }

  const timePassed = lastDataset.ts - firstRelevantDataset.ts;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;
  const factor = daysUntilSeasonEndingOrFourWeeks / daysPassed;

  const score = toOneDigit(
    lastDataset.score +
      (lastDataset.score - firstRelevantDataset.score) * factor
  );

  if (timeUntilExtrapolationEnd > oneWeekInMs / 7) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrFourWeeks;
    const scoreIncreaseSteps =
      (score - lastDataset.score) / daysUntilSeasonEndingOrFourWeeks;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrFourWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        }
      ),
      [to, score],
    ];
  }

  return {
    from: lastDataset,
    to: {
      score,
      ts: to,
    },
  };
};

const determineExtrapolationStart = (
  data: Dataset[],
  season: Season,
  region: Regions
): Dataset | null => {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return null;
  }

  const firstDataset = data.find((dataset) => {
    return dataset.ts >= seasonStart + 4 * oneWeekInMs;
  });

  return firstDataset ?? null;
};

const toOneDigit = (int: number) => {
  return Number.parseFloat(int.toFixed(1));
};

export const calculateZoom = (
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: EnhancedSeason["extrapolation"]["eu"]
): [number, number] => {
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
      daysUntilSeasonEnding < 1
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
};

export const determineOverlaysToDisplayFromSearchParams = (
  request: Request
): Overlay[] | null => {
  const params = new URL(request.url).searchParams;

  const maybeOverlays = params.get("overlays");

  if (!maybeOverlays) {
    return null;
  }

  const fromSearchParams = maybeOverlays.split(searchParamSeparator);

  return overlays.filter((plotline) => fromSearchParams.includes(plotline));
};

export const determineOverlaysToDisplayFromCookies = (
  request: Request
): Overlay[] | null => {
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
      values.includes(overlay)
    );
    return filteredOverlays.length > 0 ? filteredOverlays : null;
  } catch {
    return null;
  }
};

export const determineRegionsToDisplayFromCookies = (
  request: Request
): Regions[] | null => {
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
      values.includes(region)
    );
    return filteredRegions.length > 0 ? filteredRegions : null;
  } catch {
    return null;
  }
};

export const calculateXAxisPlotLines = (
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: ReturnType<typeof calculateExtrapolation>,
  overlays: readonly Overlay[]
): XAxisPlotLinesOptions[] => {
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
      }
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
    for (let level = 16; level <= 35; level++) {
      const base = 25;
      const levelPoints = 5 * level + (level - 10) * 2;
      const affixPoints = 25;

      const total = base + levelPoints + affixPoints;

      const set1 = total * 1.5; // basically tyrannical only
      const set2 = total * 0.5; // fort

      // week 1 naturally has only 1 affix set
      const tyrannicalAndFortified = set1 + set2;
      const allDungeons = tyrannicalAndFortified * season.dungeons;

      let match: Omit<Dataset, "rank"> | undefined = data.find((dataset) => {
        if (dataset.ts - startDate < oneWeekInMs) {
          return dataset.score >= set1 * season.dungeons;
        }

        return dataset.score >= allDungeons;
      });

      // if we have an extrapolation, check whether a key level threshold is
      // reached during the extrapolation window
      if (!match && Array.isArray(extrapolation)) {
        const extrapolationMatchIndex = extrapolation.findIndex(
          ([, score]) => score >= allDungeons
        );

        if (extrapolationMatchIndex > -1) {
          const last = data[data.length - 1];
          const extrapolationMatch = extrapolation[extrapolationMatchIndex];

          const timeDiff = extrapolationMatch[0] - last.ts;
          const scoreDiff = extrapolationMatch[1] - last.score;

          const step = scoreDiff / timeDiff;

          // expensive, but a lot more precise than just picking next match
          for (let i = 0; i < timeDiff; i += 60_000) {
            if (last.score + step * i > allDungeons) {
              match = {
                ts: last.ts + i,
                score: allDungeons,
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
  }

  return lines;
};

export const setCookie = (
  key: string,
  value?: string | null,
  maxAge?: number
): string => {
  return `${key}=${value ?? ""}; Max-Age=${maxAge ?? 0}`;
};

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
  }
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
