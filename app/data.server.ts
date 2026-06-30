/**
 * Server-only data layer: owns the DB reads and the era-merge in one
 * place, then assembles the compact `SeasonData` wire payload — loads the
 * per-region `Dataset[]`, runs the (server-side, regression-guarded)
 * extrapolation, columnar-encodes the points and computes the cache headers.
 *
 * The merge of the legacy `history` (faction) + modern `crossFactionHistory`
 * eras, the Redis cache and the per-region dedupe live here now (moved out of
 * `load.server.ts`, which keeps only the extrapolation math + request/cookie
 * helpers). The derived presentation (series/plotBands/plotLines/blueprint) is
 * not built here — the browser rebuilds it from `decode()` + the bundled season
 * config via `app/chart/assemble.ts`.
 */
import { Redis } from "@upstash/redis";
import { type Regions } from "prisma/generated/prisma/enums";

import { env } from "~/env/server";

import { type RecordSeries, type ScatterPoint } from "./chart/types";
import {
  encodeSeries,
  type ExtrapolationHistoryTuple,
  type RegionPayload,
  type SeasonData,
} from "./data";
import { dungeonSlugMetaMap } from "./dungeons";
import {
  calculateExtrapolation,
  determineExtrapolationEnd,
  time,
  type Timings,
} from "./load.server";
import { prisma } from "./prisma.server";
import {
  type Dataset,
  hasSeasonEndedForAllRegions,
  type Season,
} from "./seasons";
import { isNotNull, orderedRegionsBySize, searchParamSeparator } from "./utils";

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";
const expires = "Expires";

type AssembleSeasonDataParams = {
  request: Request;
  regions: Regions[] | null;
  season: Season;
  timings: Timings;
};

type AssembleSeasonDataResult = {
  /** The primary region's payload, ready to paint. Secondary regions are absent
   * from `data.regions` — they stream in via `regionsPromise`. */
  data: SeasonData;
  /** The secondary regions' payloads, loaded lazily and streamed to the client
   * via <Await> (the JSON API path awaits it). Keyed by region; a region with no
   * data is omitted, mirroring the primary path. */
  regionsPromise: Promise<Partial<Record<Regions, RegionPayload>>>;
  /** Dungeon records, loaded lazily and streamed to the client via <Await>
   * (the JSON API path awaits it). `data.records` stays empty on the wire. */
  recordsPromise: Promise<SeasonData["records"]>;
  headers: Record<string, string>;
};

/**
 * Loads one region's `Dataset[]`, runs its extrapolation(s) and columnar-encodes
 * it into a `RegionPayload`. `payload` is `null` when the region has no data (the
 * caller omits it from the wire). Shared by the synchronous primary path and the
 * streamed secondary path in `assembleSeasonData`.
 */
async function loadRegionPayload(
  region: Regions,
  season: Season,
  extrapolationEnd: number | null,
  timings: Timings,
): Promise<{ data: Dataset[]; payload: RegionPayload | null }> {
  const [data, extrapolationHistory] = await Promise.all([
    loadDataForRegion(region, season, timings),
    time(() => loadExtrapolationHistoryForSeason(season, region), {
      type: `loadExtrapolationHistoryForSeason-${region}`,
      timings,
    }),
  ]);

  if (data.length === 0) {
    return { data, payload: null };
  }

  const extrapolation = await time(
    () => calculateExtrapolation(season, region, data, extrapolationEnd),
    { type: `calculateExtrapolation-${region}`, timings },
  );

  // top 1% extrapolation is calculated for display only - never persisted
  const extrapolation100 = await time(
    () => {
      const data100 = data
        .filter((dataset) => dataset.score100 !== null && dataset.score100 > 0)
        .map((dataset) => ({ ...dataset, score: dataset.score100! }));

      return data100.length > 0
        ? calculateExtrapolation(season, region, data100, extrapolationEnd)
        : null;
    },
    { type: `calculateExtrapolation100-${region}`, timings },
  );

  const payload: RegionPayload = {
    series: encodeSeries(data),
    extrapolation,
    extrapolation100,
    extrapolationHistory: extrapolationHistory
      .filter(isNotNull)
      .map(
        ({ x, y, estimatedAt }): ExtrapolationHistoryTuple => [
          x,
          y,
          estimatedAt ?? 0,
        ],
      ),
  };

  return { data, payload };
}

export async function assembleSeasonData({
  request,
  regions: pRegions,
  season,
  timings,
}: AssembleSeasonDataParams): Promise<AssembleSeasonDataResult> {
  const headers: Record<string, string> = {};

  if (hasSeasonEndedForAllRegions(season.slug)) {
    const thirtyDays = 30 * 24 * 60 * 60;
    headers[cacheControl] =
      `public, max-age=${thirtyDays}, s-maxage=${thirtyDays}, immutable`;
  }

  const extrapolationEnd = await time(
    () => determineExtrapolationEnd(request),
    { type: "determineExtrapolationEnd", timings },
  );

  const regions = pRegions ?? orderedRegionsBySize;
  const [primaryRegion, ...secondaryRegions] = regions;

  // Dungeon records feed only the secondary DungeonRecords chart, so load them
  // as a promise the loader streams in via <Await> rather than blocking first
  // paint on the dungeonHistory query. The JSON API path awaits it instead.
  const recordsPromise = loadRecordsForSeason(season);

  // The primary (first selected) region resolves synchronously so the loader can
  // return and the chart paints; the remaining regions stream in via <Await>.
  // Biggest win on multi-region views / slow regions (CN/TW). See gains.md #2.
  const primary = await time(
    () => loadRegionPayload(primaryRegion, season, extrapolationEnd, timings),
    { type: `loadRegionPayload-${primaryRegion}`, timings },
  );

  const regionPayloads: Partial<Record<Regions, RegionPayload>> = {};

  if (primary.payload) {
    regionPayloads[primaryRegion] = primary.payload;
  }

  // Secondary regions are loaded off the response's critical path. Their `time()`
  // entries land after `getServerTimeHeader` snapshots `timings`, so they won't
  // show in Server-Timing — that's the cost of streaming them.
  const loadSecondaryRegions = async (): Promise<
    Partial<Record<Regions, RegionPayload>>
  > => {
    const entries = await Promise.all(
      secondaryRegions.map(async (region) => {
        const { payload } = await loadRegionPayload(
          region,
          season,
          extrapolationEnd,
          timings,
        );

        return [region, payload] as const;
      }),
    );

    const out: Partial<Record<Regions, RegionPayload>> = {};

    for (const [region, payload] of entries) {
      if (payload) {
        out[region] = payload;
      }
    }

    return out;
  };

  const regionsPromise = loadSecondaryRegions();

  // Cache headers reflect the primary region only — all regions share the same
  // ~5-min cron cadence, so its freshness window is representative, and awaiting
  // every region here would defeat the streaming.
  const mostRecentDataset = primary.data.reduce(
    (acc, dataset) => (acc > dataset.ts ? acc : dataset.ts),
    0,
  );

  headers[lastModified] = new Date(mostRecentDataset).toUTCString();

  const shortestExpiry = determineExpirationTimestamp(
    season,
    primaryRegion,
    primary.data,
  );

  headers[expires] = new Date(shortestExpiry * 1000 + Date.now()).toUTCString();
  headers[eTag] = [season.slug, mostRecentDataset, extrapolationEnd, ...regions]
    .filter(isNotNull)
    .sort((a, b) => (a > b ? 1 : -1))
    .join("-");

  const data: SeasonData = {
    slug: season.slug,
    regionsToDisplay: regions,
    regions: regionPayloads,
    records: [],
  };

  return { data, regionsPromise, recordsPromise, headers };
}

// ---------------------------------------------------------------------------
// Read layer (moved here from load.server.ts): DB queries, era-merge,
// dedupe and the per-region Redis cache.
// ---------------------------------------------------------------------------

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
      score100: true,
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
): Promise<ScatterPoint[]> {
  if (!season.supportsExtrapolationHistory) {
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
): Promise<RecordSeries[]> {
  if (
    typeof season.dungeons === "number" ||
    season.dungeons.length === 0 ||
    season.startDates.US === null ||
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
    data.reduce<Record<string, RecordSeries>>((acc, dataset) => {
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
          data: [],
          name,
          iconUrl: dungeonMetaInformation
            ? `https://wow.zamimg.com/images/wow/icons/medium/${dungeonMetaInformation.icon}.jpg`
            : null,
        };
      }

      acc[dataset.slug].data.push([dataset.timestamp * 1000, dataset.keyLevel]);

      return acc;
    }, {}),
  );
}

/**
 * Drops consecutive samples whose score is unchanged, keeping the first sample,
 * the last sample, and every point where the score actually moved. Operates on
 * the already-merged, ascending-by-timestamp datasets.
 */
function dropUnchangedScores(datasets: Dataset[]): Dataset[] {
  return datasets.reduce<Dataset[]>((acc, dataset, index, arr) => {
    const next = arr[index + 1];
    const last = acc[acc.length - 1];

    if (acc.length === 0 || !next || last.score !== dataset.score) {
      acc.push(dataset);
    }

    return acc;
  }, []);
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

  const datasets = await time(
    () => loadDatasets(region, season, gte, lte, timings),
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

/** A deduped CrossFactionHistory row from the SQL downsample. */
type CompleteRow = {
  timestamp: number;
  score: number;
  score100: number;
};

function completeRowToDataset(row: CompleteRow): Dataset {
  const score100 = Number(row.score100);

  return {
    ts: Number(row.timestamp) * 1000,
    score: Number(row.score),
    score100: score100 > 0 ? score100 : null,
  };
}

/**
 * Complete-faction seasons dedupe in SQL via a `LAG()` window function — keep the
 * first/last row + every score change, ordered by timestamp — instead of
 * fetching every row and reducing in JS. Byte-identical to `dropUnchangedScores`
 * over the JS pipeline (`score > 0` filter moved into the WHERE so it happens
 * before the window, matching the old map→filter→sort→reduce order).
 */
async function loadCompleteDatasets(
  region: Regions,
  gte: number | null,
  lte: number | undefined,
): Promise<Dataset[]> {
  if (!gte) {
    return [];
  }

  const gteSec = Math.ceil(gte / 1000);
  // unbounded end (live season) → an upper bound past any real timestamp.
  const lteSec = lte === undefined ? 2_147_483_647 : Math.ceil(lte / 1000);

  const rows = await prisma.$queryRaw<CompleteRow[]>`
    WITH ordered AS (
      SELECT timestamp, score, score100,
             LAG(score)  OVER w AS prev_score,
             LEAD(score) OVER w AS next_score
      FROM CrossFactionHistory
      WHERE region = ${region}
        AND timestamp BETWEEN ${gteSec} AND ${lteSec}
        AND score > 0
      WINDOW w AS (ORDER BY timestamp)
    )
    SELECT timestamp, score, score100
    FROM ordered
    WHERE prev_score IS NULL OR next_score IS NULL OR score <> prev_score
    ORDER BY timestamp
  `;

  return rows.map(completeRowToDataset);
}

/**
 * Per-region datasets, deduped. Complete seasons take the SQL `LAG` downsample;
 * faction (none/partial) seasons take the JS merge+dedupe (rare, old, and the
 * cross-table faction interleave makes the SQL fragile). The JS path is also the
 * fallback if the raw query ever throws (e.g. an unsupported DB).
 */
async function loadDatasets(
  region: Regions,
  season: Season,
  gte: number | null,
  lte: number | undefined,
  timings: Timings,
): Promise<Dataset[]> {
  if (season.crossFactionSupport === "complete") {
    try {
      return await loadCompleteDatasets(region, gte, lte);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `SQL downsample failed for ${season.slug}/${region}; falling back to JS dedupe`,
        error,
      );
    }
  }

  return loadDatasetsViaMerge(region, season, gte, lte, timings);
}

async function loadDatasetsViaMerge(
  region: Regions,
  season: Season,
  gte: number | null,
  lte: number | undefined,
  timings: Timings,
): Promise<Dataset[]> {
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

  return dropUnchangedScores(
    [...rawHistory, ...rawCrossFactionHistory]
      .map((dataset) => {
        const next: Dataset = {
          ts: Number(dataset.timestamp) * 1000,
          score: "customScore" in dataset ? dataset.customScore : dataset.score,
          score100:
            "score100" in dataset && dataset.score100 > 0
              ? dataset.score100
              : null,
        };

        if ("faction" in dataset) {
          next.faction = dataset.faction;
        }

        return next;
      })
      .filter((dataset) => dataset.score > 0)
      .sort((a, b) => a.ts - b.ts),
  );
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
