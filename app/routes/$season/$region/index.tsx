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

export const meta: MetaFunction = ({ data, params }) => {
  const region = params.region ?? "unknown";
  const season =
    params.season === "latest" ? latestSeason : params.season ?? "unknown";

  const castedData = data as Data;

  const hordeCutoff: number =
    castedData.confirmedCutoff && castedData.confirmedCutoff.horde > 0
      ? castedData.confirmedCutoff.horde
      : castedData.history.reduce((acc, dataset) => {
          return dataset.faction === "horde" &&
            dataset.region === region &&
            dataset.customScore > acc
            ? dataset.customScore
            : acc;
        }, 0);
  const allianceCutoff: number =
    castedData.confirmedCutoff && castedData.confirmedCutoff.alliance > 0
      ? castedData.confirmedCutoff.alliance
      : castedData.history.reduce((acc, dataset) => {
          return dataset.faction === "alliance" &&
            dataset.region === region &&
            dataset.customScore > acc
            ? dataset.customScore
            : acc;
        }, 0);

  const description = `${season} cutoff for ${region} -- Alliance ${allianceCutoff} - Horde ${hordeCutoff}`;

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

export default function Region(): JSX.Element {
  const data = useLoaderData<Data>();
  const params = useParams();

  return (
    <Graph
      data={data}
      title={params.season === "latest" ? latestSeason : params.season}
    />
  );
}
