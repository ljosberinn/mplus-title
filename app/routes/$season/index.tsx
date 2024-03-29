import { type Regions } from "@prisma/client";
import { json, type LoaderArgs, type TypedResponse } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { type HeadersFunction, redirect } from "@remix-run/server-runtime";
import clsx from "clsx";
import Highcharts, {
  type Options,
  type PointLabelObject,
  type SeriesLineOptions,
  type XAxisPlotBandsOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";

import { getAffixIconUrl, getAffixName } from "~/affixes";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { time, type Timings } from "~/load.server";
import {
  determineOverlaysToDisplayFromCookies,
  determineOverlaysToDisplayFromSearchParams,
  determineRegionsToDisplayFromCookies,
  determineRegionsToDisplayFromSearchParams,
  getServerTimeHeader,
} from "~/load.server";
import { getEnhancedSeason } from "~/models/season.server";
import { type EnhancedSeason, findSeasonByName } from "~/seasons";
import { calculateFactionDiffForWeek, searchParamSeparator } from "~/utils";

const factionColors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#B389AF",
} as const;

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";
const setCookie = "Set-Cookie";
const expires = "Expires";
const serverTiming = "Server-Timing";

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const loaderCache = loaderHeaders.get(cacheControl);

  const headers: HeadersInit = {
    [cacheControl]: loaderCache ?? "public",
  };

  const expiresDate = loaderHeaders.get(expires);

  if (expiresDate) {
    // gets overwritten by cacheControl if present anyways
    headers.Expires = expiresDate;
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

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

export const loader = async ({
  params,
  request,
}: LoaderArgs): Promise<TypedResponse<EnhancedSeason>> => {
  if (!("season" in params) || !params.season) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Missing params.",
    });
  }

  const season = findSeasonByName(params.season);

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
  const overlays = searchParamOverlays;

  const { season: enhancedSeason, headers } = await time(
    () =>
      getEnhancedSeason({
        request,
        regions,
        overlays,
        season,
        timings,
      }),
    { type: "getEnhancedSeason", timings },
  );

  headers[serverTiming] = getServerTimeHeader(timings);

  return json(enhancedSeason, { headers });
};

type ZoomExtremes = null | { min: number; max: number };

export default function Season(): JSX.Element | null {
  const season = useLoaderData<typeof loader>();
  const [extremes, setExtremes] = useState<ZoomExtremes>(null);

  return (
    <>
      <Header season={season} />
      <main className="container mt-4 flex max-w-screen-2xl flex-1 flex-col space-y-4 px-4 md:mx-auto 2xl:px-0">
        {season.regionsToDisplay.map((region) => {
          return (
            <Fragment key={region}>
              <Card
                season={season}
                region={region}
                onZoom={setExtremes}
                extremes={extremes}
              />
            </Fragment>
          );
        })}
      </main>
      <Footer />
    </>
  );
}

const findIndexOfCurrentWeek = (season: EnhancedSeason, region: Regions) => {
  if (!season.startDates[region] || season.dataByRegion[region].length === 0) {
    return null;
  }

  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  if ((endDate !== null && endDate <= Date.now()) || !startDate) {
    return null;
  }

  const latestDataset =
    season.dataByRegion[region][season.dataByRegion[region].length - 1];

  const result = Math.floor(
    (latestDataset.ts - startDate) / 1000 / 60 / 60 / 24 / 7,
  );

  if (result === season.affixes.length) {
    return 0;
  }

  if (result > season.affixes.length) {
    return result % season.affixes.length;
  }

  return result;
};

type CardProps = {
  season: EnhancedSeason;
  region: Regions;
  extremes: ZoomExtremes;
  onZoom: (extremes: ZoomExtremes) => void;
};

const numberFormatParts = new Intl.NumberFormat().formatToParts(1234.5);

const TempBanner = lazy(() => import("../../components/TempBanner"));

function Card({ season, region, extremes, onZoom }: CardProps): JSX.Element {
  const ref = useRef<HighchartsReact.RefObject | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const confirmedCutoffUrl = season.confirmedCutoffs[region].source;
  const navigation = useNavigation();

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (extremes) {
      ref.current.chart.xAxis[0].setExtremes(extremes.min, extremes.max);
      ref.current.chart.showResetZoom();
      return;
    }

    const zoom = season.initialZoom[region];

    if (containerRef.current) {
      containerRef.current.className = "";
    }

    if (!zoom) {
      ref.current.chart.xAxis[0].setExtremes();
      return;
    }

    const [start, end] = zoom;

    if (!start || !end) {
      return;
    }

    ref.current.chart.xAxis[0].setExtremes(start, end);
    ref.current.chart.showResetZoom();
  }, [region, season.initialZoom, extremes]);

  if (season.dataByRegion[region].length === 0) {
    const startDate = season.startDates[region];
    const seasonHasNotStartedForRegion = !startDate || startDate > Date.now();
    const hoursUntilSeasonStart =
      seasonHasNotStartedForRegion && startDate
        ? Math.max(Math.round((startDate - Date.now()) / 1000 / 60 / 60), 1)
        : 0;

    return (
      <div className="rounded-lg bg-gray-700 p-4">
        <h2>
          {seasonHasNotStartedForRegion ? (
            <>
              The season has not started in <b>{region.toUpperCase()}</b> yet.
              Data will appear as soon as possible after{" "}
              {startDate ? (
                <time dateTime={new Date(startDate).toISOString()}>
                  <b suppressHydrationWarning>
                    {new Date(startDate).toLocaleString()} (T-
                    {hoursUntilSeasonStart} hours)
                  </b>
                </time>
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

  const options: Options = {
    accessibility: {
      enabled: true,
    },
    title: {
      text: "",
    },
    chart: {
      backgroundColor: "transparent",
      zooming: {
        type: "x",
        resetButton: {
          position: {
            verticalAlign: "middle",
          },
        },
      },
    },
    lang: {
      thousandsSep:
        numberFormatParts.find((i) => i.type === "group")?.value ?? ",",
      decimalPoint:
        numberFormatParts.find((i) => i.type === "decimal")?.value ?? ".",
    },
    credits: {
      enabled: false,
    },
    legend: {
      itemStyle: {
        color: "#c2c7d0",
        fontSize: "15px",
      },
      itemHoverStyle: {
        color: "#fff",
      },
    },
    xAxis: {
      events: {
        afterSetExtremes(event) {
          if (event.trigger !== "zoom") {
            return;
          }

          onZoom({
            min: event.min,
            max: event.max,
          });
        },
      },
      title: {
        text: "Day",
        style: {
          color: "#fff",
          lineColor: "#333",
          tickColor: "#333",
        },
      },
      labels: {
        style: {
          color: "#fff",
          fontWeight: "normal",
        },
      },
      type: "datetime",
      plotBands: createPlotBands(season, region),
      plotLines: season.xAxisPlotLines[region],
    },
    yAxis: {
      title: {
        text: "Score",
        style: {
          color: "#fff",
        },
      },
      labels: {
        style: {
          color: "#fff",
          fontWeight: "normal",
        },
      },
      plotLines: createFactionCutoffPlotlines(season, region),
    },
    tooltip: {
      shared: true,
      outside: true,
    },
    plotOptions: {
      line: {
        dataLabels: {
          enabled: true,
          color: "#fff",
        },
        marker: {
          lineColor: "#333",
          enabled: false,
        },
      },
    },
    series: createSeries(season, region),
  };

  const indexOfCurrentWeek = findIndexOfCurrentWeek(season, region);
  const seasonStartForRegion = season.startDates[region];
  const timePassedSinceSeasonStart = seasonStartForRegion
    ? Date.now() - seasonStartForRegion
    : 0;
  const weeksPassedSinceSeasonStart =
    timePassedSinceSeasonStart / 1000 / 60 / 60 / 24 / 7;

  const cycles =
    weeksPassedSinceSeasonStart > season.affixes.length
      ? Math.ceil(weeksPassedSinceSeasonStart / season.affixes.length) - 1
      : 1;

  const needsTempBanner = season.slug === "df-season-2" && region === "us";

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

          let startTimeOfWeek = 0;
          let endTimeOfWeek = 0;
          let startTime = null;
          let endTime = null;
          let weekOffset = 0;

          if (seasonStartForRegion) {
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
            if (!isCurrentWeek && startTimeOfWeek <= Date.now()) {
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

          return (
            <div
              className={clsx(
                "flex flex-1 flex-col items-center space-y-1",
                isCurrentWeek
                  ? "opacity-100"
                  : isNextWeek
                    ? "opacity-75 hover:opacity-100"
                    : "opacity-50 hover:opacity-100",
                isCurrentWeek
                  ? undefined
                  : "grayscale transition-opacity hover:filter-none",
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
            </div>
          );
        })}
      </div>
      <div className="h-[39vh] lg:h-[30vh]" ref={containerRef}>
        <HighchartsReact highcharts={Highcharts} options={options} ref={ref} />
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
      rel="noopener noreferrer"
      title="MythicStats for this week"
    >
      <img src="/mythic-stats.png" loading="lazy" className="h-4 w-4" alt="" />
    </a>
  );
}

const createSeries = (
  season: EnhancedSeason,
  region: Regions,
): SeriesLineOptions[] => {
  const horde: SeriesLineOptions | null =
    season.crossFactionSupport === "complete"
      ? null
      : {
          type: "line",
          name: "Score Horde",
          color: factionColors.horde,
          data: season.dataByRegion[region]
            .filter((dataset) => dataset.faction === "horde")
            .map((dataset) => {
              return [dataset.ts, dataset.score];
            }),
          dataLabels: {
            formatter,
          },
        };

  const alliance: SeriesLineOptions | null =
    season.crossFactionSupport === "complete"
      ? null
      : {
          type: "line",
          name: "Score Alliance",
          color: factionColors.alliance,
          data: season.dataByRegion[region]
            .filter((dataset) => dataset.faction === "alliance")
            .map((dataset) => {
              return [dataset.ts, dataset.score];
            }),
          dataLabels: {
            formatter,
          },
        };

  const xFaction: SeriesLineOptions | null =
    season.crossFactionSupport === "none"
      ? null
      : {
          type: "line",
          name: "Score X-Faction",
          color: factionColors.xFaction,
          data: season.dataByRegion[region]
            .filter((dataset) => !("faction" in dataset))
            .map((dataset) => {
              return [dataset.ts, dataset.score];
            }),
          dataLabels: {
            formatter,
          },
        };

  const extrapolationData = season.extrapolation[region];

  const extrapolation: SeriesLineOptions | null =
    extrapolationData === null
      ? null
      : {
          type: "line",
          name: "Score Extrapolated",
          color: factionColors.xFaction,
          data: Array.isArray(extrapolationData)
            ? extrapolationData
            : [
                [extrapolationData.from.ts, extrapolationData.from.score],
                [extrapolationData.to.ts, extrapolationData.to.score],
              ],
          dashStyle: "ShortDash",
          dataLabels: {
            formatter,
          },
          marker: {
            enabled: true,
          },
          visible: true,
        };

  const ranks: SeriesLineOptions = {
    type: "line",
    name: "Characters above Cutoff (default hidden)",
    data: season.dataByRegion[region]
      .filter((dataset) => dataset.rank !== null)
      .map((dataset) => [dataset.ts, dataset.rank]),
    dataLabels: {
      formatter,
    },
    color: "white",
    visible: false,
  };

  return [horde, alliance, xFaction, extrapolation, ranks].filter(
    (series): series is SeriesLineOptions =>
      series?.data !== undefined && series.data.length > 0,
  );
};

const formatter = function (this: PointLabelObject) {
  const max = this.series.data.reduce(
    (acc, dataset) => (acc > dataset.x ? acc : dataset.x),
    0,
  );

  return this.x === max ? this.y : null;
};

const createFactionCutoffPlotlines = (
  season: EnhancedSeason,
  region: Regions,
): YAxisPlotLinesOptions[] => {
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
};

const createPlotBands = (
  season: EnhancedSeason,
  region: Regions,
): XAxisPlotBandsOptions[] => {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return [];
  }

  const seasonEnd = season.endDates[region];
  const { affixes, overlaysToDisplay, dataByRegion, crossFactionSupport } =
    season;

  const weeks = seasonEnd
    ? (seasonEnd - seasonStart) / oneWeekInMs + 1
    : affixes.length * 3;

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
      color,
      label: {
        useHTML: true,
        style: {
          display: "flex",
        },
        text: overlaysToDisplay.includes("affixes")
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
        dataByRegion[region],
        crossFactionSupport,
        index === 0,
        from,
        to,
      );

    const text = [
      crossFactionSupport === "complete"
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.horde}">${
            hordeDiff > 0 ? "+" : hordeDiff === 0 ? "±" : ""
          }${hordeDiff.toFixed(1)}</span>`,
      crossFactionSupport === "complete"
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.alliance}">${
            allianceDiff > 0 ? "+" : allianceDiff === 0 ? "±" : ""
          }${allianceDiff.toFixed(1)}</span>`,
      from > now ||
      crossFactionSupport === "none" ||
      (crossFactionSupport === "partial" && xFactionDiff === 0)
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.xFaction}">${
            xFactionDiff > 0 ? "+" : xFactionDiff === 0 ? "±" : ""
          }${xFactionDiff.toFixed(1)}</span>`,
    ].filter(Boolean);

    options.push({
      from,
      to,
      color: "transparent",
      label: {
        verticalAlign: "bottom",
        text: text.join("<br />"),
        useHTML: true,
        y: text.length * -15,
      },
    });

    return options.filter(
      (options): options is XAxisPlotBandsOptions => options !== null,
    );
  });
};

type LocaleTimeProps = {
  date: Date;
};

function LocaleTime({ date }: LocaleTimeProps) {
  return (
    <time className="text-xs" dateTime={date.toISOString()}>
      {date.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
      })}
    </time>
  );
}
