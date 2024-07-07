/* eslint-disable no-console */
import { type Prisma } from "@prisma/client";
import { Regions } from "@prisma/client";
import { type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { load } from "cheerio";

import { protectCronRoute } from "~/load.server";

import { prisma } from "../prisma.server";
import { type Season, seasons } from "../seasons";

const rioBaseUrl = "https://raider.io";

if (!String.prototype.replaceAll) {
  // eslint-disable-next-line no-extend-native, func-names
  String.prototype.replaceAll = function (str, newStr) {
    // If a regex pattern
    if (
      Object.prototype.toString.call(str).toLowerCase() === "[object regexp]"
    ) {
      return this.replace(str, newStr);
    }

    // If a string
    return this.replaceAll(new RegExp(str, "gu"), newStr);
  };
}

const regions = [Regions.US, Regions.EU, Regions.KR, Regions.TW];

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json([], 404);
  }

  try {
    const failed = await protectCronRoute(request);

    if (failed) {
      return json(failed.payload, failed.status);
    }

    const latestPerRegion = await prisma.crossFactionHistory.findMany({
      where: {
        region: {
          in: regions,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      select: {
        timestamp: true,
        region: true,
      },
      distinct: ["region"],
    });

    const mostOutdatedRegion = latestPerRegion.reduce((acc, dataset) => {
      if (acc.timestamp < dataset.timestamp) {
        return acc;
      }

      return dataset;
    }, latestPerRegion[0]);

    console.info("most outdated region:", mostOutdatedRegion.region);

    const season = findSeasonForRegion(mostOutdatedRegion.region);

    if (!season) {
      return json([]);
    }

    console.info("using season:", season.name);

    console.time("parseRegionData");
    const regionData = await parseRegionData(
      mostOutdatedRegion.region,
      season.rioKey,
    );
    console.timeEnd("parseRegionData");

    await prisma.crossFactionHistory.create({ data: regionData });

    return json({ region: mostOutdatedRegion.region, regionData });
  } catch (error) {
    console.error("yikes", error);
    return json([], 500);
  }
};

export const loader: LoaderFunction = () => {
  return json([], 405);
};

function findSeasonForRegion(region: Regions): Season | null {
  for (const season of seasons) {
    const startDate = season.startDates[region];

    if (startDate && startDate < Date.now()) {
      return season;
    }
  }

  return null;
}

function createPageUrl(rioSeasonName: string, region: Regions, page = 0) {
  return `${rioBaseUrl}/mythic-plus-character-rankings/${rioSeasonName}/${region}/all/all/${page}`;
}

type LastPageUrlParams = {
  url: string;
  page: number;
  initialPage: number;
};

async function retrieveLastPageUrl(
  rioSeasonName: string,
  region: Regions,
): Promise<LastPageUrlParams> {
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
}

function parsePage(str: string) {
  const parts = str.split("/");

  return {
    page: Number.parseInt(parts[parts.length - 1]),
    url: parts.slice(0, -1).join("/"),
  };
}

async function determineLastEligibleRank(
  lastPageParams: LastPageUrlParams,
): Promise<number> {
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
    textContent.replaceAll(",", ""),
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
}

async function retrieveScore(
  rioSeasonName: string,
  region: Regions,
  lastEligibleRank: number,
) {
  const scorePage =
    lastEligibleRank <= 40 ? 0 : Math.floor(lastEligibleRank / 40);

  const scorePageUrl = createPageUrl(
    rioSeasonName,
    region, // if rank is divisible by 40, e.g. 80, it would result in page 4
    // but its still on page 3
    lastEligibleRank % 40 === 0 && lastEligibleRank > 40
      ? scorePage - 1
      : scorePage,
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
      .text(),
  );

  return Number.isNaN(maybeScore) ? 0 : maybeScore;
}

async function parseRegionData(
  region: Regions,
  rioSeasonName: string,
): Promise<Prisma.CrossFactionHistoryCreateInput> {
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
}
