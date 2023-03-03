import { Factions, Regions } from "@prisma/client";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type {
  HeadersFunction,
  LoaderFunction,
} from "@remix-run/server-runtime";
import type {
  Options,
  PointLabelObject,
  SeriesLineOptions,
  XAxisPlotBandsOptions,
  YAxisPlotLinesOptions,
} from "highcharts";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useRef, useEffect, Fragment } from "react";
import { red, blue, gray } from "tailwindcss/colors";
import { getAffixIconUrl, getAffixName } from "~/affixes";

import type { Dataset, Season } from "../../seasons";
import {
  findSeasonByName,
  hasSeasonEndedForAllRegions,
  loadDataForRegion,
} from "../../seasons";

export const orderedRegionsBySize: Regions[] = ["eu", "us", "tw", "kr"];

const factionColors: Record<string, string> = {
  alliance: blue["400"],
  horde: red["400"],
  xFaction: "#B389AF",
};

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

type EnhancedSeason = Season & {
  data: Record<Regions, Dataset[]>;
  extrapolation: Record<
    Regions,
    | null
    | [number, number][]
    | {
        from: Dataset;
        to: Dataset;
      }
  >;

  initialZoom: Record<Regions, null | [number, number]>;
};

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

const determineExtrapolationStart = (
  data: Dataset[],
  season: Season,
  region: Regions
): Dataset | null => {
  const seasonStart = season.startDates[region];

  const firstDataset = data.find((dataset) => {
    return dataset.ts >= seasonStart + 4 * oneWeekInMs;
  });

  return firstDataset ?? null;
};

const toOneDigit = (int: number) => {
  return Number.parseFloat(int.toFixed(1));
};

const calculateExtrapolation = (
  season: Season,
  region: Regions,
  data: Dataset[]
): null | [number, number][] | { from: Dataset; to: Dataset } => {
  const seasonEnding = season.endDates[region];

  if (seasonEnding && Date.now() >= seasonEnding) {
    return null;
  }

  const daysUntilSeasonEnding =
    seasonEnding && seasonEnding > Date.now()
      ? (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24
      : null;

  const lastDataset = data[data.length - 1];
  const firstRelevantDataset = determineExtrapolationStart(
    data,
    season,
    region
  );

  if (!firstRelevantDataset) {
    return null;
  }

  const weeks = seasonEnding
    ? (seasonEnding - season.startDates[region]) / oneWeekInMs
    : 36;

  const passedWeeksDiff = Array.from({ length: weeks }, (_, index) => {
    const from = season.startDates[region] + index * oneWeekInMs;
    const to = from + oneWeekInMs;

    const { xFactionDiff } = calculateFactionDiffForWeek(
      data,
      season.crossFactionSupport,
      index === 0,
      from,
      to
    );
    return xFactionDiff;
  })
    .filter(Boolean)
    .slice(4);

  const daysUntilSeasonEndingOrTwoWeeks = daysUntilSeasonEnding ?? 14;
  const to =
    seasonEnding ??
    lastDataset.ts + (daysUntilSeasonEndingOrTwoWeeks / 7) * oneWeekInMs;
  const timeUntilExtrapolationEnd = to - lastDataset.ts;

  // given a couple weeks past the first four, apply weighting on older weeks
  if (
    passedWeeksDiff.length >= 4 &&
    timeUntilExtrapolationEnd > oneWeekInMs / 7
  ) {
    const interval = timeUntilExtrapolationEnd / 14;
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
      ...Array.from<number, [number, number]>({ length: 13 }, (_, i) => {
        return [
          lastDataset.ts + interval * (i + 1),
          toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
        ];
      }),
      [to, toOneDigit(lastDataset.score + scoreIncreaseSteps * 14)],
    ];
  }

  const timePassed = lastDataset.ts - firstRelevantDataset.ts;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;
  const factor = daysUntilSeasonEndingOrTwoWeeks / daysPassed;

  const score = toOneDigit(
    lastDataset.score +
      (lastDataset.score - firstRelevantDataset.score) * factor
  );

  if (timeUntilExtrapolationEnd > oneWeekInMs / 7) {
    const interval = timeUntilExtrapolationEnd / 14;
    const scoreIncreaseSteps = (score - lastDataset.score) / 14;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>({ length: 13 }, (_, i) => {
        return [
          lastDataset.ts + interval * (i + 1),
          toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
        ];
      }),
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

const calculateZoom = (
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
    if (daysUntilSeasonEnding < 1) {
      const offset = (1 + 1 / 7) * oneWeekInMs;
      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }

    if (daysUntilSeasonEnding < 7) {
      const offset = (extrapolation ? 3 : 2) * oneWeekInMs;

      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }
  }

  // offset by +2 weeks since extrapolation is at least tw into the future
  const offset = (extrapolation ? 6 : 4) * oneWeekInMs;

  const backThen = [...data]
    .reverse()
    .find((dataset) => dataset.ts < zoomEnd - offset);

  return [backThen ? backThen.ts : 0, zoomEnd];
};

export const loader: LoaderFunction = async ({ params }) => {
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
  };

  const now = Date.now();

  await Promise.all(
    Object.values(Regions).map(async (region) => {
      const data = await loadDataForRegion(region, season);
      enhancedSeason.data[region] = data;

      if (data.length === 0) {
        return;
      }

      const seasonEnding = season.endDates[region];

      // season ended, no need for zoomies or extrapolation
      if (seasonEnding && seasonEnding <= now) {
        return;
      }

      const extrapolation = calculateExtrapolation(season, region, data);
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
  headers[eTag] = `${season.slug}-${mostRecentDataset}`;

  return json(enhancedSeason, { headers });
};

export default function Season(): JSX.Element | null {
  const season = useLoaderData<EnhancedSeason>();

  return (
    <div className="space-y-4 p-4">
      {orderedRegionsBySize.map((region, index) => {
        return (
          <Fragment key={region}>
            <Card season={season} region={region} />
            {index === orderedRegionsBySize.length - 1 ? null : <hr />}
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

  if (endDate !== null && endDate <= Date.now()) {
    return null;
  }

  const latestDataset = season.data[region][season.data[region].length - 1];

  return (
    Math.floor(
      (latestDataset.ts - season.startDates[region]) / 1000 / 60 / 60 / 24 / 7
    ) - season.affixes.length
  );
};

type CardProps = {
  season: EnhancedSeason;
  region: Regions;
};

const numberFormatParts = new Intl.NumberFormat().formatToParts(1234.5);

function Card({ season, region }: CardProps): JSX.Element {
  const ref = useRef<HighchartsReact.RefObject | null>(null);

  const seasonEndDate = season.endDates[region];
  const confirmedCutoffUrl = season.confirmedCutoffs[region].source;
  const zoom = season.initialZoom[region];

  useEffect(() => {
    if (!ref.current) {
      return;
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
    const seasonHasNotStartedForRegion = season.startDates[region] > Date.now();
    const hoursUntilSeasonStart = seasonHasNotStartedForRegion
      ? Math.max(
          Math.round((season.startDates[region] - Date.now()) / 1000 / 60 / 60),
          1
        )
      : 0;

    return (
      <div className="p-4 bg-gray-700 rounded-lg">
        <h2>
          {seasonHasNotStartedForRegion ? (
            <>
              The season has not started in <b>{region.toUpperCase()}</b> yet.
              Data will appear as soon as possible after{" "}
              <time
                dateTime={new Date(season.startDates[region]).toISOString()}
              >
                <b suppressHydrationWarning>
                  {new Date(season.startDates[region]).toLocaleString()} (T-
                  {hoursUntilSeasonStart} hours)
                </b>
              </time>
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
      plotLines: seasonEndDate
        ? [
            {
              label: {
                text: `Season End`,
                rotation: 0,
                style: {
                  color: "#fff",
                },
              },
              value: seasonEndDate,
              dashStyle: "Dash",
            },
          ]
        : undefined,
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

  return (
    <section
      className="bg-gray-700 rounded-md"
      aria-labelledby={`title-${region}`}
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
            className="underline margin-auto"
          >
            daily updated bluepost
          </a>
        </div>
      ) : null}

      {!seasonEnd || seasonEnd >= Date.now() ? (
        <div className="flex w-full justify-between mb-2">
          {season.affixes.map((set, index) => {
            const isCurrentWeek = index === indexOfCurrentWeek;

            const isNextWeek =
              isCurrentWeek || !indexOfCurrentWeek
                ? false
                : index === indexOfCurrentWeek + 1;

            return (
              <div
                className={[
                  "flex flex-col items-center opacity-50 hover:opacity-100 flex-1",
                  isCurrentWeek
                    ? "opacity-100 md:opacity-100"
                    : "grayscale transition-opacity hover:filter-none",
                  isNextWeek ? "opacity-75 filter-none" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={set.join("-")}
              >
                <span>W{index + 1}</span>
                {set.slice(0, -1).map((affix) => {
                  const affixName = getAffixName(affix);

                  return (
                    <div
                      key={affix}
                      className="flex w-full space-x-2 justify-center"
                    >
                      <img
                        src={getAffixIconUrl(affix)}
                        width={18}
                        height={18}
                        loading="lazy"
                        className="w-4 h-4"
                        title={affixName}
                      />
                      <span className="hidden md:inline text-sm">
                        {affixName.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
      <HighchartsReact highcharts={Highcharts} options={options} ref={ref} />
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
            .filter((dataset) => dataset.faction === Factions.horde)
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
            .filter((dataset) => dataset.faction === Factions.alliance)
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
      series !== null &&
      typeof series.data !== "undefined" &&
      series.data.length > 0
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

  if (Factions.alliance in cutoffs && Factions.horde in cutoffs) {
    return [
      {
        label: {
          text: `Confirmed cutoff for Alliance at ${cutoffs.alliance}`,
          rotation: 0,
          style: {
            color: factionColors.alliance,
          },
        },
        value: cutoffs.alliance,
        dashStyle: "Dash",
      },
      {
        label: {
          text: `Confirmed cutoff for Horde at ${cutoffs.horde}`,
          rotation: 0,
          style: {
            color: factionColors.horde,
          },
        },
        value: cutoffs.horde,
        dashStyle: "Dash",
      },
    ];
  }

  return [];
};

const calculateFactionDiffForWeek = (
  data: Dataset[],
  crossFactionSupport: Season["crossFactionSupport"],
  isFirstWeek: boolean,
  from: number,
  to: number
): { hordeDiff: number; allianceDiff: number; xFactionDiff: number } => {
  const hasCompleteXFactionSupport = crossFactionSupport === "complete";
  const thisWeeksData = data.filter(
    (dataset) => dataset.ts >= from && dataset.ts <= to
  );

  const horde = hasCompleteXFactionSupport
    ? []
    : thisWeeksData.filter((dataset) => dataset.faction === Factions.horde);
  const alliance = hasCompleteXFactionSupport
    ? []
    : thisWeeksData.filter((dataset) => dataset.faction === Factions.alliance);

  const hordeEndMatch = hasCompleteXFactionSupport
    ? null
    : [...horde].reverse()[0];
  const hordeStartMatch = hasCompleteXFactionSupport ? null : horde[0];

  const allianceEndMatch = hasCompleteXFactionSupport
    ? null
    : [...alliance].reverse()[0];
  const allianceStartMatch = hasCompleteXFactionSupport ? null : alliance[0];

  const xFactionEndMatch = hasCompleteXFactionSupport
    ? thisWeeksData[thisWeeksData.length - 1]
    : crossFactionSupport === "partial"
    ? [...thisWeeksData].reverse().find((dataset) => !dataset.faction)
    : null;
  const xFactionStartMatch = hasCompleteXFactionSupport
    ? thisWeeksData[0]
    : crossFactionSupport === "partial"
    ? thisWeeksData.find((dataset) => !dataset.faction)
    : null;

  const hordeDiff =
    hordeEndMatch && hordeStartMatch
      ? hordeEndMatch.score -
        (isFirstWeek && hordeStartMatch === data[0] ? 0 : hordeStartMatch.score)
      : 0;
  const allianceDiff =
    allianceEndMatch && allianceStartMatch
      ? allianceEndMatch.score -
        (isFirstWeek && allianceStartMatch === data[0]
          ? 0
          : allianceStartMatch.score)
      : 0;

  const xFactionDiff =
    xFactionEndMatch && xFactionStartMatch
      ? xFactionEndMatch.score -
        (isFirstWeek && xFactionStartMatch === data[0]
          ? 0
          : xFactionStartMatch.score)
      : 0;

  return {
    hordeDiff,
    allianceDiff,
    xFactionDiff,
  };
};

const createPlotBands = (
  season: EnhancedSeason,
  region: Regions
): XAxisPlotBandsOptions[] => {
  const seasonStart = season.startDates[region];
  const seasonEnd = season.endDates[region];

  const weeks = seasonEnd ? (seasonEnd - seasonStart) / oneWeekInMs : 36;

  return Array.from({
    length: weeks,
  }).flatMap<XAxisPlotBandsOptions>((_, index) => {
    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;
    const color = index % 2 === 0 ? gray["600"] : gray["800"];

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
