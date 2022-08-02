import type { Factions, Regions } from "@prisma/client";
import { json } from "@remix-run/node";
import type {
  HeadersFunction,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";
import { Graph } from "~/components";
import type { Data } from "~/data";
import { loaderMap } from "~/data";
import { hasSeasonEndedForAllRegions, latestSeason } from "~/meta";
import { isValidRegion } from "~/utils";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=1800, s-maxage=3600",
  };
};

const findCutoff = (data: Data, faction?: Factions, region?: Regions) => {
  if (!region) {
    return 0;
  }

  if (data.crossFactionData.length > 0) {
    if (data.confirmedCutoff?.[region]) {
      const [first] = Object.values(data.confirmedCutoff[region]);

      if (first > 0) {
        return first;
      }
    }

    return data.crossFactionData.reduce((acc, dataset) => {
      return dataset.region === region && dataset.score > acc
        ? dataset.score
        : acc;
    }, 0);
  }

  if (data.confirmedCutoff?.[region]) {
    return Object.values(data.confirmedCutoff[region])[0];
  }

  return data.history.reduce((acc, dataset) => {
    return dataset.faction === faction &&
      dataset.region === region &&
      dataset.score > acc
      ? dataset.score
      : acc;
  }, 0);
};

export const meta: MetaFunction = ({ data, params }) => {
  const region =
    params.region && isValidRegion(params.region) ? params.region : undefined;
  const season =
    params.season === "latest" ? latestSeason : params.season ?? "unknown";

  if (data.crossFactionData.length > 0) {
    const xFactionCutoff = findCutoff(data, undefined, region);

    const description = `${season} cutoff for ${
      region ?? "unknown"
    } @ ${xFactionCutoff}`;

    return {
      charset: "utf-8",
      "og:description": description,
      "twitter:description": description,
      description,
    };
  }

  const hordeCutoff = findCutoff(data, "horde", region);
  const allianceCutoff = findCutoff(data, "alliance", region);

  const description = `${season} cutoff for ${
    region ?? "unknown"
  } -- Alliance ${allianceCutoff} - Horde ${hordeCutoff}`;

  return {
    charset: "utf-8",
    "og:description": description,
    "twitter:description": description,
    description,
  };
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (
    !("season" in params) ||
    !("region" in params) ||
    !params.season ||
    !params.region
  ) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Missing params.",
    });
  }

  if (!isValidRegion(params.region)) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Invalid region.",
    });
  }

  const seasonLoader =
    loaderMap[params.season === "latest" ? latestSeason : params.season];

  if (!seasonLoader) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Unknown season.",
    });
  }

  if (
    params.season !== "latest" &&
    params.season !== latestSeason &&
    hasSeasonEndedForAllRegions(params.season)
  ) {
    request.headers.delete("Cache-Control");
    request.headers.append("Cache-Control", "max-age-18000, s-maxage=36000");
  }

  const data = await seasonLoader({
    region: params.region,
  });

  return json(data);
};

export default function Region(): JSX.Element | null {
  const data = useLoaderData<Data>();
  const params = useParams();
  const region =
    params.region && isValidRegion(params.region) ? params.region : null;

  if (!region) {
    return null;
  }

  return (
    <div className="space-y-4 p-4">
      <Graph
        data={{
          ...data,
          seasonEnding: data.seasonEnding ? data.seasonEnding[region] : null,
          confirmedCutoff: data.confirmedCutoff[region],
          seasonStart: data.seasonStart[region],
          bluePost: data.bluePosts[region],
        }}
        title={params.season === "latest" ? latestSeason : params.season}
      />
    </div>
  );
}
