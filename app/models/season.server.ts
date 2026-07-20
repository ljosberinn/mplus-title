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

  const records = await recordsPromise;
  const overlays = resolveOverlaysToDisplay(season.wcl?.zoneId, pOverlays);
  const enhancedSeason = buildEnhancedSeason(
    decode({
      ...data,
      records,
    }),
    season,
    overlays,
  );

  return { season: enhancedSeason, headers };
};
