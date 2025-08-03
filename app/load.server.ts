import { Regions } from "@prisma/client";
import { Redis } from "@upstash/redis";
import {
  type SeriesLineOptions,
  type XAxisPlotBandsOptions,
  type XAxisPlotLinesOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";

import { env } from "~/env/server";

import { getAffixIconUrl } from "./affixes";
import { dungeonSlugMetaMap } from "./dungeons";
import { prisma } from "./prisma.server";
import { type Dataset, type EnhancedSeason, type Season } from "./seasons";
import { type Overlay, searchParamSeparator } from "./utils";
import { orderedRegionsBySize, overlays } from "./utils";

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

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
          // @ts-expect-error doesn't matter
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
  | { from: Omit<Dataset, "rank">; to: Omit<Dataset, "rank"> } {
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

  const weeks = seasonEnding ? (seasonEnding - seasonStart) / oneWeekInMs : 36;

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

  // given a couple weeks past the first four, apply weighting on older weeks
  if (
    passedWeeksDiff.length >= 4 &&
    timeUntilExtrapolationEnd > oneWeekInMs / 7
  ) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrThreeWeeks;
    const scoreIncreaseSteps =
      [...passedWeeksDiff].reverse().reduce((acc, diff, index, arr) => {
        // applies a <1 factor on the total increase a week saw based on how far
        // it was in the past. e.g. the current week should never be penalized
        // as its most indicative of the near future development. however, the
        // further the week is in the past, the less relevant we consider it due
        // to:
        // - gearing
        // - dungeon and class tuning
        // - routes developing
        // - simple experience
        // - meta development
        // - tech discoveries
        // the downside of it is naturally, it's never aware of affix set
        // dynamics, e.g. multiple bad weeks in a row will skew prediction if
        // there's good weeks coming up.

        const factor =
          index === 0 ? 1 : 1 - (1 - 0.5) * (index / (arr.length - 1)) ** 1.5;

        return acc + diff * factor;
      }, 0) /
      passedWeeksDiff.length /
      7;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrThreeWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        },
      ),
      [
        to,
        toOneDigit(
          lastDataset.score +
            scoreIncreaseSteps * daysUntilSeasonEndingOrThreeWeeks,
        ),
      ],
    ];
  }

  const timePassed = lastDataset.ts - firstRelevantDataset.ts;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;
  const factor = daysUntilSeasonEndingOrThreeWeeks / daysPassed;

  const score = toOneDigit(
    lastDataset.score +
      (lastDataset.score - firstRelevantDataset.score) * factor,
  );

  if (timeUntilExtrapolationEnd > oneWeekInMs / 7) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrThreeWeeks;
    const scoreIncreaseSteps =
      (score - lastDataset.score) / daysUntilSeasonEndingOrThreeWeeks;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrThreeWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        },
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

  const fromSearchParams = maybeOverlays.split(searchParamSeparator);

  return overlays.filter((plotline) => fromSearchParams.includes(plotline));
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

const factionColors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#EEE7D8",
  extrapolation: "#C8BEAE50",
} as const;

export function calculateSeries(
  season: Season,
  data: Dataset[],
  extrapolation: ReturnType<typeof calculateExtrapolation>,
): SeriesLineOptions[] {
  const options: SeriesLineOptions[] = [];

  if (season.crossFactionSupport !== "complete") {
    options.push(
      {
        type: "line",
        name: "Score Horde",
        color: factionColors.horde,
        data: data
          .filter((dataset) => dataset.faction === "horde")
          .map((dataset) => {
            return [dataset.ts, dataset.score];
          }),
      },
      {
        type: "line",
        name: "Score Alliance",
        color: factionColors.alliance,
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
      name: "Score X-Faction",
      color: factionColors.xFaction,
      data: data
        .filter((dataset) => !("faction" in dataset))
        .map((dataset) => {
          return [dataset.ts, dataset.score];
        }),
    });
  }

  if (extrapolation !== null) {
    options.push({
      type: "line",
      name: "Score Extrapolated",
      color: factionColors.extrapolation,
      data: Array.isArray(extrapolation)
        ? extrapolation
        : [
            [extrapolation.from.ts, extrapolation.from.score],
            [extrapolation.to.ts, extrapolation.to.score],
          ],
      dashStyle: "ShortDash",
      marker: {
        enabled: true,
      },
      visible: true,
    });
  }

  options.push({
    type: "line",
    name: "Characters above Cutoff (default hidden)",
    data: data
      .filter((dataset) => dataset.rank !== null)
      .map((dataset) => [dataset.ts, dataset.rank]),
    color: "white",
    visible: false,
  });

  return options;
}

function createWeekDiffString(value: number, color: string): string {
  const prefix = value > 0 ? "+" : value === 0 ? "±" : "";
  return `<span style='font-size: 10px; color: ${color}'>${prefix}${value.toFixed(1)}</span>`;
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

  let weeks = affixes.length * 3;

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

    const { allianceDiff, hordeDiff, xFactionDiff } =
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
        createWeekDiffString(hordeDiff, factionColors.horde),
        createWeekDiffString(allianceDiff, factionColors.alliance),
      );
    }

    if (
      from > now ||
      crossFactionSupport === "none" ||
      (crossFactionSupport === "partial" && xFactionDiff === 0)
    ) {
    } else {
      text.push(createWeekDiffString(xFactionDiff, factionColors.xFaction));
    }

    options.push({
      from,
      to,
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
          style: { color: factionColors.alliance },
        },
        value: cutoffs.alliance,
        dashStyle: "Dash",
      },
      {
        label: {
          text: `Confirmed cutoff for Horde at ${cutoffs.horde}`,
          rotation: 0,
          style: { color: factionColors.horde },
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
        style: { color: factionColors.xFaction },
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

      if (weeksSinceStart === 1) {
        continue;
      }

      const match = data.find((dataset) => dataset.ts >= i);

      if (match) {
        lines.push(
          {
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
          },
          {
            zIndex: 100,
            label: {
              text: `Week ${weeksSinceStart}`,
              align: "center",
              rotation: 0,
              y: 15,
              style: {
                color: "lightgreen",
              },
            },
            color: "transparent",
            value: i,
          },
        );
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
): { hordeDiff: number; allianceDiff: number; xFactionDiff: number } {
  const hasCompleteXFactionSupport = crossFactionSupport === "complete";
  const thisWeeksData = data.filter(
    (dataset) => dataset.ts >= from && dataset.ts <= to,
  );

  let horde = [];
  let alliance = [];
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

  let hordeDiff = 0;
  let allianceDiff = 0;
  let xFactionDiff = 0;

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

  return {
    hordeDiff,
    allianceDiff,
    xFactionDiff,
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

    let match: Omit<Dataset, "rank"> | undefined = data.find(
      (dataset) => dataset.score >= total,
    );

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

    let match: Omit<Dataset, "rank"> | undefined = data.find((dataset) => {
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

    let match: Omit<Dataset, "rank"> | undefined = data.find((dataset) => {
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
