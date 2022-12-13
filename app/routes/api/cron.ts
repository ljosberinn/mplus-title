/* eslint-disable no-console */
import type { Prisma } from "@prisma/client";
import { Regions } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { load } from "cheerio";
import { prisma } from "~/prisma";
import type { Season } from "~/seasons";
import { findSeasonByTimestamp } from "~/seasons";

const rioBaseUrl = "https://raider.io";

if (!String.prototype.replaceAll) {
  // eslint-disable-next-line no-extend-native, func-names
  String.prototype.replaceAll = function (str, newStr) {
    // If a regex pattern
    if (
      Object.prototype.toString.call(str).toLowerCase() === "[object regexp]"
    ) {
      // @ts-expect-error required polyfill
      return this.replace(str, newStr);
    }

    // If a string
    // @ts-expect-error required polyfill
    return this.replace(new RegExp(str, "gu"), newStr);
  };
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json([], 404);
  }

  try {
    if (process.env.NODE_ENV === "production") {
      const body = await request.text();
      const payload = JSON.parse(body);

      const secret = process.env.SECRET;

      if (!secret) {
        return json({ error: "secret missing" }, 500);
      }

      const maybeSecret = payload.secret;

      if (!maybeSecret || secret !== maybeSecret) {
        return json({ error: "secret missing" }, 403);
      }
    } else {
      console.info("Skipping verification of secret.");
    }

    const season = findSeasonByTimestamp();

    if (!season) {
      return json({ info: "No ongoing season, bailing." });
    }

    console.time("getMostOutdatedRegionForSeason");
    const mostOutdatedRegion = await getMostOutdatedRegionForSeason(season);
    console.timeEnd("getMostOutdatedRegionForSeason");

    if (!mostOutdatedRegion) {
      console.info("ending request early, nothing to update");
      return json([], 204);
    }

    console.time("parseRegionData");
    const regionData = await parseRegionData(mostOutdatedRegion, season.rioKey);
    console.timeEnd("parseRegionData");

    // await prisma.crossFactionHistory.create({ data: regionData });

    return json({ mostOutdatedRegion, regionData });
  } catch (error) {
    console.error("yikes", error);
    return json([], 500);
  }
};

export const loader: LoaderFunction = () => {
  return json([], 405);
};

const getMostOutdatedRegionForSeason = async (season: Season) => {
  const regionsWithSeasonStarted = Object.entries(season.startDates)
    .filter(([, timestamp]) => timestamp < Date.now())
    .map(([region]) => region)
    .filter((region): region is Regions => region in Regions);

  if (regionsWithSeasonStarted.length === 1) {
    return regionsWithSeasonStarted[0];
  }

  const threshold = Math.round(Date.now() / 1000 - 1 * 60 * 60);

  const mostRecentData = await prisma.crossFactionHistory.findMany({
    where: {
      timestamp: {
        gte: threshold,
      },
      region: {
        in:
          regionsWithSeasonStarted.length === 4
            ? undefined
            : regionsWithSeasonStarted,
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      region: true,
      timestamp: true,
    },
  });

  const mostRecentlyUpdatedRegions = new Set(
    mostRecentData.map((dataset) => dataset.region)
  );

  const datasets = await prisma.crossFactionHistory.findMany({
    where: {
      timestamp: {
        lte: threshold,
      },
      region: {
        in:
          regionsWithSeasonStarted.length === 4
            ? undefined
            : regionsWithSeasonStarted,
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      region: true,
      timestamp: true,
    },
  });

  if (datasets.length === 0) {
    return null;
  }

  const mostOutdated = datasets.reduce((acc, dataset) => {
    if (mostRecentlyUpdatedRegions.has(dataset.region)) {
      return acc;
    }

    return acc.timestamp < dataset.timestamp ? acc : dataset;
  }, datasets[0]);

  if (mostRecentlyUpdatedRegions.has(mostOutdated.region)) {
    return null;
  }

  return mostOutdated.region;
};

const createPageUrl = (rioSeasonName: string, region: Regions, page = 0) => {
  return `${rioBaseUrl}/mythic-plus-character-rankings/${rioSeasonName}/${region}/all/all/${page}`;
};

type LastPageUrlParams = {
  url: string;
  page: number;
  initialPage: number;
};

const retrieveLastPageUrl = async (
  rioSeasonName: string,
  region: Regions
): Promise<LastPageUrlParams> => {
  const firstPageUrl = createPageUrl(rioSeasonName, region);
  const firstPageResponse = await fetch(firstPageUrl);
  const firstPageText = await firstPageResponse.text();

  const $firstPage = load(firstPageText);

  const url = $firstPage(".rio-pagination--button").last().attr("href");

  if (!url) {
    return {
      url: "",
      initialPage: 0,
      page: 0,
    };
  }

  const withoutHash = url.includes("#content")
    ? url.replace("#content", "")
    : url;

  const { page, url: urlWithoutPage } = parsePage(withoutHash);

  return {
    url: urlWithoutPage,
    page,
    initialPage: page,
  };
};

const parsePage = (str: string) => {
  const parts = str.split("/");

  return {
    page: Number.parseInt(parts[parts.length - 1]),
    url: parts.slice(0, -1).join("/"),
  };
};

const determineLastEligibleRank = async (
  lastPageParams: LastPageUrlParams
): Promise<number> => {
  const retryDiff = lastPageParams.initialPage - lastPageParams.page;

  if (retryDiff === 3) {
    console.debug("too many retries to determine last eligible rank, bailing");
    return 0;
  }

  const url = `${rioBaseUrl}${lastPageParams.url}/${lastPageParams.page}`;
  const lastPageResponse = await fetch(url);
  const lastPageText = await lastPageResponse.text();
  const $lastPage = load(lastPageText);

  const cellSelector =
    ".mythic-plus-rankings--row:last-of-type .rank-text-normal";

  const textContent = $lastPage(cellSelector).text();

  const totalRankedCharacters = Number.parseInt(
    textContent.replaceAll(",", "")
  );

  if (Number.isNaN(totalRankedCharacters)) {
    const prevPage = lastPageParams.page - 1;

    if (prevPage === 0) {
      console.debug("probably no entries yet, bailing");
      return 0;
    }

    return determineLastEligibleRank({
      ...lastPageParams,
      page: prevPage,
    });
  }

  console.debug({ totalRankedCharacters });

  return Math.floor(totalRankedCharacters * 0.001);
};

const retrieveScore = async (
  rioSeasonName: string,
  region: Regions,
  lastEligibleRank: number
) => {
  const scorePage =
    lastEligibleRank <= 20 ? 0 : Math.floor(lastEligibleRank / 20);

  const scorePageUrl = createPageUrl(
    rioSeasonName,
    region, // if rank is divisible by 20, e.g. 80, it would result in page 4
    // but its still on page 3
    lastEligibleRank % 20 === 0 && lastEligibleRank > 20
      ? scorePage - 1
      : scorePage
  );

  const scorePageResponse = await fetch(scorePageUrl);
  const scorePageText = await scorePageResponse.text();

  const $scorePage = load(scorePageText);

  const maybeScore = Number.parseFloat(
    $scorePage(".mythic-plus-rankings--row .rank-text-normal")
      .filter((_, element) => {
        return (
          $scorePage(element).text().replaceAll(",", "") ===
          `${lastEligibleRank}`
        );
      })
      .parents(".mythic-plus-rankings--row")
      .find("b")
      .text()
  );

  return Number.isNaN(maybeScore) ? 0 : maybeScore;
};

const parseRegionData = async (
  region: Regions,
  rioSeasonName: string
): Promise<Prisma.CrossFactionHistoryCreateInput> => {
  const now = Math.round(Date.now() / 1000);

  console.time("retrieveLastPageUrl");
  const lastPageUrlParams = await retrieveLastPageUrl(rioSeasonName, region);
  console.timeEnd("retrieveLastPageUrl");

  if (!lastPageUrlParams.url) {
    console.warn("Could not parse last page button, bailing without data.");
    return {
      score: 0,
      rank: 0,
      timestamp: now,
      region,
    };
  }

  console.time("determineLastEligibleRank");
  const lastEligibleRank = await determineLastEligibleRank(lastPageUrlParams);
  console.timeEnd("determineLastEligibleRank");

  if (lastEligibleRank === 0) {
    console.warn("Could not parse last eligible rank, bailing without data.");
    return {
      score: 0,
      rank: 0,
      timestamp: now,
      region,
    };
  }

  console.time("retrieveScore");
  const score = await retrieveScore(rioSeasonName, region, lastEligibleRank);
  console.timeEnd("retrieveScore");

  return {
    score,
    rank: lastEligibleRank,
    timestamp: now,
    region,
  };
};
