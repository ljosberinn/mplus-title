import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type {
  HeadersFunction,
  LoaderFunction,
} from "@remix-run/server-runtime";
import { Graph } from "~/components";
import type { Data } from "~/data";
import { loaderMap } from "~/data";
import { latestSeason, orderedGeasonsBySize } from "~/meta";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "max-age=300, s-maxage=3600",
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
      {orderedGeasonsBySize.map((region) => {
        const subset = data.history.filter(
          (dataset) => dataset.region === region
        );

        return (
          <Graph
            data={{
              seasonStart: data.seasonStart[region],
              confirmedCutoff: data.confirmedCutoff[region],
              history: subset,
              seasonEnding: data.seasonEnding
                ? data.seasonEnding[region]
                : null,
              affixRotation: data.affixRotation,
            }}
            title={region.toUpperCase()}
            key={region}
          />
        );
      })}
    </>
  );
}
