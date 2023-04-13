import { type Regions } from "@prisma/client";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  type HeadersFunction,
  type LoaderFunction,
} from "@remix-run/server-runtime";
import {
  type Options,
  type PointLabelObject,
  type SeriesLineOptions,
  type XAxisPlotBandsOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { Fragment, useEffect, useRef } from "react";

import { getAffixIconUrl, getAffixName } from "~/affixes";
import { calculateXAxisPlotLines, type EnhancedSeason } from "~/load.server";
import {
  calculateExtrapolation,
  calculateZoom,
  determineExtrapolationEnd,
} from "~/load.server";
import { loadDataForRegion } from "~/load.server";
import { calculateFactionDiffForWeek } from "~/utils";

import { findSeasonByName, hasSeasonEndedForAllRegions } from "../../seasons";

export const orderedRegionsBySize: Regions[] = ["eu", "us", "tw", "kr"];

const factionColors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#B389AF",
} as const;

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const loaderCache = loaderHeaders.get(cacheControl);

  const headers: HeadersInit = {
    [cacheControl]: loaderCache ?? "max-age=1800, s-maxage=3600",
  };

  const lastModifiedDate = loaderHeaders.get(lastModified);

  if (lastModifiedDate) {
    headers[lastModified] = lastModifiedDate;
  }

  const maybeETag = loaderHeaders.get(eTag);

  if (maybeETag) {
    headers[eTag] = maybeETag;
  }

  return headers;
};

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

export const loader: LoaderFunction = async ({ params, request }) => {
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

  const headers: HeadersInit = {};

  if (hasSeasonEndedForAllRegions(season.slug)) {
    const thirtyDays = 30 * 24 * 60 * 60;
    headers[
      cacheControl
    ] = `public, max-age=${thirtyDays}, s-maxage=${thirtyDays}, immutable`;
  }

  const extrapolationEnd = determineExtrapolationEnd(request.url);

  const enhancedSeason: EnhancedSeason = {
    ...season,
    data: {
      eu: [],
      us: [],
      kr: [],
      tw: [],
    },
    extrapolation: {
      eu: null,
      kr: null,
      tw: null,
      us: null,
    },
    initialZoom: {
      eu: null,
      kr: null,
      tw: null,
      us: null,
    },
    xAxisPlotLines: {
      eu: [],
      us: [],
      kr: [],
      tw: [],
    },
  };

  const now = Date.now();
  const regions: Regions[] = ["eu", "kr", "tw", "us"];

  await Promise.all(
    Object.values(regions).map(async (region) => {
      const data = await loadDataForRegion(region, season);
      enhancedSeason.data[region] = data;

      if (data.length === 0) {
        return;
      }

      const extrapolation = calculateExtrapolation(
        season,
        region,
        data,
        extrapolationEnd
      );

      enhancedSeason.xAxisPlotLines[region] = calculateXAxisPlotLines(
        season,
        region,
        data,
        extrapolation
      );

      const seasonEnding = season.endDates[region];

      // season ended, no need for zoomies or extrapolation
      if (seasonEnding && seasonEnding <= now) {
        return;
      }

      enhancedSeason.extrapolation[region] = extrapolation;

      enhancedSeason.initialZoom[region] = calculateZoom(
        season,
        region,
        data,
        extrapolation
      );
    })
  );

  const mostRecentDataset = Object.values(enhancedSeason.data)
    .flat()
    .reduce((acc, dataset) => (acc > dataset.ts ? acc : dataset.ts), 0);
  headers[lastModified] = new Date(mostRecentDataset).toUTCString();
  headers[eTag] = [season.slug, mostRecentDataset, extrapolationEnd]
    .filter(Boolean)
    .join("-");

  return json(enhancedSeason, { headers });
};

export default function Season(): JSX.Element | null {
  // is any because of a remix type bug. its EnhancedSeason...
  const season = useLoaderData();

  return (
    <div className="space-y-4 p-4">
      {orderedRegionsBySize.map((region, index) => {
        return (
          <Fragment key={region}>
            <Card season={season} region={region} />
            {index === orderedRegionsBySize.length - 1 ? null : (
              <hr className="opacity-50" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

const findIndexOfCurrentWeek = (season: EnhancedSeason, region: Regions) => {
  if (!season.startDates[region] || season.data[region].length === 0) {
    return null;
  }

  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  if ((endDate !== null && endDate <= Date.now()) || !startDate) {
    return null;
  }

  const latestDataset = season.data[region][season.data[region].length - 1];

  return (
    Math.floor((latestDataset.ts - startDate) / 1000 / 60 / 60 / 24 / 7) -
    season.affixes.length
  );
};

type CardProps = {
  season: EnhancedSeason;
  region: Regions;
};

const numberFormatParts = new Intl.NumberFormat().formatToParts(1234.5);

function Card({ season, region }: CardProps): JSX.Element {
  const ref = useRef<HighchartsReact.RefObject | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const seasonEndDate = season.endDates[region];
  const confirmedCutoffUrl = season.confirmedCutoffs[region].source;
  const zoom = season.initialZoom[region];
  const navigation = useNavigation();

  useEffect(() => {
    if (!ref.current) {
      return;
    }

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
  }, [zoom]);

  if (season.data[region].length === 0) {
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
  const seasonEnd = season.endDates[region];
  const isCurrentSeason = seasonEnd === null || seasonEnd > Date.now();

  return (
    <section
      className={`${
        navigation.state === "loading" ? "grayscale" : ""
      } rounded-md bg-gray-700 transition-all duration-500 ease-linear motion-reduce:transition-none`}
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

      <div className="mb-2 flex w-full justify-between">
        {season.affixes.map((set, index) => {
          const isCurrentWeek = index === indexOfCurrentWeek;

          const isNextWeek =
            isCurrentWeek || !indexOfCurrentWeek
              ? false
              : index === indexOfCurrentWeek + 1;

          const affixSetId =
            typeof season.wcl?.weekIndexToAffixSetId[index] === "number"
              ? season.wcl.weekIndexToAffixSetId[index]
              : null;

          return (
            <div
              className={[
                "flex flex-1 flex-col items-center space-y-2",
                isCurrentWeek
                  ? "opacity-100"
                  : isNextWeek
                  ? "opacity-75 hover:opacity-100"
                  : "opacity-50 hover:opacity-100",
                isCurrentWeek
                  ? null
                  : "grayscale transition-opacity hover:filter-none",
                isNextWeek ? "filter-none" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              key={[...set, index].join("-")}
            >
              <span>W{index + 1}</span>

              <span className="flex space-x-1 lg:space-x-2">
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
                    title="Logs for this week"
                  >
                    <img
                      src="https://assets.rpglogs.com/img/warcraft/favicon.png?v=2"
                      loading="lazy"
                      alt="WCL"
                      className="h-4 w-4"
                    />
                  </a>
                ) : null}
                <a
                  href={`https://mplus.subcreation.net/${
                    isCurrentSeason
                      ? ""
                      : `${season.slug.replace("season-", "s")}/`
                  }${set
                    .map((affix) => getAffixName(affix).toLowerCase())
                    .join("-")}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Subcreation for this week"
                >
                  <img
                    src="https://subcreation.net/favicon.ico"
                    loading="lazy"
                    className="h-4 w-4"
                    alt=""
                  />
                </a>
              </span>

              <div>
                {set.slice(0, -1).map((affix) => {
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

const createSeries = (
  season: EnhancedSeason,
  region: Regions
): SeriesLineOptions[] => {
  const horde: SeriesLineOptions | null =
    season.crossFactionSupport === "complete"
      ? null
      : {
          type: "line",
          name: "Score Horde",
          color: factionColors.horde,
          data: season.data[region]
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
          data: season.data[region]
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
          data: season.data[region]
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
        };

  return [horde, alliance, xFaction, extrapolation].filter(
    (series): series is SeriesLineOptions =>
      series?.data !== undefined && series.data.length > 0
  );
};

const formatter = function (this: PointLabelObject) {
  const max = this.series.data.reduce(
    (acc, dataset) => (acc > dataset.x ? acc : dataset.x),
    0
  );

  return this.x === max ? this.y : null;
};

const createFactionCutoffPlotlines = (
  season: EnhancedSeason,
  region: Regions
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
  region: Regions
): XAxisPlotBandsOptions[] => {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return [];
  }

  const seasonEnd = season.endDates[region];

  const weeks = seasonEnd ? (seasonEnd - seasonStart) / oneWeekInMs + 1 : 36;

  return Array.from({
    length: weeks,
  }).flatMap<XAxisPlotBandsOptions>((_, index) => {
    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;
    const color = index % 2 === 0 ? "#4b5563" : "#1f2937";

    const rotation =
      season.affixes[
        index >= season.affixes.length ? index % season.affixes.length : index
      ] ?? [];

    const affixDisplay: XAxisPlotBandsOptions = {
      from,
      to,
      color,
      label: {
        useHTML: true,
        style: {
          display: "flex",
        },
        text: rotation
          .slice(0, 3)
          .map((affix) => {
            return `<img width="18" height="18" style="transform: rotate(-90deg); opacity: 0.75;" src="${getAffixIconUrl(
              affix
            )}" />`;
          })
          .join(""),
        rotation: 90,
        align: "left",
        x: 5,
        y: 5,
      },
    };

    const { allianceDiff, hordeDiff, xFactionDiff } =
      calculateFactionDiffForWeek(
        season.data[region],
        season.crossFactionSupport,
        index === 0,
        from,
        to
      );

    const text = [
      hordeDiff === 0
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.horde}">${
            hordeDiff > 0 ? "+" : ""
          }${hordeDiff.toFixed(1)}</span>`,
      allianceDiff === 0
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.alliance}">${
            allianceDiff > 0 ? "+" : ""
          }${allianceDiff.toFixed(1)}</span>`,
      xFactionDiff === 0
        ? null
        : `<span style="font-size: 10px; color: ${factionColors.xFaction}">${
            xFactionDiff > 0 ? "+" : ""
          }${xFactionDiff.toFixed(1)}</span>`,
    ].filter(Boolean);

    const weeklyGainDisplay: XAxisPlotBandsOptions = {
      from,
      to,
      color: "transparent",
      label: {
        verticalAlign: "bottom",
        text: text.join("<br />"),
        useHTML: true,
        y: text.length * -15,
      },
    };

    return [affixDisplay, weeklyGainDisplay].filter(
      (options): options is XAxisPlotBandsOptions => options !== null
    );
  });
};
