/* eslint-disable no-console */
import { type Prisma } from "@prisma/client";
import { Regions } from "@prisma/client";
import { type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  calculateExtrapolation,
  loadDataForRegion,
  protectCronRoute,
} from "~/load.server";

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

const regions = [Regions.US, Regions.EU, Regions.KR, Regions.TW, Regions.CN];

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

    if (regionData.score > 0) {
      const data = await loadDataForRegion(
        mostOutdatedRegion.region,
        season,
        {},
      );
      const extrapolation = calculateExtrapolation(
        season,
        mostOutdatedRegion.region,
        data,
        null,
      );

      if (Array.isArray(extrapolation) && extrapolation.length > 0) {
        const [timestamp, score] = extrapolation[extrapolation.length - 1];

        await Promise.all([
          prisma.extrapolation.create({
            data: {
              timestamp: Math.round(timestamp / 1000),
              region: mostOutdatedRegion.region,
              score,
            },
          }),
          prisma.crossFactionHistory.create({ data: regionData }),
        ]);
      } else {
        await prisma.crossFactionHistory.create({ data: regionData });
      }
    }

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
  // return `${rioBaseUrl}/mythic-plus-character-rankings/${rioSeasonName}/${region}/all/all/${page}`;
  return `${rioBaseUrl}/api/mythic-plus/rankings/characters?region=${region}&season=${rioSeasonName}&class=all&role=all&page=${page}`;
}

async function retrieveLastPage(
  rioSeasonName: string,
  region: Regions,
): Promise<number> {
  const firstPageApiUrl = createPageUrl(rioSeasonName, region);
  const firstPageResponse = await fetch(firstPageApiUrl);
  const firstPageJson = await firstPageResponse.json();

  return firstPageJson.rankings.ui.lastPage;
}

let retries = 0;

async function determineLastEligibleRank(
  rioSeasonName: string,
  region: Regions,
  lastPage: number,
): Promise<number> {
  if (retries === 3) {
    console.debug("too many retries to determine last eligible rank, bailing");
    return 0;
  }

  retries++;

  const url = createPageUrl(rioSeasonName, region, lastPage);

  try {
    const lastPageResponse = await fetch(url);
    const lastPageJson = await lastPageResponse.json();

    const lastEntry =
      lastPageJson.rankings.rankedCharacters[
        lastPageJson.rankings.rankedCharacters.length - 1
      ];

    retries = 0;

    return Math.floor(lastEntry.rank * 0.001);
  } catch {
    const prevPage = lastPage - 1;

    if (prevPage === 0) {
      console.debug("probably no entries yet, bailing");
      return 0;
    }

    return determineLastEligibleRank(rioSeasonName, region, prevPage);
  }
}

type RioLeaderboardApiDataset = {
  score: number;
  rank: number;
};

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
  const scorePageJson = await scorePageResponse.json();

  const match = (
    scorePageJson.rankings.rankedCharacters as RioLeaderboardApiDataset[]
  ).find((character) => character.rank === lastEligibleRank);

  if (match) {
    return match.score;
  }

  return 0;
}

async function parseRegionData(
  region: Regions,
  rioSeasonName: string,
): Promise<Prisma.CrossFactionHistoryCreateInput> {
  const now = Math.round(Date.now() / 1000);

  console.time("retrieveLastPage");
  const lastPage = await retrieveLastPage(rioSeasonName, region);
  console.timeEnd("retrieveLastPage");

  if (!lastPage) {
    console.warn("Could not parse last page, bailing without data.", lastPage);
    return {
      score: 0,
      rank: 0,
      timestamp: now,
      region,
    };
  }

  console.time("determineLastEligibleRank");
  const lastEligibleRank = await determineLastEligibleRank(
    rioSeasonName,
    region,
    lastPage,
  );
  console.timeEnd("determineLastEligibleRank");

  if (lastEligibleRank === 0) {
    console.warn(
      "Could not parse last eligible rank, bailing without data.",
      lastEligibleRank,
    );
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

  console.info(
    `Established score for ${region} at ${lastEligibleRank} of ${rioSeasonName} as ${score}`,
  );

  return {
    score,
    rank: lastEligibleRank,
    timestamp: now,
    region,
  };
}
