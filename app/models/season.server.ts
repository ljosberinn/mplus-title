import { type Regions } from "@prisma/client";

import {
  calculateExtrapolation,
  calculateXAxisPlotLines,
  calculateZoom,
  determineExpirationTimestamp,
  determineExtrapolationEnd,
  loadDataForRegion,
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
};
type GetEnhancedSeasonResult = {
  headers: HeadersInit;
  season: EnhancedSeason;
};
export const getEnhancedSeason = async ({
  overlays: pOverlays,
  request,
  regions: pRegions,
  season,
}: GetEnhancedSeasonParams): Promise<GetEnhancedSeasonResult> => {
  const headers: HeadersInit = {};

  if (hasSeasonEndedForAllRegions(season.slug)) {
    const thirtyDays = 30 * 24 * 60 * 60;
    headers[
      cacheControl
    ] = `public, max-age=${thirtyDays}, s-maxage=${thirtyDays}, immutable`;
  }

  const extrapolationEnd = determineExtrapolationEnd(request);

  const regions = pRegions ?? orderedRegionsBySize;
  const overlays = pOverlays ?? defaultOverlays;

  const enhancedSeason: EnhancedSeason = {
    ...season,
    regionsToDisplay: regions,
    overlaysToDisplay: [...overlays],
    dataByRegion: {
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

  await Promise.all(
    Object.values(regions).map(async (region) => {
      const data = await loadDataForRegion(region, season);
      enhancedSeason.dataByRegion[region] = data;

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
        extrapolation,
        overlays
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

  const mostRecentDataset = Object.values(enhancedSeason.dataByRegion)
    .flat()
    .reduce((acc, dataset) => (acc > dataset.ts ? acc : dataset.ts), 0);

  headers[lastModified] = new Date(mostRecentDataset).toUTCString();

  const shortestExpiry = regions
    .map((region) =>
      determineExpirationTimestamp(
        season,
        region,
        enhancedSeason.dataByRegion[region]
      )
    )
    .reduce(
      (acc, expiry) => (acc > expiry ? expiry : acc),
      Number.POSITIVE_INFINITY
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
