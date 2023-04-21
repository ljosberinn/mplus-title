import { type LoaderArgs, type TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  determineOverlaysToDisplayFromSearchParams,
  determineRegionsToDisplayFromSearchParams,
} from "~/load.server";
import { getEnhancedSeason } from "~/models/season.server";
import { type EnhancedSeason } from "~/seasons";
import { findSeasonByName } from "~/seasons";

export const loader = async ({
  params,
  request,
}: LoaderArgs): Promise<TypedResponse<EnhancedSeason>> => {
  if (process.env.FEATURE_FLAG_API_ENABLED !== "true") {
    throw new Response(undefined, {
      status: 501,
      statusText: "API is not enabled.",
    });
  }

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

  const regions = determineRegionsToDisplayFromSearchParams(request);
  const overlays = determineOverlaysToDisplayFromSearchParams(request);

  const { season: enhancedSeason } = await getEnhancedSeason({
    request,
    regions,
    overlays,
    season,
  });

  return json(enhancedSeason);
};
