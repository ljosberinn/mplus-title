/* eslint-disable no-console */
import { Regions } from "prisma/generated/prisma/enums";
import { type CrossFactionHistoryCreateInput } from "prisma/generated/prisma/models";
import { type ActionFunction, type LoaderFunction } from "react-router";

import {
  calculateExtrapolation,
  loadDataForRegion,
  protectCronRoute,
} from "~/load.server";

import { prisma } from "../prisma.server";
import { findSeasonByName, type Season, seasons } from "../seasons";

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
    return new Response(JSON.stringify([]), {
      status: 404,
    });
  }

  try {
    const failed = await protectCronRoute(request);

    if (failed) {
      return new Response(JSON.stringify(failed.payload), {
        status: failed.status,
      });
    }

    const latestSeason = findSeasonByName("latest", regions);

    if (!latestSeason) {
      return new Response(JSON.stringify([]));
    }

    const latestPerRegion = (
      await prisma.crossFactionHistory.findMany({
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
      })
    ).sort((a, b) => a.timestamp - b.timestamp);

    const now = Date.now();

    // bucket unlocked regions into: no current-season data yet vs. has current-season data
    const unlockedMissingCurrentSeason: Regions[] = [];
    const unlockedWithCurrentSeason: { region: Regions; timestamp: number }[] =
      [];

    for (const region of regions) {
      const startDate = latestSeason.startDates[region];
      if (!startDate || startDate >= now) {
        // season not yet unlocked here
        continue;
      }

      const latestForRegion = latestPerRegion.find(
        (dataset) => dataset.region === region,
      );
      if (!latestForRegion) {
        continue;
      }

      if (latestForRegion.timestamp * 1000 < startDate) {
        unlockedMissingCurrentSeason.push(region);
      } else {
        unlockedWithCurrentSeason.push({
          region,
          timestamp: latestForRegion.timestamp,
        });
      }
    }

    let mostOutdatedRegion: Regions | null = null;

    if (unlockedMissingCurrentSeason.length > 0) {
      // among regions with no current-season data, prefer the one that unlocked earliest
      unlockedMissingCurrentSeason.sort(
        (a, b) => latestSeason.startDates[a]! - latestSeason.startDates[b]!,
      );
      mostOutdatedRegion = unlockedMissingCurrentSeason[0];
      console.log(
        `picking ${mostOutdatedRegion} as most outdated: no entry for current season yet`,
      );
    } else {
      // all unlocked regions have current-season data — pick the one with the oldest timestamp
      unlockedWithCurrentSeason.sort((a, b) => a.timestamp - b.timestamp);
      mostOutdatedRegion = unlockedWithCurrentSeason[0]?.region ?? null;
    }

    if (!mostOutdatedRegion) {
      mostOutdatedRegion = latestPerRegion[0].region;
    }

    console.info("most outdated region:", mostOutdatedRegion);

    const season = findSeasonForRegion(mostOutdatedRegion);

    if (!season) {
      return new Response(JSON.stringify([]));
    }

    console.info("using season:", season.name);

    console.time("parseRegionData");
    const regionData = await parseRegionData(mostOutdatedRegion, season.rioKey);
    console.timeEnd("parseRegionData");

    if (regionData.score > 0) {
      const data = await loadDataForRegion(mostOutdatedRegion, season, {});
      const extrapolation = calculateExtrapolation(
        season,
        mostOutdatedRegion,
        data,
        null,
      );

      if (Array.isArray(extrapolation) && extrapolation.length > 0) {
        const [timestamp, score] = extrapolation[extrapolation.length - 1];

        await Promise.all([
          prisma.extrapolation.create({
            data: {
              timestamp: Math.round(timestamp / 1000),
              region: mostOutdatedRegion,
              estimatedAt: Math.round(regionData.timestamp),
              score,
            },
          }),
          prisma.crossFactionHistory.create({ data: regionData }),
        ]);
      } else {
        await prisma.crossFactionHistory.create({ data: regionData });
      }
    }

    return new Response(
      JSON.stringify({ region: mostOutdatedRegion, regionData }),
    );
  } catch (error) {
    console.error("yikes", error);
    return new Response(JSON.stringify([]), {
      status: 500,
    });
  }
};

export const loader: LoaderFunction = () => {
  return new Response(JSON.stringify([]), {
    status: 405,
  });
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

async function determineLastEligibleRanks(
  rioSeasonName: string,
  region: Regions,
  lastPage: number,
): Promise<{ top01: number; top1: number }> {
  if (retries === 3) {
    console.debug("too many retries to determine last eligible rank, bailing");
    return { top01: 0, top1: 0 };
  }

  retries++;

  const url = createPageUrl(rioSeasonName, region, lastPage);

  try {
    const lastPageResponse = await fetch(url);
    const lastPageJson = await lastPageResponse.json();
    console.log(url);

    const lastEntry =
      lastPageJson.rankings.rankedCharacters[
        lastPageJson.rankings.rankedCharacters.length - 1
      ];

    retries = 0;

    return {
      top01: Math.max(1, Math.floor(lastEntry.rank * 0.001)),
      top1: Math.max(1, Math.floor(lastEntry.rank * 0.01)),
    };
  } catch {
    const prevPage = lastPage - 1;

    if (prevPage === 0) {
      console.debug("probably no entries yet, bailing");
      return { top01: 0, top1: 0 };
    }

    return determineLastEligibleRanks(rioSeasonName, region, prevPage);
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
    lastEligibleRank <= 100 ? 0 : Math.floor(lastEligibleRank / 100);

  const scorePageUrl = createPageUrl(
    rioSeasonName,
    region, // if rank is divisible by 100, it would result in page 4
    // but its still on page 3
    lastEligibleRank % 100 === 0 && lastEligibleRank > 100
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
): Promise<CrossFactionHistoryCreateInput> {
  const now = Math.round(Date.now() / 1000);

  console.time("retrieveLastPage");
  const lastPage = await retrieveLastPage(rioSeasonName, region);
  console.timeEnd("retrieveLastPage");

  console.time("determineLastEligibleRanks");
  const { top01, top1 } = await determineLastEligibleRanks(
    rioSeasonName,
    region,
    lastPage,
  );
  console.timeEnd("determineLastEligibleRanks");

  if (top01 === 0 || top1 === 0) {
    console.warn(
      "Could not parse last eligible rank, bailing without data.",
      top01,
      top1,
    );

    return {
      score: 0,
      rank: 0,
      timestamp: now,
      region,
      rank100: 0,
      score100: 0,
    };
  }

  console.time("retrieveScore top1");
  const [score, score100] = await Promise.all([
    retrieveScore(rioSeasonName, region, top01),
    retrieveScore(rioSeasonName, region, top1),
  ]);
  console.timeEnd("retrieveScore top1");

  console.info(
    `Top 0.1%: Established score for ${region} at ${top1} of ${rioSeasonName} as ${score}`,
  );
  console.info(
    `Top 1%: Established score for ${region} at ${top01} of ${rioSeasonName} as ${score100}`,
  );

  return {
    score,
    rank: top01,
    timestamp: now,
    region,
    rank100: top1,
    score100: score100,
  };
}
