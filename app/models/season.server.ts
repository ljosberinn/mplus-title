import { type Regions } from "@prisma/client";

import {
  calculateSeries,
  calculateXAxisPlotBands,
  calculateYAxisPlotLines,
  loadRecordsForSeason,
  type Timings,
} from "~/load.server";
import {
  calculateExtrapolation,
  calculateXAxisPlotLines,
  calculateZoom,
  determineExpirationTimestamp,
  determineExtrapolationEnd,
  loadDataForRegion,
  time,
} from "~/load.server";
import { type Season } from "~/seasons";
import { type EnhancedSeason, hasSeasonEndedForAllRegions } from "~/seasons";
import {
  isNotNull,
  orderedRegionsBySize,
  type Overlay,
  overlays as defaultOverlays,
} from "~/utils";

const lastModified = "Last-Modified";
const cacheControl = "Cache-Control";
const eTag = "ETag";
const expires = "Expires";

type GetEnhancedSeasonParams = {
  overlays: Overlay[] | null;
  request: Request;
  regions: Regions[] | null;
  season: Season;
  timings: Timings;
};
type GetEnhancedSeasonResult = {
  headers: Record<string, string>;
  season: EnhancedSeason;
};
export const getEnhancedSeason = async ({
  overlays: pOverlays,
  request,
  regions: pRegions,
  season,
  timings,
}: GetEnhancedSeasonParams): Promise<GetEnhancedSeasonResult> => {
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
  const overlays = pOverlays ?? defaultOverlays;

  const enhancedSeason: EnhancedSeason = {
    ...season,
    records: [],
    score: {
      regionsToDisplay: regions,
      overlaysToDisplay: [...overlays],
      dataByRegion: {
        EU: [],
        US: [],
        KR: [],
        TW: [],
        CN: [],
      },
      extrapolation: {
        EU: null,
        KR: null,
        TW: null,
        US: null,
        CN: null,
      },
      initialZoom: {
        EU: null,
        KR: null,
        TW: null,
        US: null,
        CN: null,
      },
      xAxisPlotLines: {
        EU: [],
        US: [],
        KR: [],
        TW: [],
        CN: [],
      },
      yAxisPlotLines: {
        EU: [],
        US: [],
        KR: [],
        TW: [],
        CN: [],
      },
      xAxisPlotBands: {
        EU: [],
        US: [],
        KR: [],
        TW: [],
        CN: [],
      },
      series: {
        EU: [],
        US: [],
        KR: [],
        TW: [],
        CN: [],
      },
      chartBlueprint: {
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
            text: "Date",
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
          plotBands: [],
          plotLines: [],
        },
        yAxis: {
          title: {
            text: "Score",
            style: {
              color: "#fff",
            },
          },
          gridLineColor: `rgba(255, 255, 255, 0.25)`,
          labels: {
            style: {
              color: "#fff",
              fontWeight: "normal",
            },
          },
          plotLines: [],
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
      },
    },
  };

  const now = Date.now();

  async function getRecordsForSeason() {
    enhancedSeason.records = await time(
      () => loadRecordsForSeason(season, overlays),
      { type: "loadRecordsForSeason", timings },
    );
  }

  await Promise.all([
    getRecordsForSeason(),
    ...Object.values(regions).map(async (region) => {
      const data = await loadDataForRegion(region, season, timings);
      enhancedSeason.score.dataByRegion[region] = data;

      if (data.length === 0) {
        return;
      }

      const extrapolation = await time(
        () => calculateExtrapolation(season, region, data, extrapolationEnd),
        { type: `calculateExtrapolation-${region}`, timings },
      );

      enhancedSeason.score.xAxisPlotLines[region] = await time(
        () =>
          calculateXAxisPlotLines(
            season,
            region,
            data,
            extrapolation,
            overlays,
          ),
        { type: `calculateXAxisPlotLines-${region}`, timings },
      );

      enhancedSeason.score.yAxisPlotLines[region] = await time(
        () => calculateYAxisPlotLines(season, region),
        { type: `calculateYAxisPlotLines-${region}`, timings },
      );

      enhancedSeason.score.xAxisPlotBands[region] = await time(
        () => calculateXAxisPlotBands(season, region, data, overlays),
        { type: `calculateXAxisPlotBands-${region}`, timings },
      );

      enhancedSeason.score.series[region] = await time(
        () => calculateSeries(season, data, extrapolation),
        { type: `calculateSeries-${region}`, timings },
      );

      const seasonEnding = season.endDates[region];

      // season ended, no need for zoomies or extrapolation
      if (seasonEnding && seasonEnding <= now) {
        return;
      }

      enhancedSeason.score.extrapolation[region] = extrapolation;

      enhancedSeason.score.initialZoom[region] = await time(
        () => calculateZoom(season, region, data, extrapolation),
        { type: `calculateZoom-${region}`, timings },
      );
    }),
  ]);

  const mostRecentDataset = Object.values(enhancedSeason.score.dataByRegion)
    .flat()
    .reduce((acc, dataset) => (acc > dataset.ts ? acc : dataset.ts), 0);

  headers[lastModified] = new Date(mostRecentDataset).toUTCString();

  const shortestExpiry = await time(
    () =>
      regions
        .map((region) =>
          determineExpirationTimestamp(
            season,
            region,
            enhancedSeason.score.dataByRegion[region],
          ),
        )
        .reduce(
          (acc, expiry) => (acc > expiry ? expiry : acc),
          Number.POSITIVE_INFINITY,
        ),
    { type: "shortestExpiry", timings },
  );

  headers[expires] = new Date(shortestExpiry * 1000 + Date.now()).toUTCString();
  headers[eTag] = [
    season.slug,
    mostRecentDataset,
    extrapolationEnd,
    ...regions,
    ...overlays,
  ]
    .filter(isNotNull)
    .sort((a, b) => (a > b ? 1 : -1))
    .join("-");

  return { season: enhancedSeason, headers };
};
