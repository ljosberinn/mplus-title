import clsx from "clsx";
import { type Regions } from "prisma/generated/prisma/enums";
import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Await,
  data,
  type HeadersFunction,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
  useSearchParams,
} from "react-router";
import { ClientOnly } from "remix-utils/client-only";

import { getAffixIconUrl, getAffixName } from "../affixes";
import { buildEnhancedSeason } from "../chart/assemble";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { decode, type SeasonData } from "../data";
import { assembleSeasonData } from "../data.server";
import { time, type Timings } from "../load.server";
import {
  determineOverlaysToDisplayFromCookies,
  determineOverlaysToDisplayFromSearchParams,
  determineRegionsToDisplayFromCookies,
  determineRegionsToDisplayFromSearchParams,
  getServerTimeHeader,
} from "../load.server";
import {
  type EnhancedSeason,
  findSeasonByName,
  hasSeasonEndedForAllRegions,
} from "../seasons";
import {
  parseOverlaysFromSearchParams,
  resolveOverlaysToDisplay,
  searchParamSeparator,
} from "../utils";
import { type Route } from "./+types/$season";

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";
const setCookie = "Set-Cookie";
const expires = "Expires";
const serverTiming = "Server-Timing";

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const loaderCache = loaderHeaders.get(cacheControl);

  const headers: HeadersInit = {};

  const expiresDate = loaderHeaders.get(expires);

  if (expiresDate) {
    // gets overwritten by cacheControl if present anyways
    headers.Expires = expiresDate;
  }

  if (loaderCache) {
    headers[cacheControl] = loaderCache;
    headers["CDN-Cache-Control"] = loaderCache;
    headers["Vercel-CDN-Cache-Control"] = loaderCache;
  } else if (expiresDate) {
    const diff = Math.round(
      (new Date(expiresDate).getTime() - Date.now()) / 1000 - 10,
    );

    if (diff > 0) {
      headers[cacheControl] = `public, s-maxage=${diff}`;
      headers["CDN-Cache-Control"] = headers[cacheControl];
      headers["Vercel-CDN-Cache-Control"] = headers[cacheControl];
    }
  } else {
    headers[cacheControl] = `public, s-maxage=1`;
    headers["CDN-Cache-Control"] = `public, s-maxage=60`;
    headers["Vercel-CDN-Cache-Control"] = `public, s-maxage=300`;
  }

  const lastModifiedDate = loaderHeaders.get(lastModified);

  if (lastModifiedDate) {
    headers[lastModified] = lastModifiedDate;
  }

  const maybeETag = loaderHeaders.get(eTag);

  if (maybeETag) {
    headers[eTag] = maybeETag;
  }

  const maybeSetCookie = loaderHeaders.get(setCookie);

  if (maybeSetCookie) {
    headers[setCookie] = maybeSetCookie;
  }

  const serverTimings = loaderHeaders.get(serverTiming);

  if (serverTimings) {
    headers[serverTiming] = serverTimings;
  }

  return headers;
};

/**
 * Loader payload: the compact `SeasonData` (charts paint from this immediately)
 * plus the dungeon `records` as a streamed promise — RR Single Fetch
 * streams it and the component renders it via <Await>, so the secondary dungeon
 * records chart doesn't block first paint. `data.records` stays empty.
 */
type SeasonLoaderData = SeasonData & {
  recordsStream: Promise<SeasonData["records"]>;
};

export const loader = async ({
  params,
  request,
}: Route.LoaderArgs): Promise<
  Response | ReturnType<typeof data<SeasonLoaderData>>
> => {
  if (!("season" in params) || !params.season) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Missing params.",
    });
  }

  const season = findSeasonByName(params.season, null);

  if (!season) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Unknown season.",
    });
  }

  const timings: Timings = {};

  const searchParamOverlays = await time(
    () => determineOverlaysToDisplayFromSearchParams(request),
    { type: "determineOverlaysToDisplayFromSearchParams", timings },
  );
  const searchParamRegions = await time(
    () => determineRegionsToDisplayFromSearchParams(request),
    { type: "determineRegionsToDisplayFromSearchParams", timings },
  );

  const cookieRegions = searchParamRegions
    ? null
    : await time(() => determineRegionsToDisplayFromCookies(request), {
        type: "determineRegionsToDisplayFromCookies",
        timings,
      });
  const cookieOverlays = searchParamOverlays
    ? null
    : await time(() => determineOverlaysToDisplayFromCookies(request), {
        type: "determineOverlaysToDisplayFromCookies",
        timings,
      });

  if (cookieRegions || cookieOverlays) {
    const params = new URLSearchParams();

    if (cookieOverlays) {
      params.append("overlays", cookieOverlays.join(searchParamSeparator));
    }

    if (cookieRegions) {
      params.append("regions", cookieRegions.join(searchParamSeparator));
    }

    return redirect(`/${season.slug}?${params.toString()}`, 307);
  }

  const regions = searchParamRegions;

  const {
    data: seasonData,
    recordsPromise,
    headers,
  } = await time(
    () => assembleSeasonData({ request, regions, season, timings }),
    { type: "assembleSeasonData", timings },
  );

  headers[serverTiming] = getServerTimeHeader(timings);

  // stream the (secondary) dungeon records so the chart data paints first.
  return data({ ...seasonData, recordsStream: recordsPromise }, { headers });
};

/**
 * Overlays are a pure client concern (the browser rebuilds annotations from the
 * URL), so an overlay-only change must not refetch. Only a season, region or
 * extrapolation-end-date change alters the server payload.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs): boolean {
  if (currentUrl.pathname !== nextUrl.pathname) {
    return true;
  }

  const changed = (key: string) =>
    currentUrl.searchParams.get(key) !== nextUrl.searchParams.get(key);

  return changed("regions") || changed("extrapolationEndDate");
}

/**
 * In-memory payload cache (W7). Keyed by the same inputs that trigger a
 * revalidation (slug + regions + extrapolation end), it lets client navigations
 * — back/forward, re-visiting a season — skip the server round-trip. It returns
 * the *same raw `SeasonData`* the server loader returns, so the component still
 * decodes in its `useMemo`: there is no SSR/client shape mismatch and no
 * `HydrateFallback` is needed (`clientLoader` is intentionally not marked
 * `hydrate`, so the SSR payload is used as-is on first paint).
 *
 * Only *ended* seasons are cached — they are immutable. The live season always
 * revalidates so its cutoffs never go stale on a re-visit.
 */
const seasonDataCache = new Map<string, SeasonLoaderData>();

const cacheKey = (request: Request, season: string): string => {
  const { searchParams } = new URL(request.url);
  return [
    season,
    searchParams.get("regions") ?? "",
    searchParams.get("extrapolationEndDate") ?? "",
  ].join("|");
};

export async function clientLoader({
  request,
  params,
  serverLoader,
}: Route.ClientLoaderArgs): Promise<SeasonLoaderData> {
  const season = params.season ?? "";
  const cacheable = hasSeasonEndedForAllRegions(season);
  const key = cacheKey(request, season);

  if (cacheable) {
    const cached = seasonDataCache.get(key);

    if (cached) {
      return cached;
    }
  }

  // the streamed `recordsStream` promise resolves once; for ended (immutable)
  // seasons caching the resolved value is safe and makes re-visits instant.
  const seasonData = await serverLoader();

  if (cacheable) {
    seasonDataCache.set(key, seasonData);
  }

  return seasonData;
}

type ZoomExtremes = null | { min: number; max: number };

const DungeonRecords = lazy(
  () => import("../components/DungeonRecords.client"),
);

export default function Season(
  props: Route.ComponentProps,
): React.ReactNode | null {
  const [searchParams] = useSearchParams();

  // RR's `SerializeFrom` widens the loaderData type so it isn't structurally
  // identical to `SeasonData` despite being so at runtime; narrow it back at
  // this boundary. `records` is empty here (streamed via `recordsStream`); the
  // charts don't need it.
  const decoded = useMemo(
    () => decode(props.loaderData as SeasonData),
    [props.loaderData],
  );
  const { recordsStream } = props.loaderData;
  const seasonConfig = useMemo(
    () => findSeasonByName(decoded.slug, null),
    [decoded.slug],
  );
  const overlays = useMemo(
    () =>
      resolveOverlaysToDisplay(
        seasonConfig?.wcl?.zoneId,
        parseOverlaysFromSearchParams(searchParams),
      ),
    [seasonConfig, searchParams],
  );
  // the season config is always found (the loader validated the slug), so the
  // non-null assertion is safe; the client rebuilds the chart from the compact
  // payload + bundled config instead of receiving the baked `EnhancedSeason`.
  const season: EnhancedSeason = useMemo(
    () => buildEnhancedSeason(decoded, seasonConfig!, overlays),
    [decoded, seasonConfig, overlays],
  );
  const prevSeason = useRef(season.slug);
  const prevExtrapolation = useRef(season.score.extrapolation);
  const [extremes, setExtremes] = useState<ZoomExtremes>(null);

  useEffect(() => {
    if (
      prevSeason.current === season.slug &&
      prevExtrapolation.current === season.score.extrapolation
    ) {
      return;
    }

    setExtremes(null);
  }, [season]);

  return (
    <>
      <Header season={season} />
      <main className="container mt-4 flex max-w-screen-2xl flex-1 flex-col space-y-4 px-4 md:mx-auto 2xl:px-0">
        {season.score.regionsToDisplay.map((region) => {
          return (
            <Fragment key={region}>
              <Region
                season={season}
                region={region}
                onZoom={setExtremes}
                extremes={extremes}
              />
            </Fragment>
          );
        })}

        {/* dungeon records stream in so they don't block the charts. */}
        <Suspense fallback={null}>
          <Await resolve={recordsStream} errorElement={null}>
            {(records) =>
              Array.isArray(records) && records.length > 0 ? (
                <ClientOnly fallback={null}>
                  {() => (
                    <DungeonRecords
                      season={{
                        ...season,
                        records,
                      }}
                    />
                  )}
                </ClientOnly>
              ) : null
            }
          </Await>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function findIndexOfCurrentWeek(season: EnhancedSeason, region: Regions) {
  if (
    !season.startDates[region] ||
    season.score.dataByRegion[region].length === 0
  ) {
    return null;
  }

  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  if ((endDate !== null && endDate <= Date.now()) || !startDate) {
    return null;
  }

  const latestDataset =
    season.score.dataByRegion[region][
      season.score.dataByRegion[region].length - 1
    ];

  const result = Math.floor(
    (latestDataset.ts - startDate) / 1000 / 60 / 60 / 24 / 7,
  );

  if (season.affixes.length === 0) {
    return result;
  }

  if (result === season.affixes.length) {
    return 0;
  }

  if (result > season.affixes.length) {
    return result % season.affixes.length;
  }

  return result;
}

type CardProps = {
  season: EnhancedSeason;
  region: Regions;
  extremes: ZoomExtremes;
  onZoom: (extremes: ZoomExtremes) => void;
};

const TempBanner = lazy(() => import("../components/TempBanner.client"));
const UplotChart = lazy(() => import("../chart/UplotChart.client"));

function Region({
  season,
  region,
  extremes,
  onZoom,
}: CardProps): React.ReactNode {
  const confirmedCutoffUrl = season.confirmedCutoffs[region].source;
  const navigation = useNavigation();

  const now = Date.now();

  if (season.score.dataByRegion[region].length === 0) {
    const startDate = season.startDates[region];
    const seasonHasNotStartedForRegion = !startDate || startDate > now;
    const hoursUntilSeasonStart =
      seasonHasNotStartedForRegion && startDate
        ? Math.max(Math.round((startDate - now) / 1000 / 60 / 60), 1)
        : 0;

    return (
      <div className="rounded-lg bg-gray-700 p-4">
        <h2>
          {seasonHasNotStartedForRegion ? (
            <>
              The season has not started in <b>{region.toUpperCase()}</b> yet.
              Data will appear as soon as possible after{" "}
              {startDate ? (
                <ClientOnly fallback={null}>
                  {() => (
                    <time dateTime={new Date(startDate).toISOString()}>
                      <b>
                        {new Date(startDate).toLocaleString()} (T-
                        {hoursUntilSeasonStart} hours)
                      </b>
                    </time>
                  )}
                </ClientOnly>
              ) : (
                "it started"
              )}
              .
            </>
          ) : (
            <>
              No data yet in <b>{region.toUpperCase()}</b>, give it a couple
              hours.
            </>
          )}
        </h2>
      </div>
    );
  }

  const indexOfCurrentWeek = findIndexOfCurrentWeek(season, region);
  const seasonStartForRegion = season.startDates[region];
  const seasonEndForRegion = season.endDates[region];
  const timePassedSinceSeasonStart = seasonStartForRegion
    ? (seasonEndForRegion && seasonEndForRegion < now
        ? seasonEndForRegion
        : now) - seasonStartForRegion
    : 0;
  const weeksPassedSinceSeasonStart =
    timePassedSinceSeasonStart / 1000 / 60 / 60 / 24 / 7;

  const cycles =
    season.affixes.length > 0 &&
    weeksPassedSinceSeasonStart > season.affixes.length
      ? Math.ceil(weeksPassedSinceSeasonStart / season.affixes.length) - 1
      : 0;

  const needsTempBanner = season.slug === "df-season-2" && region === "US";

  return (
    <section
      className={clsx(
        navigation.state === "loading" && "grayscale",
        "max-w-screen-2xl rounded-md bg-gray-700 transition-all duration-500 ease-linear motion-reduce:transition-none",
      )}
      aria-labelledby={`title-${region}`}
      id={region}
    >
      <h1 id={`title-${region}`} className="text-center text-lg font-bold">
        {region.toUpperCase()}
      </h1>

      {region && confirmedCutoffUrl ? (
        <div className="flex justify-center">
          <a
            href={confirmedCutoffUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            daily updated bluepost
          </a>
        </div>
      ) : null}

      {needsTempBanner ? (
        <Suspense fallback={null}>
          <TempBanner season={season} region={region} />
        </Suspense>
      ) : null}

      <div className="mb-2 flex w-full justify-between">
        {season.affixes.map((set, index) => {
          const setSlice = set.length === 3 ? set : set.slice(0, -1);
          const isCurrentWeek = index === indexOfCurrentWeek;
          const isNextWeek =
            isCurrentWeek || indexOfCurrentWeek === null
              ? false
              : index === indexOfCurrentWeek + 1;
          const isFutureWeek = indexOfCurrentWeek && index > indexOfCurrentWeek;

          const affixSetId =
            typeof season.wcl?.weekIndexToAffixSetId[index] === "number"
              ? season.wcl.weekIndexToAffixSetId[index]
              : null;

          let startTimeOfWeek: number;
          let endTimeOfWeek: number;
          let startTime: Date | null = null;
          let endTime: Date | null = null;
          let weekOffset = 0;

          // to properly adjust weeks in past seasons
          if (seasonEndForRegion && seasonEndForRegion < now) {
            const rollover =
              season.affixes.length -
              Math.ceil(
                ((weeksPassedSinceSeasonStart / season.affixes.length) * 10) %
                  season.affixes.length,
              );
            let offset = season.affixes.length - index - rollover;

            if (offset <= 0) {
              offset += season.affixes.length;
            }

            startTimeOfWeek =
              seasonEndForRegion - offset * 7 * 24 * 60 * 60 * 1000;

            endTimeOfWeek = startTimeOfWeek + 7 * 24 * 60 * 60 * 1000;

            startTime = new Date(startTimeOfWeek);
            endTime = new Date(endTimeOfWeek);
          } else if (seasonStartForRegion) {
            // adjust week offset by cycles - 1 for future weeks to show MythicStats link for the last time this affix set came around
            weekOffset =
              (cycles - (isFutureWeek ? 1 : 0)) * season.affixes.length + index;
            startTimeOfWeek =
              seasonStartForRegion +
              (index + cycles * season.affixes.length) *
                7 *
                24 *
                60 *
                60 *
                1000;

            // move date of past week to the future indicating when it comes around next
            if (!isCurrentWeek && startTimeOfWeek <= now) {
              startTimeOfWeek =
                seasonStartForRegion +
                (index + (cycles + 1) * season.affixes.length) *
                  7 *
                  24 *
                  60 *
                  60 *
                  1000;
            }

            endTimeOfWeek = startTimeOfWeek + 7 * 24 * 60 * 60 * 1000;

            startTime = new Date(startTimeOfWeek);
            endTime = new Date(endTimeOfWeek);
          }

          let omitGrayscale = false;

          if (startTime && endTime && seasonEndForRegion) {
            const isLastWeekOfTheSeason =
              startTime.getTime() < seasonEndForRegion &&
              endTime.getTime() > seasonEndForRegion;

            const isWeekBeforeLastWeekOfTheSeason =
              (startTime.getTime() >= now &&
                endTime.getTime() < seasonEndForRegion) ||
              isCurrentWeek;

            if (isLastWeekOfTheSeason || isWeekBeforeLastWeekOfTheSeason) {
              omitGrayscale = true;
            }
          }

          return (
            <div
              className={clsx(
                "flex flex-1 flex-col items-center space-y-1",
                isCurrentWeek
                  ? null
                  : isNextWeek
                    ? "opacity-75 hover:opacity-100"
                    : "opacity-50 hover:opacity-100",
                isCurrentWeek
                  ? undefined
                  : `${omitGrayscale ? "" : "grayscale"} transition-opacity hover:filter-none`,
                isNextWeek ? "filter-none" : null,
              )}
              key={[...set, index].join("-")}
            >
              <span className="flex space-x-1">
                <span title={`Week ${index + 1}`}>W{index + 1}</span>
                <span className="hidden items-center space-x-1 md:flex lg:space-x-2">
                  {affixSetId && season.wcl ? (
                    <a
                      href={`https://www.warcraftlogs.com/zone/rankings/${
                        season.wcl.zoneId
                      }#affixes=${affixSetId}&leaderboards=1${
                        season.wcl.partition
                          ? `&partition=${season.wcl.partition}`
                          : ""
                      }`}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="italic text-blue-400 underline"
                      title="Logs for this affix set"
                    >
                      <img
                        src="https://assets.rpglogs.com/img/warcraft/favicon.png?v=2"
                        loading="lazy"
                        alt="WCL"
                        className="h-4 w-4"
                      />
                    </a>
                  ) : null}
                  {cycles === 0 && isFutureWeek ? null : (
                    <MythicStatsLink season={season} weekOffset={weekOffset} />
                  )}
                </span>
              </span>

              {startTime && endTime ? (
                <span className="flex flex-col items-center space-x-0 text-center md:flex-row md:space-x-1">
                  <LocaleTime date={startTime} />
                  <span>-</span>
                  <LocaleTime date={endTime} />
                </span>
              ) : null}
              {(season.wcl?.zoneId ?? 0) < 39 ? (
                <div>
                  {setSlice.map((affix) => {
                    const affixName = getAffixName(affix);

                    return (
                      <div
                        key={affix}
                        className="flex w-full justify-center space-x-2"
                        title={affixName}
                      >
                        <img
                          src={getAffixIconUrl(affix)}
                          width={18}
                          height={18}
                          loading="lazy"
                          className="h-4 w-4"
                          alt={affixName.slice(0, 3)}
                        />
                        <span className="hidden text-sm md:inline">
                          {affixName.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="h-[39vh] lg:h-[30vh]">
        <ClientOnly fallback={null}>
          {() => (
            <Suspense fallback={null}>
              <UplotChart
                season={season}
                region={region}
                extremes={extremes}
                onZoom={onZoom}
              />
            </Suspense>
          )}
        </ClientOnly>
      </div>
    </section>
  );
}

type MythicStatsLinkProps = {
  season: CardProps["season"];
  weekOffset: number;
};

function MythicStatsLink({ season, weekOffset }: MythicStatsLinkProps) {
  if (!season.startingPeriod) {
    return null;
  }

  const href = `https://mythicstats.com/period/${season.startingPeriod + weekOffset}`;

  return (
    <a
      href={href}
      target="_blank"
      title="MythicStats for this week"
      rel="noreferrer"
    >
      <img src="/mythic-stats.png" loading="lazy" className="h-4 w-4" alt="" />
    </a>
  );
}

type LocaleTimeProps = {
  date: Date;
};

function LocaleTime({ date }: LocaleTimeProps) {
  return (
    <ClientOnly fallback={null}>
      {() => (
        <time className="text-xs" dateTime={date.toISOString()}>
          {date.toLocaleString(undefined, {
            month: "numeric",
            day: "numeric",
          })}
        </time>
      )}
    </ClientOnly>
  );
}
