/**
 * Rebuilds the fully-baked `EnhancedSeason` from decoded compact `SeasonData`
 * plus the bundled season config. Pure and client-safe, so it
 * runs in the browser for the `$season` route and on the server for the JSON
 * API routes (via `getEnhancedSeason`). Mirrors the per-region assembly that
 * used to live inline in `getEnhancedSeason`.
 */
import { type Regions } from "prisma/generated/prisma/enums";

import { type DecodedSeasonData } from "../data";
import { type EnhancedSeason, type Season } from "../seasons";
import { type Overlay } from "../utils";
import {
  calculateSeries,
  calculateXAxisPlotBands,
  calculateXAxisPlotLines,
  calculateYAxisPlotLines,
  calculateZoom,
} from "./builders";

function emptyByRegion<T>(make: () => T): Record<Regions, T> {
  return {
    EU: make(),
    US: make(),
    KR: make(),
    TW: make(),
    CN: make(),
  };
}

export function buildEnhancedSeason(
  decoded: DecodedSeasonData,
  season: Season,
  overlays: readonly Overlay[],
): EnhancedSeason {
  const now = Date.now();

  const score: EnhancedSeason["score"] = {
    regionsToDisplay: decoded.regionsToDisplay,
    overlaysToDisplay: [...overlays],
    dataByRegion: emptyByRegion(() => []),
    extrapolation: emptyByRegion(() => null),
    initialZoom: emptyByRegion(() => null),
    xAxisPlotLines: emptyByRegion(() => []),
    yAxisPlotLines: emptyByRegion(() => []),
    xAxisPlotBands: emptyByRegion(() => []),
    series: emptyByRegion(() => []),
  };

  for (const region of decoded.regionsToDisplay) {
    const regionData = decoded.regions[region];

    if (!regionData) {
      continue;
    }

    const { data, extrapolation, extrapolation100, extrapolationHistory } =
      regionData;

    score.dataByRegion[region] = data;

    if (data.length === 0) {
      continue;
    }

    score.xAxisPlotLines[region] = calculateXAxisPlotLines(
      season,
      region,
      data,
      extrapolation,
      overlays,
    );
    score.yAxisPlotLines[region] = calculateYAxisPlotLines(season, region);
    score.xAxisPlotBands[region] = calculateXAxisPlotBands(
      season,
      region,
      data,
    );
    score.series[region] = calculateSeries(
      season,
      data,
      extrapolation,
      extrapolationHistory,
      extrapolation100,
    );

    const seasonEnding = season.endDates[region];

    // season ended, no need for zoomies or extrapolation
    if (seasonEnding && seasonEnding <= now) {
      continue;
    }

    score.extrapolation[region] = extrapolation;
    score.initialZoom[region] = calculateZoom(
      season,
      region,
      data,
      extrapolation,
    );
  }

  return {
    ...season,
    records: decoded.records,
    score,
  };
}
