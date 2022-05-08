import type { Factions, Regions } from "@prisma/client";
import { json } from "@remix-run/node";
import type {
  HeadersFunction,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";
import { Graph } from "src/components";
import type { Data } from "src/data";
import { loaderMap } from "src/data";
import { latestSeason } from "src/meta";
import { isValidRegion } from "src/utils";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=300, s-maxage=3600",
  };
};

const findCutoff = (data: Data, faction: Factions, region?: Regions) => {
  if (!region) {
    return 0;
  }

  if (data.confirmedCutoff && data.confirmedCutoff[region][faction] > 0) {
    return data.confirmedCutoff[region][faction];
  }

  return data.history.reduce((acc, dataset) => {
    return dataset.faction === faction &&
      dataset.region === region &&
      dataset.customScore > acc
      ? dataset.customScore
      : acc;
  }, 0);
};

export const meta: MetaFunction = ({ data, params }) => {
  const region =
    params.region && isValidRegion(params.region) ? params.region : undefined;
  const season =
    params.season === "latest" ? latestSeason : params.season ?? "unknown";

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

export const loader: LoaderFunction = async ({ params }) => {
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
    <Graph
      data={{
        ...data,
        seasonEnding: data.seasonEnding ? data.seasonEnding[region] : null,
        confirmedCutoff: data.confirmedCutoff[region],
        seasonStart: data.seasonStart[region],
      }}
      title={params.season === "latest" ? latestSeason : params.season}
    />
  );
}
