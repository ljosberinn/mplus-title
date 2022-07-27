import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type {
  HeadersFunction,
  LoaderFunction,
} from "@remix-run/server-runtime";
import { Graph } from "~/components";
import type { Data } from "~/data";
import { loaderMap } from "~/data";
import { latestSeason, orderedRegionsBySize } from "~/meta";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=1800, s-maxage=3600",
  };
};

export const loader: LoaderFunction = async ({ params }) => {
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

  const data = await seasonLoader();

  return json(data);
};

export default function Season(): JSX.Element {
  const data = useLoaderData<Data>();

  return (
    <>
      {orderedRegionsBySize.map((region) => {
        const history = data.history.filter(
          (dataset) => dataset.region === region
        );

        const crossFactionData = data.crossFactionData.filter(
          (dataset) => dataset.region === region
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
              bluePost: data.bluePosts[region]
            }}
            title={region.toUpperCase()}
            key={region}
          />
        );
      })}
    </>
  );
}
