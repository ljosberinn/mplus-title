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
import { useRef, useEffect } from "react";
import { red, blue, gray } from "tailwindcss/colors";
import { getAffixIconUrl } from "~/affixes";

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
    null | {
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
) => {
  const [first] = data;
  const seasonStart = season.startDates[region];
  const timePassedSinceSeasonStart = first.ts - seasonStart;

  if (timePassedSinceSeasonStart > oneWeekInMs * 2) {
    const firstDatasetAfterTwoWeeks = data.find(
      (dataset) => dataset.ts > seasonStart + oneWeekInMs * 2
    );

    if (firstDatasetAfterTwoWeeks) {
      return firstDatasetAfterTwoWeeks;
    }
  }

  return first;
};

const calculateExtrapolation = (
  season: Season,
  region: Regions,
  data: Dataset[]
) => {
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

  const timePassed = lastDataset.ts - firstRelevantDataset.ts;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;

  if (daysPassed <= 14) {
    return null;
  }

  const daysUntilSeasonEndingOrTwoWeeks = daysUntilSeasonEnding ?? 14;
  const factor = daysUntilSeasonEndingOrTwoWeeks / daysPassed;

  const score = Number.parseFloat(
    (
      lastDataset.score +
      (lastDataset.score - firstRelevantDataset.score) * factor
    ).toFixed(1)
  );

  const extrapolationTimestamp =
    seasonEnding ??
    lastDataset.ts + (daysUntilSeasonEndingOrTwoWeeks / 7) * oneWeekInMs;

  return {
    from: firstRelevantDataset,
    to: {
      score,
      ts: extrapolationTimestamp,
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

  const zoomEnd = extrapolation?.to.ts ?? data[data.length - 1].ts;

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

  if (hasSeasonEndedForAllRegions(season.slug)) {
    request.headers.delete(cacheControl);
    const thirtyDays = 30 * 24 * 60 * 60;
    request.headers.append(
      cacheControl,
      `public, max-age=${thirtyDays}, s-maxage=${thirtyDays}, immutable`
    );
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
  request.headers.append(
    lastModified,
    new Date(mostRecentDataset).toUTCString()
  );

  request.headers.append(eTag, `${season.slug}-${mostRecentDataset}`);

  return json(enhancedSeason);
};

export default function Season(): JSX.Element | null {
  const season = useLoaderData<EnhancedSeason>();

  return (
    <div className="space-y-4 p-4">
      {orderedRegionsBySize.map((region) => {
        return <Graph season={season} key={region} region={region} />;
      })}
    </div>
  );
}

type GraphProps = {
  season: EnhancedSeason;
  region: Regions;
};

const numberFormatParts = new Intl.NumberFormat().formatToParts(1234.5);

function Graph({ season, region }: GraphProps): JSX.Element {
  const ref = useRef<HighchartsReact.RefObject | null>(null);

  const seasonEndDate = season.endDates[region];
  const confirmedCutoffUrl = season.confirmedCutoffs[region].source;
  const zoom = season.initialZoom[region];

  useEffect(() => {
    if (!ref.current || !zoom) {
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
      text:
        region && confirmedCutoffUrl
          ? `<a target="_blank" style="text-decoration: underline;" href="${confirmedCutoffUrl}">${region.toUpperCase()} (click for daily updated bluepost)</a>`
          : region.toUpperCase(),
      style: {
        color: "#fff",
      },
      useHTML: true,
    },
    chart: {
      backgroundColor: gray["700"],
      borderRadius: 4,
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

  return (
    <HighchartsReact highcharts={Highcharts} options={options} ref={ref} />
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
          data: [
            [extrapolationData.from.ts, extrapolationData.from.score],
            [extrapolationData.to.ts, extrapolationData.to.score],
          ],
          dashStyle: "Dash",
          dataLabels: {
            formatter,
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

const createPlotBands = (
  season: EnhancedSeason,
  region: Regions
): XAxisPlotBandsOptions[] => {
  const seasonStart = season.startDates[region];
  const seasonEnd = season.endDates[region];

  const weeks = seasonEnd ? (seasonEnd - seasonStart) / oneWeekInMs : 36;

  const hasCompleteXFactionSupport = season.crossFactionSupport === "complete";

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

    const isFirstWeek = index === 0;

    const thisWeeksData = season.data[region].filter(
      (dataset) => dataset.ts >= from && dataset.ts <= to
    );

    const horde = hasCompleteXFactionSupport
      ? []
      : thisWeeksData.filter((dataset) => dataset.faction === Factions.horde);
    const alliance = hasCompleteXFactionSupport
      ? []
      : thisWeeksData.filter(
          (dataset) => dataset.faction === Factions.alliance
        );

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
      : season.crossFactionSupport === "partial"
      ? [...thisWeeksData].reverse().find((dataset) => !dataset.faction)
      : null;
    const xFactionStartMatch = hasCompleteXFactionSupport
      ? thisWeeksData[0]
      : season.crossFactionSupport === "partial"
      ? thisWeeksData.find((dataset) => !dataset.faction)
      : null;

    const hordeDiff =
      hordeEndMatch && hordeStartMatch
        ? hordeEndMatch.score -
          (isFirstWeek && hordeStartMatch === season.data[region][0]
            ? 0
            : hordeStartMatch.score)
        : 0;
    const allianceDiff =
      allianceEndMatch && allianceStartMatch
        ? allianceEndMatch.score -
          (isFirstWeek && allianceStartMatch === season.data[region][0]
            ? 0
            : allianceStartMatch.score)
        : 0;

    const xFactionDiff =
      xFactionEndMatch && xFactionStartMatch
        ? xFactionEndMatch.score -
          (isFirstWeek && xFactionStartMatch === season.data[region][0]
            ? 0
            : xFactionStartMatch.score)
        : 0;

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
