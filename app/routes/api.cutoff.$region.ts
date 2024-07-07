import { Regions } from "@prisma/client";
import { type LoaderFunctionArgs } from "@remix-run/node";

import { getEnhancedSeason } from "../models/season.server";
import { findSeasonByTimestamp } from "../seasons";

const regionIsRegion = (region: string): region is Regions => region in Regions;

const CURRENT_PH = "%current%";
const NEXT_PH = "%next%";
const ESTIMATION_LABEL = "%label%";

const cutoffResponse: Record<string, string> = {
  en: `Current: ${CURRENT_PH} | Estimation (${ESTIMATION_LABEL}): ${NEXT_PH}`,
  de: `Aktuell: ${CURRENT_PH} | Schätzung (${ESTIMATION_LABEL}): ${NEXT_PH}`,
};

const estimationLabels: Record<
  string,
  { twoWeeks: string; seasonEnd: string }
> = {
  en: {
    twoWeeks: "+2 weeks",
    seasonEnd: "season end",
  },
  de: {
    twoWeeks: "+2 Wochen",
    seasonEnd: "Saisonende",
  },
};

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<Response> => {
  const region = params.region ? params.region.toUpperCase() : null

  if (!region || !regionIsRegion(region)) {
    return new Response(undefined, {
      status: 400,
      statusText: "Region missing.",
    });
  }

  const season = findSeasonByTimestamp();

  if (!season) {
    return new Response(undefined, {
      status: 400,
      statusText: "Could not find an ongoing season.",
    });
  }

  const { headers, season: enhancedSeason } = await getEnhancedSeason({
    overlays: [],
    request,
    regions: [region],
    season,
    timings: {},
  });

  const locale = new URL(request.url).searchParams.get("locale") ?? "en";

  const rawResponseText =
    locale in cutoffResponse ? cutoffResponse[locale] : cutoffResponse.en;
  const endDate = enhancedSeason.endDates[region];

  // ongoing season
  if (!endDate || endDate > Date.now()) {
    const lastDataset =
      enhancedSeason.dataByRegion[region][
        enhancedSeason.dataByRegion[region].length - 1
      ];

    const estimation = enhancedSeason.extrapolation[region];

    let responseText = rawResponseText.replace(
      CURRENT_PH,
      lastDataset.score.toString(),
    );

    if (estimation && Array.isArray(estimation) && estimation.length > 0) {
      const [estimationEndTimestamp, estimatedScore] =
        estimation[estimation.length - 1];

      const labels =
        locale in estimationLabels
          ? estimationLabels[locale]
          : estimationLabels.en;

      if (endDate && estimationEndTimestamp === endDate) {
        responseText = responseText
          .replace(ESTIMATION_LABEL, labels.seasonEnd)
          .replace(NEXT_PH, estimatedScore.toString());
      } else {
        responseText = responseText.replace(ESTIMATION_LABEL, labels.twoWeeks);
      }

      responseText = responseText.replace(NEXT_PH, estimatedScore.toString());
    } else {
      responseText = responseText.split(" | ")[0];
    }

    return new Response(responseText, {
      headers: {
        ...headers,
        "Content-Type": "text/html",
      },
    });
  }

  const lastDataset = [...enhancedSeason.dataByRegion[region]]
    .reverse()
    .find((dataset) => dataset.ts < endDate);

  if (!lastDataset) {
    throw new Error(`Could not find a dataset within season boundaries.`);
  }

  const responseText = rawResponseText.replace(
    CURRENT_PH,
    lastDataset.score.toString(),
  );

  return new Response(responseText, {
    headers: {
      ...headers,
      "Content-Type": "text/html",
    },
  });
};
