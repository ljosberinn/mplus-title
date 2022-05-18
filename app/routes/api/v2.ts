/* eslint-disable no-console */
import type { Prisma, Regions } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { load } from "cheerio";
import { seasonStartDates } from "~/meta";
import { prisma } from "~/prisma";

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

const determineSeason = (region: Regions) => {
  const firstMatch = Object.entries(seasonStartDates).find(
    ([, regionStartMap]) => {
      return Date.now() >= regionStartMap[region];
    }
  );

  if (!firstMatch) {
    throw new Error("could not determine current season");
  }

  return firstMatch[0].replace("-season", "");
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json([], 404);
  }

  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    if (process.env.NODE_ENV === "production") {
      const secret = process.env.SECRET;

      if (!secret) {
        return json({ error: "secret missing" }, 500);
      }

      const maybeSecret = payload.secret;

      if (!maybeSecret || secret !== maybeSecret) {
        return json({ error: "secret missing" }, 403);
      }
    } else {
      console.info("Skipping verification of secret.", { payload });
    }

    console.time("getMostOutdatedRegion");
    const mostOutdatedRegion = await getMostOutdatedRegion();
    console.timeEnd("getMostOutdatedRegion");

    if (!mostOutdatedRegion) {
      console.info("ending request early, nothing to update");
      return json([], 204);
    }

    console.time("parseRegionData");
    const regionData = await parseRegionData(mostOutdatedRegion ?? "us");
    console.timeEnd("parseRegionData");

    await prisma.crossFactionHistory.create({ data: regionData });

    return json({ mostOutdatedRegion, regionData });
  } catch (error) {
    console.error("yikes", error);
    return json([], 500);
  }
};

export const loader: LoaderFunction = () => {
  return json([], 405);
};

const getMostOutdatedRegion = async () => {
  const threshold = Math.round(Date.now() / 1000 - 1 * 60 * 60);

  const mostRecentData = await prisma.crossFactionHistory.findMany({
    where: {
      timestamp: {
        gte: threshold,
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

const createPageUrl = (region: Regions, page = 0) => {
  const season = determineSeason(region);
  return `${rioBaseUrl}/mythic-plus-character-rankings/season-${season}/${region}/all/all/${page}`;
};

const retrieveLastPageUrl = async (region: Regions) => {
  const firstPageUrl = createPageUrl(region);
  const firstPageResponse = await fetch(firstPageUrl);
  const firstPageText = await firstPageResponse.text();

  const $firstPage = load(firstPageText);

  return $firstPage(".rio-pagination--button").last().attr("href");
};

const determineLastEligibleRank = async (lastPageUrl: string) => {
  const lastPageResponse = await fetch(`${rioBaseUrl}${lastPageUrl}`);
  const lastPageText = await lastPageResponse.text();
  const $lastPage = load(lastPageText);

  const cellSelector =
    ".mythic-plus-rankings--row:last-of-type .rank-text-normal";

  const totalRankedCharacters = Number.parseInt(
    $lastPage(cellSelector).text().replaceAll(",", "")
  );

  return Math.floor(totalRankedCharacters * 0.001);
};

const retrieveScore = async (region: Regions, lastEligibleRank: number) => {
  const scorePage =
    lastEligibleRank <= 20 ? 0 : Math.floor(lastEligibleRank / 20);

  const scorePageUrl = createPageUrl(
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
  region: Regions
): Promise<Prisma.CrossFactionHistoryCreateInput> => {
  const now = Math.round(Date.now() / 1000);

  console.time("retrieveLastPageUrl");
  const lastPageUrl = await retrieveLastPageUrl(region);
  console.timeEnd("retrieveLastPageUrl");

  if (!lastPageUrl) {
    console.warn("Could not parse last page button, bailing without data.");
    return {
      score: 0,
      rank: 0,
      timestamp: now,
      region,
    };
  }

  console.time("determineLastEligibleRank");
  const lastEligibleRank = await determineLastEligibleRank(lastPageUrl);
  console.timeEnd("determineLastEligibleRank");
  console.time("retrieveScore");
  const score = await retrieveScore(region, lastEligibleRank);
  console.timeEnd("retrieveScore");

  return {
    score,
    rank: lastEligibleRank,
    timestamp: now,
    region,
  };
};
