import { type LoaderFunctionArgs } from "react-router";

import { env } from "../env/server";
import {
  determineOverlaysToDisplayFromSearchParams,
  determineRegionsToDisplayFromSearchParams,
} from "../load.server";
import { getEnhancedSeason } from "../models/season.server";
import { findSeasonByName } from "../seasons";

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<Response> => {
  if (!env.FEATURE_FLAG_API_ENABLED) {
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

  const season = findSeasonByName(params.season, null);

  if (!season) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Unknown season.",
    });
  }

  const regions = determineRegionsToDisplayFromSearchParams(request);
  const overlays = determineOverlaysToDisplayFromSearchParams(request);

  const { season: enhancedSeason, headers } = await getEnhancedSeason({
    request,
    regions,
    overlays,
    season,
    timings: {},
  });

  return new Response(JSON.stringify(enhancedSeason), { headers });
};
