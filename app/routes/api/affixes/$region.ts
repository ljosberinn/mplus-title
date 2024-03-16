import { Regions } from "@prisma/client";
import { type LoaderArgs, type TypedResponse } from "@remix-run/node";

import { getAffixName } from "~/affixes";
import { findSeasonByTimestamp } from "~/seasons";

import { loader as enhancedSeasonLoader } from "../../$season/index";

type AffixResponse = {};

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

const regionisRegion = (region: string): region is Regions => region in Regions;

export const loader = async ({
  params,
  request,
  context,
}: LoaderArgs): Promise<TypedResponse<AffixResponse>> => {
  const { region } = params;

  if (!region || !regionisRegion(region)) {
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

  const enhancedSeasonUrl = new URL(request.url);
  enhancedSeasonUrl.searchParams.set("regions", region);

  const enhancedSeasonResponse = await enhancedSeasonLoader({
    params: {
      season: season.slug,
    },
    request: new Request(enhancedSeasonUrl),
    context,
  });

  if (!enhancedSeasonResponse.ok) {
    return new Response(undefined, {
      status: 400,
      statusText: "Unable to load seasonal data.",
    });
  }

  const enhancedSeason = await enhancedSeasonResponse.json();
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";

  if (enhancedSeason.affixes.length === 0) {
    const responseText =
      locale in noDataResponse ? noDataResponse[locale] : noDataResponse.en;

    return new Response(responseText, {
      headers: {
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
      "Content-Type": "text/html",
      Expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString(),
    },
  });
};
