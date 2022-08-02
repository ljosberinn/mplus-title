import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type {
  HeadersFunction,
  LoaderFunction,
} from "@remix-run/server-runtime";
import { Graph } from "~/components";
import type { Data } from "~/data";
import { loaderMap } from "~/data";
import {
  hasSeasonEndedForAllRegions,
  latestSeason,
  orderedRegionsBySize,
} from "~/meta";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=1800, s-maxage=3600",
  };
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (!("season" in params) || !params.season) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Missing params.",
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

  const data = await seasonLoader();

  return json(data);
};

export default function Season(): JSX.Element {
  const data = useLoaderData<Data>();

  return (
    <div className="space-y-4 p-4">
      {orderedRegionsBySize.map((region) => {
        const seasonStart = data.seasonStart[region];

        const history = data.history.filter(
          (dataset) =>
            dataset.region === region && dataset.timestamp > seasonStart
        );

        const crossFactionData = data.crossFactionData.filter(
          (dataset) =>
            dataset.region === region && dataset.timestamp > seasonStart
        );

        return (
          <Graph
            data={{
              seasonStart: data.seasonStart[region],
              confirmedCutoff: data.confirmedCutoff[region],
              history,
              seasonEnding: data.seasonEnding
                ? data.seasonEnding[region]
                : null,
              affixRotation: data.affixRotation,
              crossFactionData,
              bluePost: data.bluePosts[region],
            }}
            title={region.toUpperCase()}
            key={region}
          />
        );
      })}
    </div>
  );
}
