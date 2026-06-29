import { type Regions } from "prisma/generated/prisma/enums";

import { buildEnhancedSeason } from "~/chart/assemble";
import { decode } from "~/data";
import { assembleSeasonData } from "~/data.server";
import { type Timings } from "~/load.server";
import { type EnhancedSeason, type Season } from "~/seasons";
import { type Overlay, resolveOverlaysToDisplay } from "~/utils";

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

/**
 * Server-side `EnhancedSeason` builder for the JSON API routes. Shares the exact
 * assemble path used by the `$season` route's client: compact `SeasonData` ->
 * `decode()` -> `buildEnhancedSeason()`. The main route ships the compact
 * `SeasonData` instead and assembles in the browser.
 */
export const getEnhancedSeason = async ({
  overlays: pOverlays,
  request,
  regions,
  season,
  timings,
}: GetEnhancedSeasonParams): Promise<GetEnhancedSeasonResult> => {
  const { data, recordsPromise, headers } = await assembleSeasonData({
    request,
    regions,
    season,
    timings,
  });

  // JSON API consumers get the full object (no streaming), so await the records
  // the route streams and re-attach them before assembling.
  const overlays = resolveOverlaysToDisplay(season.wcl?.zoneId, pOverlays);
  const enhancedSeason = buildEnhancedSeason(
    decode({ ...data, records: await recordsPromise }),
    season,
    overlays,
  );

  return { season: enhancedSeason, headers };
};
