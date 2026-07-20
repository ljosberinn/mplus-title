import clsx from "clsx";
import { type Regions } from "prisma/generated/prisma/enums";
import {
  lazy,
  type ReactNode,
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
  Link,
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
import { SeasonControls } from "../components/SeasonControls";
import { decode, type SeasonData } from "../data";
import { assembleSeasonData } from "../data.server";
import { time, type Timings } from "../load.server";
import {
  determineOverlaysToDisplayFromCookies,
  determineOverlaysToDisplayFromSearchParams,
  determineRegionsToDisplayFromSearchParams,
  getServerTimeHeader,
} from "../load.server";
import {
  type EnhancedSeason,
  findSeasonByName,
  hasSeasonEndedForAllRegions,
} from "../seasons";
import {
  orderedRegionsBySize,
  parseOverlaysFromSearchParams,
  parseRegionsFromPath,
  regionsToPathSegment,
  resolveOverlaysToDisplay,
  searchParamSeparator,
} from "../utils";
import { type Route } from "./+types/$season.($regions)";

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";
const setCookie = "Set-Cookie";
const expires = "Expires";
const serverTiming = "Server-Timing";

// How long (seconds) the CDN may serve a stale cached copy while revalidating in
// the background once it goes stale. Sized to ~one cron cadence (data refreshes
// every ~5 min); cutoffs only ever creep upward, so a few minutes of staleness is
// harmless and it spares the request that lands right after expiry a cold origin
// hit. Not applied to ended (immutable) seasons, where it's meaningless.
const staleWhileRevalidate = 300;

// tailwind.com-style hatched side gutters framing the main content. Adapted to
// this always-dark theme: a white diagonal pattern at 10% on the gutter columns
// plus `border-x` boundary lines. Hidden on mobile; the hatch only becomes
// visible once the viewport is wider than the content's max width (the gutters
// have width then).
const gutterPattern =
  "row-span-full row-start-1 hidden border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-white)]/10 2xl:block";

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

    // Serve fresh until the next expected data drop, then keep serving the cached
    // copy (revalidating in the background) for `staleWhileRevalidate` seconds.
    // `diff` can be <= 0 when expiry has already passed — clamp to 0 so that case
    // still gets an SWR window instead of falling through to an uncached response.
    const sMaxAge = Math.max(diff, 0);
    const value = `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
    headers[cacheControl] = value;
    headers["CDN-Cache-Control"] = value;
    headers["Vercel-CDN-Cache-Control"] = value;
  } else {
    headers[cacheControl] =
      `public, s-maxage=1, stale-while-revalidate=${staleWhileRevalidate}`;
    headers["CDN-Cache-Control"] =
      `public, s-maxage=60, stale-while-revalidate=${staleWhileRevalidate}`;
    headers["Vercel-CDN-Cache-Control"] =
      `public, s-maxage=300, stale-while-revalidate=${staleWhileRevalidate}`;
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
 * Region-view loader payload: the compact `SeasonData` for the single requested
 * region plus one streamed promise — RR Single Fetch streams it and the
 * component renders it via <Await>:
 *  - `recordsStream` — the dungeon records for the secondary records chart.
 * `data.records` stays empty on the wire.
 */
type RegionLoaderData = SeasonData & {
  recordsStream: Promise<SeasonData["records"]>;
};

/**
 * Bare `/{season}` picker payload — just the resolved slug so the picker can
 * label itself and build its region links. No season data is loaded: the picker
 * is a static render, which is the whole cost win of this route.
 */
type PickerLoaderData = { picker: true; slug: string };

type SeasonLoaderData = PickerLoaderData | RegionLoaderData;

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

  // Unknown season (`/foo`, `/foo/bar`) → redirect to the latest season's bare
  // picker rather than 400.
  if (!season) {
    return redirect(`/${findSeasonByName("latest", null)!.slug}`, 307);
  }

  const url = new URL(request.url);

  const regions = parseRegionsFromPath(params.regions);

  // Legacy compat: regions used to live in `?regions=`. The app now renders one
  // region at a time, so promote just the first region into the path (308,
  // method-preserving, so bookmarks/crawlers update) and strip the query param,
  // keeping everything else (overlays, extrapolationEndDate). A path segment,
  // when present, wins over the legacy query.
  if (url.searchParams.has("regions")) {
    const promotedRegions =
      regions ?? determineRegionsToDisplayFromSearchParams(request);
    const firstRegion = promotedRegions?.[0];

    url.searchParams.delete("regions");
    const query = url.searchParams.toString();
    const segment = firstRegion ? regionsToPathSegment([firstRegion]) : "";

    return redirect(
      `/${season.slug}${segment ? `/${segment}` : ""}${query ? `?${query}` : ""}`,
      308,
    );
  }

  // Bare `/{season}` (no region segment) → the region picker. No season data.
  if (!params.regions) {
    return data<SeasonLoaderData>({ picker: true, slug: season.slug });
  }

  // A region segment is present but yielded no valid region token → send to the
  // bare picker.
  if (!regions) {
    return redirect(`/${season.slug}`, 307);
  }

  // Single-region canonicalisation: keep only the first region (a legacy
  // `/{season}/EU~US` collapses to `/{season}/EU`) and drop invalid tokens. If
  // the incoming segment isn't already the canonical single-region form,
  // redirect to it.
  const canonicalSegment = regionsToPathSegment([regions[0]]);

  if (params.regions !== canonicalSegment) {
    const query = url.searchParams.toString();

    return redirect(
      `/${season.slug}/${canonicalSegment}${query ? `?${query}` : ""}`,
      308,
    );
  }

  const timings: Timings = {};

  const searchParamOverlays = await time(
    () => determineOverlaysToDisplayFromSearchParams(request),
    { type: "determineOverlaysToDisplayFromSearchParams", timings },
  );

  const cookieOverlays = searchParamOverlays
    ? null
    : await time(() => determineOverlaysToDisplayFromCookies(request), {
        type: "determineOverlaysToDisplayFromCookies",
        timings,
      });

  // Overlays still round-trip through a cookie: promote the cookie selection
  // into the query (preserving the region path segment) so the client rebuilds
  // annotations from the URL.
  if (cookieOverlays) {
    url.searchParams.set("overlays", cookieOverlays.join(searchParamSeparator));

    return redirect(
      `/${season.slug}${canonicalSegment ? `/${canonicalSegment}` : ""}?${url.searchParams.toString()}`,
      307,
    );
  }

  const {
    data: seasonData,
    recordsPromise,
    headers,
  } = await time(
    () => assembleSeasonData({ request, regions, season, timings }),
    { type: "assembleSeasonData", timings },
  );

  headers[serverTiming] = getServerTimeHeader(timings);

  // stream the dungeon records so they don't block the region's chart.
  return data(
    {
      ...seasonData,
      recordsStream: recordsPromise,
    },
    { headers },
  );
};

/**
 * Overlays are a pure client concern (the browser rebuilds annotations from the
 * URL), so an overlay-only change must not refetch. A season or region change is
 * now a pathname change (regions live in the path), which already revalidates;
 * the only remaining query input to the payload is `extrapolationEndDate`.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs): boolean {
  if (currentUrl.pathname !== nextUrl.pathname) {
    return true;
  }

  return (
    currentUrl.searchParams.get("extrapolationEndDate") !==
    nextUrl.searchParams.get("extrapolationEndDate")
  );
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
 * Ended seasons are immutable and cached without expiry. The live season is
 * cached too but only for a short TTL (`LIVE_SEASON_CACHE_TTL`), so quick
 * back/forward + region bounces are instant while its cutoffs can never go
 * meaningfully stale (the TTL is well under the ~5-min data cadence).
 */
type CachedSeasonData = { data: SeasonLoaderData; expiresAt: number };

const seasonDataCache = new Map<string, CachedSeasonData>();

/** How long (ms) a live-season payload may be served from the clientLoader cache
 * before re-fetching. Bounded to seconds — far below the data's update cadence —
 * so it trades no meaningful freshness for instant repeat navigations. */
const LIVE_SEASON_CACHE_TTL = 45_000;

const cacheKey = (
  request: Request,
  season: string,
  regions: string,
): string => {
  const { searchParams } = new URL(request.url);
  return [season, regions, searchParams.get("extrapolationEndDate") ?? ""].join(
    "|",
  );
};

export async function clientLoader({
  request,
  params,
  serverLoader,
}: Route.ClientLoaderArgs): Promise<SeasonLoaderData> {
  const season = params.season ?? "";
  const ended = hasSeasonEndedForAllRegions(season);
  const key = cacheKey(request, season, params.regions ?? "");

  const cached = seasonDataCache.get(key);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // the streamed `recordsStream` promise resolves once; caching the resolved
  // value makes re-visits instant. Ended seasons are immutable ⇒ no expiry; the
  // live season gets a short TTL so cutoffs can't go stale on a re-visit.
  const seasonData = await serverLoader();

  seasonDataCache.set(key, {
    data: seasonData,
    expiresAt: ended
      ? Number.POSITIVE_INFINITY
      : Date.now() + LIVE_SEASON_CACHE_TTL,
  });

  return seasonData;
}

type ZoomExtremes = null | { min: number; max: number };

const DungeonRecords = lazy(
  () => import("../components/DungeonRecords.client"),
);

export default function Season(props: Route.ComponentProps): ReactNode | null {
  const { loaderData } = props;

  if ("picker" in loaderData) {
    return <RegionPicker slug={loaderData.slug} />;
  }

  return <RegionView loaderData={loaderData} />;
}

function RegionPicker({ slug }: { slug: string }): ReactNode {
  const season = findSeasonByName(slug, null);

  return (
    <>
      <Header />
      <div className="grid flex-1 grid-cols-1 grid-rows-[1fr] md:grid-cols-[1fr_min(96rem,100%)_1fr]">
        <div aria-hidden className={clsx(gutterPattern, "col-start-1")} />
        <main className="col-start-1 row-start-1 flex flex-col space-y-6 p-6 md:col-start-2">
          <div className="flex items-center gap-3">
            {season ? (
              <img
                src={season.seasonIcon}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
            ) : null}
            <h1 className="text-xl font-bold">{season ? season.name : slug}</h1>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {orderedRegionsBySize.map((region) => (
              <li key={region}>
                <Link
                  prefetch="intent"
                  to={`/${slug}/${regionsToPathSegment([region])}`}
                  className="rounded-md flex h-28 md:h-56 xl:h-28 flex-col items-center justify-center gap-2 border border-gray-600 bg-gray-700 text-2xl font-bold text-white outline-none transition-all duration-200 ease-in-out hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {season ? (
                    <img
                      src={season.seasonIcon}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="h-7 w-7"
                    />
                  ) : null}
                  {region.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </main>
        <div aria-hidden className={clsx(gutterPattern, "col-start-3")} />
      </div>
      <Footer />
    </>
  );
}

type RegionViewProps = {
  loaderData: RegionLoaderData;
};

/**
 * Single-region chart view at `/{season}/{region}`. Paints exactly one region
 * from the loader payload; the dungeon records still stream in via <Await>.
 */
function RegionView({ loaderData }: RegionViewProps): ReactNode {
  const [searchParams] = useSearchParams();

  // RR's `SerializeFrom` widens the loaderData type so it isn't structurally
  // identical to `SeasonData` despite being so at runtime; narrow it back at
  // this boundary. `records` is empty here (streamed via `recordsStream`); the
  // charts don't need it.
  const decoded = useMemo(() => decode(loaderData as SeasonData), [loaderData]);
  const { recordsStream } = loaderData;
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
  // Only ever one region on this view.
  const [region] = season.score.regionsToDisplay;
  const {
    slug,
    score: { extrapolation },
  } = season;

  const prevSeason = useRef(slug);
  const prevExtrapolation = useRef(extrapolation);
  const [extremes, setExtremes] = useState<ZoomExtremes>(null);

  useEffect(() => {
    if (
      prevSeason.current === slug &&
      prevExtrapolation.current === extrapolation
    ) {
      return;
    }

    setExtremes(null);
  }, [season, extrapolation, slug]);

  return (
    <>
      <Header />
      <div className="grid flex-1 grid-cols-1 grid-rows-[1fr] md:grid-cols-[1fr_min(96rem,100%)_1fr]">
        <div aria-hidden className={clsx(gutterPattern, "col-start-1")} />
        <main className="col-start-1 row-start-1 flex flex-col space-y-4 p-6 md:col-start-2">
          <SeasonControls season={season} />
          {region ? (
            <Region
              season={season}
              region={region}
              onZoom={setExtremes}
              extremes={extremes}
            />
          ) : null}

          {/* dungeon records stream in so they don't block the chart. */}
          <Suspense fallback={null}>
            <Await resolve={recordsStream} errorElement={null}>
              {(records) =>
                overlays.includes("records") &&
                Array.isArray(records) &&
                records.length > 0 ? (
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
        <div aria-hidden className={clsx(gutterPattern, "col-start-3")} />
      </div>
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

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

/** "3 minutes ago" / "5 seconds ago" / "2 hours ago" for a past ms timestamp. */
function formatRelativeTime(ts: number): string {
  const diffSeconds = Math.round((ts - Date.now()) / 1000);

  if (Math.abs(diffSeconds) < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second");
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffSeconds / 3600);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }
  return relativeTimeFormatter.format(Math.round(diffSeconds / 86_400), "day");
}

/**
 * Client-only "last updated" line for a region: the last dataset's timestamp in
 * the viewer's locale plus a live relative time. It self-ticks every 10s so the
 * relative part stays fresh; being its own component, that re-render doesn't
 * touch the chart. Must be wrapped in <ClientOnly> (locale + relative time are
 * client-specific and would otherwise mismatch SSR).
 */
function LastUpdated({ ts }: { ts: number }): React.ReactNode {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      tick((value) => value + 1);
    }, 10_000);

    return () => {
      clearInterval(id);
    };
  }, []);

  const date = new Date(ts);

  return (
    <p className="text-xs text-gray-400">
      Last updated{" "}
      <time dateTime={date.toISOString()} className="text-gray-300">
        {date.toLocaleString()}
      </time>{" "}
      ({formatRelativeTime(ts)})
    </p>
  );
}

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
      <div className="border border-gray-600 bg-gray-700 p-4">
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

  const datasetsForRegion = season.score.dataByRegion[region];
  const lastUpdateTs = datasetsForRegion[datasetsForRegion.length - 1].ts;

  return (
    <section
      className={clsx(
        navigation.state === "loading" && "grayscale",
        "rounded-md max-w-screen-2xl border border-gray-600 bg-gray-700 p-4 transition-all duration-500 ease-linear motion-reduce:transition-none",
      )}
      aria-labelledby={`title-${region}`}
      id={region}
    >
      <div className="mb-2">
        <h1 id={`title-${region}`} className="text-lg font-bold">
          {region.toUpperCase()}
        </h1>
        <p className="text-xs italic text-gray-400">
          Drag across the chart to zoom in; double-click to reset.
        </p>

        {region && confirmedCutoffUrl ? (
          <a
            href={confirmedCutoffUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex items-center gap-1 font-semibold text-blue-400 underline hover:text-blue-300"
          >
            daily updated bluepost
          </a>
        ) : null}

        <ClientOnly fallback={null}>
          {() => <LastUpdated ts={lastUpdateTs} />}
        </ClientOnly>
      </div>

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
                  {(cycles === 0 && isFutureWeek) ||
                  !season.score.overlaysToDisplay.includes(
                    "mythicStats",
                  ) ? null : (
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
