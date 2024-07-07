import { Regions } from "@prisma/client";
import { type LoaderFunctionArgs } from "@remix-run/node";

import { getAffixName } from "../affixes";
import { getEnhancedSeason } from "../models/season.server";
import { findSeasonByTimestamp } from "../seasons";

const CURRENT_WEEK_PH = "%current_week%";
const NEXT_WEEK_PH = "%next_week%";

const affixResponse: Record<string, string> = {
  en: `Current Week: ${CURRENT_WEEK_PH} | Next Week: ${NEXT_WEEK_PH}`,
  de: `Aktuelle Woche: ${CURRENT_WEEK_PH} | Nächste Woche: ${NEXT_WEEK_PH}`,
};

const noDataResponse: Record<string, string> = {
  en: `Affixes still unknown. Come back at a later date.`,
  de: `Affixe noch nicht bekannt. Probier's später wieder.`,
};

const regionIsRegion = (region: string): region is Regions => region in Regions;

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
    regions: [region],
    request,
    season,
    timings: {},
  });

  const locale = new URL(request.url).searchParams.get("locale") ?? "en";

  if (enhancedSeason.affixes.length === 0) {
    const responseText =
      locale in noDataResponse ? noDataResponse[locale] : noDataResponse.en;

    return new Response(responseText, {
      headers: {
        ...headers,
        "Content-Type": "text/html",
      },
    });
  }

  const seasonStartForRegion = enhancedSeason.startDates[region];
  const timePassedSinceSeasonStart = seasonStartForRegion
    ? Date.now() - seasonStartForRegion
    : 0;
  const weeksPassedSinceSeasonStart =
    timePassedSinceSeasonStart / 1000 / 60 / 60 / 24 / 7;

  const currentWeekIndex = Math.ceil(
    weeksPassedSinceSeasonStart % season.affixes.length,
  );

  const currentAffixes = season.affixes[currentWeekIndex - 1];
  const translatedCurrentWeekAffixes = currentAffixes.map((affix) =>
    getAffixName(affix, locale),
  );
  const nextAffixes =
    currentWeekIndex < season.affixes.length
      ? season.affixes[currentWeekIndex]
      : season.affixes[0];

  const translatedNextWeekAffixes = nextAffixes.map((affix) =>
    getAffixName(affix, locale),
  );

  const rawResponseText =
    locale in affixResponse ? affixResponse[locale] : affixResponse.en;

  const response = rawResponseText
    .replace(CURRENT_WEEK_PH, translatedCurrentWeekAffixes.join(", "))
    .replace(NEXT_WEEK_PH, translatedNextWeekAffixes.join(", "));

  return new Response(response, {
    headers: {
      ...headers,
      "Content-Type": "text/html",
    },
  });
};
